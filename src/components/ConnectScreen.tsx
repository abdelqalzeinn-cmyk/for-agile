import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Props {
  /** 'connecting' = Lemonade mode polling for plugin
   *  'waiting'     = broker unreachable, retry available
   *  'connected'   = plugin detected, transitioning to chat
   *  'fallback'    = no plugin detected, show device-code entry */
  status: 'connecting' | 'waiting' | 'connected' | 'fallback';
  statusText: string;
  robloxUsername?: string;
  robloxAvatarUrl?: string;
  pairingCode?: string;
  pairingError?: string;
  onPairingCodeSubmit?: (code: string) => void;
  onRetry?: () => void;
  onSwitchToLemonade?: () => void;   // from fallback -> lemonade
  onSwitchToFallback?: () => void;   // from lemonade -> fallback
}

export function ConnectScreen({
  status,
  statusText,
  robloxUsername,
  robloxAvatarUrl,
  pairingCode = '',
  pairingError = '',
  onPairingCodeSubmit,
  onRetry,
  onSwitchToLemonade,
  onSwitchToFallback,
}: Props) {
  const [dots, setDots] = useState('');
  const [code, setCode] = useState(pairingCode);

  useEffect(() => { setCode(pairingCode); }, [pairingCode]);

  useEffect(() => {
    if (status !== 'connecting' && status !== 'waiting') return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(t);
  }, [status]);

  return (
    <motion.div
      id="connect-overlay"
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #FFD93D 0%, #FFB830 35%, #FF8C42 65%, #16213E 100%)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Radial highlight */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,217,61,0.35) 0%, transparent 60%)',
        }}
      />

      {/* Floating bubbles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 40 + i * 18,
            height: 40 + i * 18,
            left: `${5 + i * 11}%`,
            top: `${15 + (i % 4) * 20}%`,
            background: i % 2 === 0
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(255,217,61,0.22)',
            border: '1px solid rgba(255,255,255,0.3)',
            backdropFilter: 'blur(2px)',
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, i % 2 === 0 ? 20 : -20, 0],
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4 + i * 0.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}

      {/* Main card */}
      <motion.div
        className="connect-card relative z-10 flex flex-col items-center px-8 py-10 rounded-2xl"
        style={{
          background: 'rgba(22, 33, 62, 0.92)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(255,217,61,0.15)',
          border: '1px solid rgba(255, 217, 61, 0.35)',
          width: 'min(420px, 92vw)',
        }}
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        {/* Animated lemon icon */}
        <motion.div
          className="mb-5 relative"
          animate={status === 'connecting' ? {
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          } : status === 'connected' ? {
            scale: [1, 1.2, 1],
          } : {}}
          transition={status === 'connecting' ? {
            duration: 2.5,
            repeat: Infinity,
            ease: 'linear',
          } : status === 'connected' ? {
            duration: 0.6,
            ease: 'easeOut',
          } : {}}
        >
          <div
            style={{
              fontSize: '56px',
              filter: 'drop-shadow(0 4px 20px rgba(255,217,61,0.5))',
            }}
          >
            🍋
          </div>
          {status === 'connected' && (
            <motion.div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: '#6BCB77', color: '#0A0805' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
            >
              ✓
            </motion.div>
          )}
        </motion.div>

        <motion.h2
          className="text-2xl font-bold mb-1.5"
          style={{ color: '#FFD93D', letterSpacing: '-0.02em' }}
          key={status + robloxUsername}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {status === 'connected'
            ? `Welcome, ${robloxUsername || 'Builder'}!`
            : status === 'fallback'
            ? 'Enter pairing code'
            : 'Connecting to AgileBot'}
        </motion.h2>

        <motion.p
          className="text-sm mb-6 text-center"
          style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '320px' }}
          key={status + '-desc'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {status === 'connected'
            ? 'Open Roblox Studio and start building. Your chat is ready.'
            : status === 'fallback'
            ? 'Get an 8-character code from the AgileBot plugin in Studio.'
            : 'Make sure the AgileBot plugin is running in Studio, then click Connect in its settings.'}
        </motion.p>

        {/* Avatar preview when connected */}
        <AnimatePresence>
          {status === 'connected' && robloxAvatarUrl && (
            <motion.img
              src={robloxAvatarUrl}
              alt="Roblox avatar"
              className="w-20 h-20 rounded-full mb-4"
              style={{ border: '3px solid #6BCB77', boxShadow: '0 0 30px rgba(107,203,119,0.4)' }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            />
          )}
        </AnimatePresence>

        {/* Status pill */}
        <div
          className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 mb-5"
          style={{
            background:
              status === 'connected'
                ? 'rgba(107, 203, 119, 0.18)'
                : status === 'waiting'
                ? 'rgba(235, 87, 87, 0.18)'
                : status === 'fallback'
                ? 'rgba(255, 217, 61, 0.18)'
                : 'rgba(165, 165, 165, 0.18)',
            color:
              status === 'connected' ? '#6BCB77'
                : status === 'waiting' ? '#EB5757'
                : status === 'fallback' ? '#FFD93D'
                : '#A5A5A5',
          }}
        >
          <span className="relative flex h-2 w-2">
            {status === 'connected' && (
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                style={{ background: '#6BCB77' }}
              />
            )}
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{
                background:
                  status === 'connected' ? '#6BCB77'
                    : status === 'waiting' ? '#EB5757'
                    : status === 'fallback' ? '#FFD93D'
                    : '#A5A5A5',
              }}
            />
          </span>
          {statusText}
          {dots}
        </div>

        {/* Fallback: device-code input */}
        <AnimatePresence>
          {status === 'fallback' && (
            <motion.div
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex gap-2 w-full mb-3">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 rounded-lg text-center font-mono tracking-widest uppercase"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,217,61,0.3)',
                    color: '#EAEAEA',
                    fontSize: '16px',
                  }}
                  maxLength={8}
                  placeholder="CODE1234"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && /^[A-Z0-9]{8}$/.test(code) && onPairingCodeSubmit) {
                      onPairingCodeSubmit(code);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (/^[A-Z0-9]{8}$/.test(code) && onPairingCodeSubmit) onPairingCodeSubmit(code);
                  }}
                  disabled={!/^[A-Z0-9]{8}$/.test(code)}
                  className="px-5 py-2.5 rounded-lg font-semibold transition disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #FFD93D, #F5C518)',
                    color: '#1A1A2E',
                  }}
                >
                  Pair
                </button>
              </div>
              {pairingError && (
                <p className="text-xs mb-2" style={{ color: '#EB5757' }}>{pairingError}</p>
              )}
              <button
                onClick={onSwitchToLemonade}
                className="text-xs underline"
                style={{ color: '#FFD93D', opacity: 0.7 }}
              >
                ← Try one-click connect instead
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connecting/waiting: retry button */}
        <AnimatePresence>
          {status === 'waiting' && onRetry && (
            <motion.button
              onClick={onRetry}
              className="mt-1 px-6 py-2.5 rounded-lg font-semibold transition hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #FFD93D, #F5C518)',
                color: '#1A1A2E',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Retry connection
            </motion.button>
          )}
        </AnimatePresence>

        {/* Connecting: hint to switch to fallback after timeout */}
        <AnimatePresence>
          {status === 'connecting' && onSwitchToFallback && (
            <motion.button
              onClick={onSwitchToFallback}
              className="mt-4 text-xs underline opacity-60 hover:opacity-100 transition"
              style={{ color: '#FFD93D' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 8 }}
            >
              No plugin? Use a pairing code instead
            </motion.button>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div
          className="mt-6 pt-4 text-center text-xs w-full"
          style={{
            color: 'rgba(255,255,255,0.4)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          AgileBot v0.3.1 · Lemonade connection mode
        </div>
      </motion.div>
    </motion.div>
  );
}
