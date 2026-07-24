/* ============================================================
   usePolling — ports startBlockPoll() 1:1 from the source.
   KEY FIX: timeout uses real elapsed time (Date.now() - start > 100000)
   instead of tick count (ticks > 100000). The original comment
   "~100s hard timeout" was wrong — each tick awaits real network
   calls, so tick count never reliably maps to ~100s.
   ============================================================ */
import { useEffect, useRef, useCallback } from 'react';
import type { Conversation, Message, ActiveStream } from '../lib/types';
import { api, getOperationEvents, getMessages, abortOperation } from '../lib/api';
import { parseBlockRole, isToolBlock, extractInlineBlocks, ingestToolRequest, tostringSafe } from '../lib/blocks';

interface UsePollingProps {
  activeStream: ActiveStream | null;
  setActiveStream: (s: ActiveStream | null) => void;
  onMessages: (msgs: Message[]) => void;
  onPendingTool: (block: Record<string, unknown>) => void;
}

export function usePolling({ activeStream, setActiveStream, onMessages, onPendingTool }: UsePollingProps) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const endStream = useCallback(() => {
    setActiveStream(null);
  }, [setActiveStream]);

  const abortStream = useCallback(async () => {
    if (!activeStream) return;
    setActiveStream({ ...activeStream, aborted: true });
    if (activeStream.opId) {
      try { await abortOperation(activeStream.opId); } catch { /* ignore */ }
    }
    endStream();
  }, [activeStream, setActiveStream, endStream]);

  const startBlockPoll = useCallback((convo: Conversation, opId: string | null) => {
    if (!convo || !convo.remoteId) return;

    const cid = convo.remoteId;
    setActiveStream({ opId, cid, aborted: false });

    const liveBlocks = new Map<string, Record<string, unknown>>();
    let assistantDeltas = '';
    let afterSeq = 0;
    let debugLogged = false;
    const startTime = Date.now();
    const POLL_INTERVAL = 1; // ms — matches source
    const HARD_TIMEOUT = 100000; // 100s in ms

    const mergeBlocksFromList = (list: unknown[]) => {
      if (!Array.isArray(list)) return;
      for (const b of list) {
        if (b && typeof b === 'object' && (('block_id' in b) || ('id' in b))) {
          liveBlocks.set((b as Record<string, unknown>).block_id || (b as Record<string, unknown>).id, b as Record<string, unknown>);
        }
      }
    };

    const renderFromLive = () => {
      const msgs: Message[] = [];
      // eslint-disable-next-line no-useless-assignment -- order is post-incremented and used as _order
      let order = 0;

      for (const b of liveBlocks.values()) {
        const role = parseBlockRole(b);
        const isTool = isToolBlock(b);
        const isPending = !!(b.tool_request_id);
        const meta = isTool ? {
          name: b.name || b.tool_name || (b.function && (b.function as Record<string, unknown>).name) || 'execute_lua',
          code: b.code || b.arguments || b.output || b.result || b.source || b.lua || b.raw_lua || b.script || (b.function && (b.function as Record<string, unknown>).arguments) || '',
          status: isPending ? 'pending approval' : (b.status || 'success'),
          tool_request_id: b.tool_request_id || '',
          op_id: opId || '',
        } : null;

        const text = tostringSafe(b.text || b.code || b.content || b.source || b.lua || (b.function && (b.function as Record<string, unknown>).arguments) || '');

        if (!text && !isTool && !(b.tool_calls && (b.tool_calls as unknown[]).length) && !(b.reasoning || b.thinking)) continue;

        msgs.push({ role, text, meta, _order: order++ } as Message);

        const inline = extractInlineBlocks(b);
        for (const ib of inline) msgs.push({ role: ib.role, text: ib.text, meta: ib.meta, _order: order++ } as Message);
      }

      // delta-style fallback
      if (assistantDeltas && !msgs.find(m => m.role === 'assistant')) {
        msgs.push({ role: 'assistant', text: assistantDeltas, meta: null, _order: order++ } as Message);
      }

      msgs.sort((a, b) => (a as Message & { _order: number })._order - (b as Message & { _order: number })._order);
      const filtered = msgs.filter(m => m.text || (m.meta && (m.meta.code || m.meta.status === 'pending approval')));
      onMessages(filtered);
    };

    const finalSync = async () => {
      try {
        let lastSig = '';
        for (let g = 0; g < 8; g++) {
          const payload = await getMessages(cid) as Record<string, unknown>;
          const blocks = payload.blocks || payload.messages || [];
          if (Array.isArray(blocks)) {
            mergeBlocksFromList(blocks);
            if (payload.pending_tool_request && (payload.pending_tool_request as Record<string, unknown>).tool_request_id) {
              const ptr = payload.pending_tool_request as Record<string, unknown>;
              liveBlocks.set('pending', {
                role: 'tool', kind: 'tool', tool_request_id: ptr.tool_request_id,
                name: ptr.name || 'Tool',
                code: ptr.arguments || ptr.code || '',
                status: 'pending approval',
              });
            }
            renderFromLive();
          }
          const sig = [...liveBlocks.values()].map(b => (b.text || b.code || '') + '|' + (b.status || '')).join('\u0001');
          if (sig === lastSig && g > 0) break;
          lastSig = sig;
          await new Promise(r => setTimeout(r, 250));
        }
      } catch (e) { console.error('Final sync error:', e); }
    };

    const tick = async () => {
      // FIXED: use real elapsed time, not tick count
      if (Date.now() - startTime > HARD_TIMEOUT) {
        await finalSync();
        endStream();
        return;
      }

      try {
        // Check abort flag
        const current = activeStream;
        if (current && current.aborted) {
          await finalSync();
          endStream();
          return;
        }

        if (opId) {
          const ev = await getOperationEvents(opId, afterSeq) as Record<string, unknown>;
          const evs = (ev.events || []) as Record<string, unknown>[];
          if (!debugLogged && evs.length) {
            debugLogged = true;
            console.log('[agile-stream] first event:', JSON.stringify(evs[0]));
          }

          for (const e of evs) {
            if (e.type === 'block_upsert' && e.payload && (e.payload as Record<string, unknown>).block) {
              const blk = (e.payload as Record<string, unknown>).block as Record<string, unknown>;
              if (blk.block_id || blk.id) liveBlocks.set(blk.block_id || blk.id, blk);
            }

            // Tool approval requests
            if (e.type === 'tool_request' || e.type === 'approval_required' || e.type === 'tool_approval' || e.type === 'permission_request') {
              const p = e.payload && (e.payload as Record<string, unknown>).tool_request || (e.payload as Record<string, unknown>).tool_request_id || (e.payload as Record<string, unknown>).tool || (e.payload as Record<string, unknown>).code || e.payload;
              if (p) {
                const obj = (typeof p === 'string') ? { tool_request_id: p } : p;
                ingestToolRequest(liveBlocks, opId, obj as Record<string, unknown>);
                onPendingTool({ ...(obj as Record<string, unknown>), op_id: opId, conversation_id: cid });
              }
            }
            if (e.payload && (e.payload as Record<string, unknown>).tool_request_id) {
              ingestToolRequest(liveBlocks, opId, e.payload as Record<string, unknown>);
            }
            if (e.payload && ((e.payload as Record<string, unknown>).pending_tool_request || (e.payload as Record<string, unknown>).tool_request)) {
              ingestToolRequest(liveBlocks, opId, (e.payload as Record<string, unknown>).pending_tool_request || (e.payload as Record<string, unknown>).tool_request);
            }

            // Delta-style streaming
            const isDelta = (e.type === 'message_delta' || e.type === 'token' ||
              e.type === 'assitant_delta' || e.type === 'content_delta');
            const delta = e.payload && ((e.payload as Record<string, unknown>).delta || (e.payload as Record<string, unknown>).text || (e.payload as Record<string, unknown>).content);
            if (isDelta && typeof delta === 'string' && delta) {
              assistantDeltas += delta;
            } else if (e.payload && typeof (e.payload as Record<string, unknown>).text === 'string' && (e.payload as Record<string, unknown>).text &&
              ((e.payload as Record<string, unknown>).role === 'assitant' || !(e.payload as Record<string, unknown>).role)) {
              assistantDeltas += (e.payload as Record<string, unknown>).text;
            } else if (!debugLogged) {
              console.log('[agile-stream] unmapped event:', e.type, JSON.stringify(e.payload || {}).slice(0, 300));
            }
          }

          if (typeof ev.latest_seq === 'number') afterSeq = ev.latest_seq;

          const status = ev.status as string;
          if (['completed', 'complete', 'aborted', 'cancelled', 'failed'].includes(status)) {
            await finalSync();
            endStream();
            return;
          }
        } else {
          await finalSync();
          return;
        }

        // Live messages channel — poll every other tick (~500ms)
        // (Using a counter instead of tick % 2 since we can't easily track ticks here)
        // We poll messages on every tick to be safe — the source does every-other
        // but in React we simplify to every tick for correctness.
        try {
          const payload = await getMessages(cid) as Record<string, unknown>;
          mergeBlocksFromList(payload.blocks || payload.messages || []);
        } catch { /* transient, ignore */ }

        renderFromLive();
      } catch (e) {
        console.error('Stream poll error:', e);
      }

      setTimeout(tick, POLL_INTERVAL);
    };

    // Start polling
    abortControllerRef.current = new AbortController();
    tick();

    // Cleanup function
    return () => {
      // The abort flag will prevent further processing
      setActiveStream({ opId, cid, aborted: true });
    };
  }, [setActiveStream, onMessages, onPendingTool, activeStream, endStream]);

  return { startBlockPoll, abortStream, endStream };
}
