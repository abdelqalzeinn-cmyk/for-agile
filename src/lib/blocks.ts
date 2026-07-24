/* ============================================================
   BLOCK PARSING HELPERS — ported from source functions:
   isToolBlock, parseBlockRole, extractInlineBlocks,
   ingestToolRequest, tostringSafe
   ============================================================ */
import type { MessageMeta } from './types';

export function tostringSafe(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

export function isToolBlock(b: Record<string, unknown> | null | undefined): boolean {
  if (!b) return false;
  const r = (b.role || b.kind || '').toLowerCase();
  const toolRoles = ['tool', 'executed_code', 'tool_use', 'tool_call', 'function_call', 'code', 'luau', 'lua', 'script', 'action', 'command'];
  return (
    toolRoles.includes(r) ||
    !!b.tool_request_id ||
    !!(b.function && (b.function as Record<string, unknown>).name)
  );
}

export function parseBlockRole(raw: Record<string, unknown> | null | undefined): 'user' | 'assistant' | 'tool' | 'thinking' {
  if (!raw) return 'assistant';
  if (isToolBlock(raw)) return 'tool';
  const role = (raw.role || raw.kind || '').toLowerCase();
  if (role === 'reasoning' || role === 'thought' || role === 'thinking' || role === 'tool_result' || role === 'tool_output' || role === 'error' || role === 'notice' || role === 'log') return 'thinking';
  if (role === 'user' || role === 'assistant' || role === 'system') return role;
  return 'assistant';
}

export function extractInlineBlocks(b: Record<string, unknown>): { role: 'tool' | 'thinking'; text: string; meta: MessageMeta | null }[] {
  const extra: { role: 'tool' | 'thinking'; text: string; meta: MessageMeta | null }[] = [];

  const tc = b.tool_calls || (b.assistant && (b.assistant as Record<string, unknown>).tool_calls) || (b.message && (b.message as Record<string, unknown>).tool_calls);
  if (Array.isArray(tc)) {
    for (const c of tc) {
      const cObj = c as Record<string, unknown>;
      const fn = (cObj.function || cObj) as Record<string, unknown>;
      const args = typeof fn.arguments === 'string'
        ? fn.arguments
        : (fn.arguments ? JSON.stringify(fn.arguments, null, 2) : '');
      extra.push({
        role: 'tool',
        text: '',
        meta: {
          name: fn.name || cObj.name || 'tool',
          code: args || (cObj.code || ''),
          status: cObj.tool_request_id ? 'pending approval' : (cObj.status || 'success'),
          tool_request_id: cObj.tool_request_id || '',
          op_id: b.op_id || b.operation_id || '',
          conversation_id: b.conversation_id || '',
        },
      });
    }
  }

  const reason = b.reasoning || b.thinking || b.reasoning_content;
  if (reason) extra.push({ role: 'thinking', text: tostringSafe(reason), meta: null });

  return extra;
}

// Ingest a tool-approval / "preparing lua" request into liveBlocks
export function ingestToolRequest(liveBlocks: Map<string, Record<string, unknown>>, opId: string, p: Record<string, unknown>): void {
  if (!p) return;
  const tr = p.tool_request_id || p.toolRequestId || p.id || '';
  const fn = (p.function || p) as Record<string, unknown>;
  const name = p.name || fn.name || 'execute_lua';
  let code = p.arguments || p.code || p.source || p.lua || p.raw_lua || p.script || (fn.arguments) || '';
  if (typeof code !== 'string') code = JSON.stringify(code);
  const key = 'toolreq_' + (tr || name) + '_' + (p.seq || p.order || '');
  liveBlocks.set(key, {
    role: 'tool', kind: 'tool', tool_request_id: tr, name, code,
    status: tr ? 'pending approval' : 'success', op_id: opId || '',
    conversation_id: (typeof p === 'object' && p.conversation_id) || '',
  });
}
