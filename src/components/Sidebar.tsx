import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Conversation, WorkspaceProfile } from '../lib/types';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  pairingStatus: 'disconnected' | 'connecting' | 'connected';
  onUnpair: () => void;
  onOpenSettings: () => void;
  onOpenModels: () => void;
  account: WorkspaceProfile | null;
}

export function Sidebar({
  conversations,
  activeId,
  onSwitch,
  onDelete,
  onNew,
  onRename,
  filter,
  onFilterChange,
  pairingStatus,
  onUnpair,
  onOpenSettings,
  onOpenModels,
  account,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const shown = conversations.filter(c =>
    !filter || (c.title || '').toLowerCase().includes(filter.toLowerCase())
  );

  const handleRenameStart = (c: Conversation) => {
    setRenamingId(c.id);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const handleRenameCommit = (c: Conversation) => {
    const input = renameInputRef.current;
    if (input) {
      const v = input.value.trim();
      if (v) onRename(c.id, v);
    }
    setRenamingId(null);
  };

  return (
    <motion.aside
      id="sidebar"
      className="w-64 min-w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col"
      initial={{ x: -250, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -250, opacity: 0 }}
      transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="sidebar-header">
        <motion.div className="brand" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div className="brand-dot" />
          <span>AgileBot</span>
        </motion.div>
        <motion.button
          id="collapse-btn"
          title="Collapse sidebar"
          className="bg-none border-none text-[var(--text-faint)] cursor-pointer p-1 rounded"
          whileHover={{ backgroundColor: 'var(--bg-hover)', color: 'var(--gold-hi)' }}
          whileTap={{ scale: 0.9 }}
        >
          ✕
        </motion.button>
      </div>

      <motion.button
        id="new-chat-btn"
        onClick={onNew}
        className="mx-3.5 my-3.5 py-2.5 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text)] font-semibold text-sm cursor-pointer flex items-center gap-2"
        whileHover={{ backgroundColor: 'var(--bg-hover)', borderColor: 'var(--violet-soft)', color: 'var(--gold-hi)' }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        + New chat
      </motion.button>

      <nav className="side-nav">
        <motion.button
          className="side-nav-item active"
          data-panel="home"
          whileHover={{ backgroundColor: 'rgba(201,162,78,0.12)', color: 'var(--gold-hi)' }}
        >
          HOME <span>Home</span>
        </motion.button>
        <motion.button
          className="side-nav-item"
          data-panel="models"
          onClick={onOpenModels}
          whileHover={{ backgroundColor: 'rgba(201,162,78,0.12)', color: 'var(--gold-hi)' }}
        >
          AI <span>Models</span>
        </motion.button>
      </nav>

      <div className="sidebar-search mx-3.5 mb-2.5">
        <input
          id="convo-search"
          type="text"
          placeholder="Search conversations..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl p-1.75 text-[var(--text)] font-sans text-sm outline-none"
        />
      </div>

      <div className="sidebar-label">Past conversations</div>
      <div id="conversation-list" className="flex-1 overflow-y-auto px-2.5 pb-2.5">
        <AnimatePresence>
          {conversations.length === 0 ? (
            <motion.div
              className="sidebar-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              No conversations yet.
            </motion.div>
          ) : shown.length === 0 ? (
            <motion.div
              className="sidebar-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              No matches.
            </motion.div>
          ) : (
            shown.map((c) => (
              <motion.div
                key={c.id}
                className={`convo-item ${c.id === activeId ? 'active' : ''}`}
                onClick={() => { c.id !== activeId && setRenamingId(null); onSwitch(c.id); }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
              >
                {renamingId === c.id ? (
                  <input
                    ref={renameInputRef}
                    className="convo-title-input"
                    defaultValue={c.title}
                    onBlur={() => handleRenameCommit(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleRenameCommit(c); }
                      else if (e.key === 'Escape') { setRenamingId(null); }
                    }}
                  />
                ) : (
                  <span
                    className="convo-title"
                    title="Double-click to rename"
                    onDoubleClick={(e) => { e.stopPropagation(); handleRenameStart(c); }}
                  >
                    {c.title || 'New conversation'}
                  </span>
                )}

                <motion.button
                  className="convo-delete"
                  title="Delete conversation"
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  whileHover={{ color: 'var(--danger)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>

                {c.unread && c.id !== activeId && (
                  <motion.span
                    className="unread-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  />
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <motion.div
        className="sidebar-footer"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            className="dot"
            animate={{
              backgroundColor: pairingStatus === 'connected' ? 'var(--tool)' : 'var(--text-faint)',
              boxShadow: pairingStatus === 'connected' ? '0 0 0 3px rgba(79,157,124,0.18)' : 'none',
            }}
          />
          <span id="footer-status">
            {pairingStatus === 'connected' ? 'Connected' : pairingStatus === 'connecting' ? 'Connecting...' : 'Waiting for plugin...'}
          </span>
        </div>
        <div className="account-footer">
          {account && account.roblox_profile_image ? (
            <img className="avatar" src={String(account.roblox_profile_image)} alt={account.roblox_username ? String(account.roblox_username) : 'Roblox user'} />
          ) : (
            <div className="avatar">{account && (account.roblox_username || account.name) ? String(account.roblox_username || account.name || '?').slice(0, 1).toUpperCase() : '?'}</div>
          )}
          <div>
            <strong>{account && (account.roblox_username || account.name) ? String(account.roblox_username || account.name) : 'Roblox user'}</strong>
            <small>{pairingStatus === 'connected' ? 'Connected' : 'Not connected'}</small>
          </div>
          <motion.button
            id="settings-btn"
            title="Settings"
            onClick={onOpenSettings}
            whileHover={{ color: 'var(--gold-hi)' }}
            whileTap={{ scale: 0.9 }}
          >
            ⚙
          </motion.button>
        </div>
        {pairingStatus === 'connected' && (
          <motion.button
            id="unpair-btn"
            className="text-[var(--danger)] text-xs font-semibold cursor-pointer bg-none border-none rounded p-1"
            onClick={onUnpair}
            whileHover={{ backgroundColor: 'rgba(179,69,63,0.1)' }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Unpair
          </motion.button>
        )}
      </motion.div>
    </motion.aside>
  );
}
