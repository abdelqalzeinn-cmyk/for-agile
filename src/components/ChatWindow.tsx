import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { usePolling } from '../hooks/usePolling';
import { createConversation, getMessages } from '../lib/api';
import type { ActiveStream, Conversation } from '../lib/types';

interface ChatWindowProps {
  onSend: (text: string, attachments: unknown[]) => void;
  activeStream: ActiveStream | null;
  setActiveStream: (s: ActiveStream | null) => void;
  conversations: Conversation[];
  activeId: string | null;
  setConversations: (updater: (prev: Conversation[]) => Conversation[]) => void;
  pairingStatus: 'disconnected' | 'connecting' | 'connected';
  onOpenUsage: () => void;
}

export function ChatWindow({
  onSend,
  activeStream,
  setActiveStream,
  conversations,
  activeId,
  setConversations,
  pairingStatus,
  onOpenUsage,
}: ChatWindowProps) {
  const logRef = useRef<HTMLDivElement>(null);

  usePolling({
    activeStream,
    setActiveStream,
    onMessages: (msgs) => {
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) return { ...c, messages: msgs as Conversation['messages'] };
        return c;
      }));
    },
    onPendingTool: () => {},
  });

  const handleSend = useCallback((text: string, attachments: unknown[]) => {
    onSend(text, attachments);
  }, [onSend]);

  const handleImprove = useCallback(async (prompt: string): Promise<string | null> => {
    // Port of improvePromptPrivately — creates a temp conversation, polls for result
    try {
      const data = await createConversation({ message: prompt });
      const remoteId = data?.conversation?.id;
      if (!remoteId) return null;

      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 700));
        const result = await getMessages(remoteId);
        const blocksRaw = result && (result.blocks || result.messages || []);
        const blocks = Array.isArray(blocksRaw) ? (blocksRaw as Record<string, unknown>[]) : [];
        const assistant = [...blocks].reverse().find(b => (b.kind || b.role) === 'assistant' && (b.text || b.content));
        if (assistant) {
          const text = String((assistant as Record<string, unknown>).text || (assistant as Record<string, unknown>).content || '').trim();
          if (text) return text;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Scroll handling
  const isNearBottom = useCallback(() => {
    const el = logRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollBtn(!isNearBottom());
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [isNearBottom]);

  // Auto-scroll to bottom when new messages arrive (if near bottom)
  const messages = conversations.find(c => c.id === activeId)?.messages || [];

  // Thinking indicator — distinct from tool-card streaming state
  const showThinking = activeStream
    && activeStream.cid === conversations.find(c => c.id === activeId)?.remoteId
    && !messages.some(m => m.role === 'assistant');

  const activeTitle = conversations.find(c => c.id === activeId)?.title || 'New conversation';

  return (
    <div id="main" className="flex-1 flex flex-col bg-[var(--chat-bg)]">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-[var(--border-color)] bg-[var(--chat-bg)]">
        <button id="open-sidebar-btn" title="Open sidebar" className="hidden sm:flex">☰</button>
        <h1 className="font-display italic text-sm text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap flex-1">
          {activeTitle}
        </h1>
        <a
          className="upgrade-link"
          href="https://agilebot.dev/upgrade"
          target="_blank"
          rel="noopener noreferrer"
        >
          Upgrade to Pro <span>→</span>
        </a>
        <button
          id="usage-btn"
          title="Usage"
          onClick={onOpenUsage}
          className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-dim)] cursor-pointer px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-2"
        >
          <span style={{ color: '#e8b923' }}>Usage</span>
          <span
            id="usage-pill"
            className="bg-[rgba(95,184,138,0.18)] text-[#5fb888] text-[10px] px-1.5 py-0.5 rounded-full"
          >
            0%
          </span>
        </button>
        <div className="status">
          <span className="dot" />
          <span>connecting...</span>
        </div>
      </header>

      <div id="log" ref={logRef} className="flex-1 overflow-y-auto py-7 px-4 max-w-[820px] w-full mx-auto">
        {messages.length === 0 && !showThinking ? (
          <div className="empty-state">
            <div className="big">Ready when you are</div>
            Send a message to begin.
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              onResend={(_text) => {
                // Resend: drop trailing non-user messages, re-send
                setConversations(prev => prev.map(c => {
                  if (c.id === activeId) {
                    const keep = c.messages.filter((_, j) => j <= c.messages.findIndex(mm => mm.role === 'user'));
                    return { ...c, messages: keep };
                  }
                  return c;
                }));
              }}
            />
          ))
        )}
        {showThinking && (
          <div className="msg assistant thinking-indicator">
            <div className="bubble thinking-bubble">
              <span className="thinking-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="thinking-label">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            id="scroll-bottom"
            title="Scroll to bottom"
            onClick={scrollToBottom}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            whileHover={{ filter: 'brightness(1.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            ↓
          </motion.button>
        )}
      </AnimatePresence>

      <Composer
        onSend={handleSend}
        onImproving={handleImprove}
        disabled={pairingStatus !== 'connected'}
      />
    </div>
  );
}
