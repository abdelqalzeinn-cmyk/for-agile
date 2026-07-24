import { motion, AnimatePresence } from 'framer-motion';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  account: Record<string, unknown> | null;
  onRefresh: () => void;
  onUnpair: () => void;
}

export function SettingsPanel({ isOpen, onClose, account, onRefresh, onUnpair }: SettingsPanelProps) {
  const accountName = (account?.roblox_username || account?.username || account?.display_name || 'Roblox account') as string;
  const accountId = (account?.roblox_user_id || account?.user_id || account?.userId || 'Profile data supplied by Studio') as string;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="workspace-panel"
          className="fixed inset-0 z-60 flex items-center bg-[rgba(5,5,9,0.72)] backdrop-blur-sm"
          aria-hidden="false"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-[min(760px,92vw)] max-h-[82vh] overflow-auto bg-[#15151d] border border-[#302c3b] rounded-xl p-5.5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="eyebrow">ACCOUNT</span>
                <h2 className="mt-0.5 font-display text-2xl text-[var(--text)]">Settings</h2>
              </div>
              <motion.button
                id="panel-close"
                className="border-0 bg-transparent text-[var(--text-faint)] text-2xl cursor-pointer"
                onClick={onClose}
                whileHover={{ color: 'var(--gold-hi)' }}
                whileTap={{ scale: 0.9 }}
              >
                X
              </motion.button>
            </div>

            <motion.div
              className="settings-card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="avatar w-10 h-10 flex-0_0_42px text-sm">
                {accountName ? String(accountName).slice(0, 1).toUpperCase() : '?'}
              </div>
              <div>
                <strong>{accountName}</strong>
                <small>{accountId}</small>
              </div>
              <div className="settings-status">
                <span className="dot paired" />
                Connected
              </div>
            </motion.div>

            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="settings-section-title">Workspace</div>
              <div className="settings-card" style={{ display: 'block', padding: '4px 14px' }}>
                <div className="settings-row">
                  <span>Default model</span>
                  <select id="settings-model" className="min-w-[170px] border border-[var(--border-color)] rounded-lg p-2 bg-[var(--bg-tertiary)] text-[var(--text)]">
                    <option value="">Default model</option>
                  </select>
                </div>
                <div className="settings-row">
                  <span>Keyboard input</span>
                  <strong style={{ fontSize: '12px', color: 'var(--gold-hi)' }}>Enter sends, Shift+Enter adds a line</strong>
                </div>
                <div className="settings-row">
                  <span>Studio heartbeat</span>
                  <strong style={{ fontSize: '12px', color: '#5fb888' }}>Checked every 5 seconds</strong>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="settings-section-title">Account actions</div>
              <div className="settings-grid">
                <motion.button
                  id="settings-refresh"
                  onClick={onRefresh}
                  whileHover={{ borderColor: 'var(--violet)', color: 'var(--gold-hi)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Refresh account data
                </motion.button>
                <motion.button
                  id="settings-unpair"
                  onClick={onUnpair}
                  whileHover={{ borderColor: 'var(--violet)', color: 'var(--gold-hi)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Disconnect Studio
                </motion.button>
                <motion.button
                  id="settings-shortcuts"
                  onClick={() => {
                    alert(
                      'Enter — Send message\n' +
                      'Shift+Enter — New line\n' +
                      'Ctrl/Cmd+K — New conversation\n' +
                      'Esc — Close panels & menus'
                    );
                  }}
                  whileHover={{ borderColor: 'var(--violet)', color: 'var(--gold-hi)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Keyboard shortcuts
                </motion.button>
                <motion.a
                  href="https://agilebot.dev/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ borderColor: 'var(--violet)', color: 'var(--gold-hi)' }}
                >
                  Terms of Service
                </motion.a>
                <motion.a
                  href="https://agilebot.dev/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ borderColor: 'var(--violet)', color: 'var(--gold-hi)' }}
                >
                  Privacy Policy
                </motion.a>
              </div>
            </motion.div>

            <motion.div
              className="text-[var(--text-faint)] text-sm leading-1.6 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              Your account and Studio connection are managed securely through AgileBot.
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
