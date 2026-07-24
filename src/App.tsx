import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { SettingsPanel } from './components/SettingsPanel';
import { UsagePanel } from './components/UsagePanel';
import { usePolling } from './hooks/usePolling';
import { useUsage } from './hooks/useUsage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  getToken, setToken, exchangeCode, heartbeat,
  listConversations, createConversation, sendMessage,
  deleteConversation as apiDeleteConversation, getWorkspace,
} from './lib/api';
import { copyText } from './lib/markdown';
import type { Conversation, ActiveStream, UsageData, ModelInfo, WorkspaceProfile, Attachment } from './lib/types';

function App() {
  const [pairingStatus, setPairingStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ModelInfo[]>([]);
  const [account, setAccount] = useState<WorkspaceProfile | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [statusText, setStatusText] = useState('connecting...');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [exchangeAttempts, setExchangeAttempts] = useState(0);
  const [openModelMenuSignal, setOpenModelMenuSignal] = useState(0);
  const exchangeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { startBlockPoll } = usePolling({
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

  const { fetchUsage } = useUsage(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewConversation: () => newConversation(),
    onEscape: () => {
      setShowSettings(false);
      setShowUsage(false);
    },
    inputRef,
    onSend: () => {},
  });

  // --- Sync ---
  const syncAccountConversations = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await listConversations();
      const list = (data as { conversations: unknown[] }).conversations || [];
      if (!Array.isArray(list)) return;
      setConversations(prev => {
        const updated = [...prev];
        for (const remote of list) {
          const r = remote as Record<string, unknown>;
          const id = 'acct:' + (r.id || '');
          const existing = updated.find(c => c.id === id);
          if (existing) {
            if (existing.title !== (r.name || r.title)) {
              updated[updated.indexOf(existing)] = { ...existing, title: String(r.name || r.title || existing.title) };
            }
          } else {
            updated.push({
              id,
              title: String(r.name || r.title || 'Untitled'),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: [],
              remoteId: String(r.id || ''),
              unread: false,
            });
          }
        }
        return updated;
      });
    } catch (e) {
      console.error('Sync error:', e);
    }
  }, []);

  const fetchWorkspaceProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await getWorkspace() as Record<string, unknown>;
      setAccount(data && (data.user || data.profile || data.account || data) as WorkspaceProfile);
      const models = (data.models || data.model_catalog || data.catalog) as ModelInfo[] | undefined;
      setModelCatalog(models || []);
      if (data && data.usage && typeof data.usage === 'object') {
        setUsage(data.usage as UsageData);
      }
    } catch { /* profile data is optional */ }
  }, []);

  // --- Pairing ---
  const checkPluginConnection = useCallback(async () => {
    try {
      const data = await heartbeat();
      if (data.connected) {
        setStatusText('Connected');
      }
    } catch {
      setStatusText('Checking Studio connection...');
    }
  }, []);

  const onPaired = useCallback((newToken: string) => {
    setToken(newToken);
    setPairingStatus('connected');
    setStatusText('Connected');
    setPairingError('');
    setExchangeAttempts(0);

    syncAccountConversations();
    fetchWorkspaceProfile();

    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setInterval(checkPluginConnection, 5000);

    setInterval(syncAccountConversations, 5000);
  }, [syncAccountConversations, fetchWorkspaceProfile, checkPluginConnection]);

  const exchangeCodeHandlerRef = useRef<((code: string) => void) | null>(null);

  const exchangeCodeHandler = useCallback(async (code: string) => {
    setStatusText('Connecting');
    try {
      const data = await exchangeCode(code);
      if (data.token) {
        onPaired(data.token);
      }
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status === 404 || err.status === 410) {
        if (exchangeAttempts < 10) {
          setExchangeAttempts(a => a + 1);
          setStatusText(`Waiting for Studio plugin (${exchangeAttempts + 1}/10)`);
          exchangeTimerRef.current = setTimeout(() => exchangeCodeHandlerRef.current?.(code), 2000);
        } else {
          setStatusText('Code not found / used / expired — generate a new one in Studio');
        }
      } else {
        setStatusText('Broker error. Please try again.');
      }
    }
  }, [exchangeAttempts, onPaired]);

  // Keep ref in sync with the latest handler
  // eslint-disable-next-line react-hooks/refs -- intentional ref sync for self-referencing retry
  exchangeCodeHandlerRef.current = exchangeCodeHandler;

  const unpair = useCallback((msg = '') => {
    setToken(null);
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (exchangeTimerRef.current) clearTimeout(exchangeTimerRef.current);
    setExchangeAttempts(0);
    setPairingStatus('disconnected');
    setStatusText(msg || 'Waiting for Studio...');
    setConversations([]);
    setActiveId(null);
  }, []);

  // --- Conversations ---
  const newConversation = useCallback(() => {
    const c: Conversation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: 'New conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      remoteId: null,
      unread: false,
    };
    setConversations(prev => [c, ...prev]);
    setActiveId(c.id);
  }, []);

  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
    setConversations(prev => prev.map(c => ({ ...c, unread: c.id === id ? false : c.unread })));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const convo = conversations.find(c => c.id === id);
    if (convo && convo.remoteId) {
      try { await apiDeleteConversation(convo.remoteId); } catch { /* ignore */ }
    }
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining.length ? remaining[0].id : null);
      if (!remaining.length) newConversation();
    }
  }, [activeId, conversations, newConversation]);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  // --- Send message ---
  const handleSend = useCallback(async (text: string, attachments: unknown[]) => {
    const convo = conversations.find(c => c.id === activeId);
    if (!convo) return;

    // Add user message locally
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        return { ...c, messages: [...c.messages, { role: 'user', text, meta: { attachments: attachments as Attachment[] } }] };
      }
      return c;
    }));

    setStatusText('sending...');

    try {
      const model = selectedModel || undefined;
      let data: Record<string, unknown>;
      if (convo.remoteId) {
        data = await sendMessage(convo.remoteId, { message: text, model, attachments: attachments || [] }) as Record<string, unknown>;
      } else {
        data = await createConversation({ message: text, model, attachments: attachments || [] }) as Record<string, unknown>;
      }

      // Extract op_id
      const opId = (data.blocks && (data.blocks as Record<string, unknown>[])[0] && (data.blocks as Record<string, unknown>[])[0].operation_id)
        || data.operation_id
        || (data.operation && (data.operation as Record<string, unknown>).id);

      // Update conversation remoteId
      if (data.conversation && (data.conversation as Record<string, unknown>).id) {
        const conv = data.conversation as Record<string, unknown>;
        setConversations(prev => prev.map(c => {
          if (c.id === activeId) {
            return {
              ...c,
              remoteId: String(conv.id),
              title: (typeof conv.name === 'string' ? conv.name : null) || c.title,
            };
          }
          return c;
        }));
      }

      setStatusText('sent - waiting for reply...');
      startBlockPoll(convo, opId as string || null);
      fetchUsage();
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const message = err.status === 402
        ? (err.message + ' Upgrade at agilebot.dev/upgrade.')
        : (err.message || String(err));
      setStatusText('send failed: ' + message);
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return { ...c, messages: [...c.messages, { role: 'tool', text: 'send failed: ' + message, meta: { failed: true, text } }] };
        }
        return c;
      }));
    }
  }, [activeId, conversations, selectedModel, startBlockPoll, fetchUsage]);

  // --- Copy delegation ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cb = target.closest('.copy-btn');
      if (cb) {
        e.stopPropagation();
        const txt = decodeURIComponent(cb.getAttribute('data-copy') || '');
        copyText(txt);
        const old = cb.innerHTML;
        cb.innerHTML = 'Copied';
        cb.classList.add('copy-flash');
        setTimeout(() => { cb.innerHTML = old; cb.classList.remove('copy-flash'); }, 1200);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // --- Check pairing on load ---
  useEffect(() => {
    const token = getToken();
    if (token) {
      onPaired(token);
    } else {
      unpair('');
    }
  }, []);

  return (
    <div className="flex h-screen bg-[var(--chat-panel)] overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSwitch={switchConversation}
        onDelete={deleteConversation}
        onNew={newConversation}
        onRename={renameConversation}
        filter={sidebarFilter}
        onFilterChange={setSidebarFilter}
        pairingStatus={pairingStatus}
        onUnpair={() => unpair('Disconnected')}
        onOpenSettings={() => setShowSettings(true)}
        onOpenModels={() => setOpenModelMenuSignal(n => n + 1)}
      />

      <ChatWindow
        onSend={handleSend}
        activeStream={activeStream}
        setActiveStream={setActiveStream}
        conversations={conversations}
        activeId={activeId}
        setConversations={setConversations}
        pairingStatus={pairingStatus}
        onOpenUsage={() => setShowUsage(true)}
        models={modelCatalog}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        openModelMenuSignal={openModelMenuSignal}
      />

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        account={account as Record<string, unknown> | null}
        onRefresh={fetchWorkspaceProfile}
        onUnpair={() => unpair('Disconnected from settings')}
      />

      <UsagePanel
        usage={usage}
        isOpen={showUsage}
        onClose={() => setShowUsage(false)}
        onRefresh={fetchUsage}
      />

      {/* Pairing overlay */}
      <AnimatePresence>
        {pairingStatus === 'disconnected' && (
          <motion.div
            id="pairing-overlay"
            className="fixed inset-0 bg-[rgba(10,8,5,0.97)] backdrop-blur-sm flex items-center justify-center z-[1000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="pairing-card"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="pairing-icon">🔗</div>
              <h2>Pair with Studio</h2>
              <p>Enter the 8-character pairing code shown in your Roblox Studio AgileBot plugin to connect.</p>
              <div className="pairing-input-wrap">
                <input
                  type="text"
                  id="pairing-code-input"
                  className="pairing-input"
                  maxLength={8}
                  placeholder="CODE1234"
                  autoComplete="off"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.trim().toUpperCase())}
                />
                <motion.button
                  id="pairing-connect-btn"
                  className="pairing-btn"
                  onClick={() => {
                    if (!/^[A-Z0-9]{8}$/.test(pairingCode)) {
                      setPairingError('Code must be 8 alphanumeric characters');
                      return;
                    }
                    setExchangeAttempts(1);
                    exchangeCodeHandler(pairingCode);
                  }}
                  whileHover={{ filter: 'brightness(1.1)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  Connect
                </motion.button>
              </div>
              <div id="pairing-status" className="pairing-status">{pairingError || statusText}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
