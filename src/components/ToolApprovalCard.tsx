import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { copyText } from '../lib/markdown';
import { submitToolDecision } from '../lib/api';
import type { Message } from '../lib/types';

interface ToolApprovalCardProps {
  message: Message;
  onDecision: (decision: string) => void;
  onResend: (text: string) => void;
}

export function ToolApprovalCard({ message, onDecision, onResend }: ToolApprovalCardProps) {
  const { meta } = message;
  const m = meta || {};
  const pendingApproval = m.status === 'pending approval' && m.tool_request_id && m.op_id;
  const expTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isOpen, setIsOpen] = useState(pendingApproval || !!m.code);

  const clearTimer = () => {
    if (expTimerRef.current) {
      clearTimeout(expTimerRef.current);
      expTimerRef.current = null;
    }
  };

  const handleDecision = async (decision: string) => {
    clearTimer();
    try {
      await submitToolDecision(m.op_id || '', {
        conversation_id: m.conversation_id || '',
        tool_request_id: m.tool_request_id || '',
        decision: decision as 'allow_once' | 'always' | 'decline' | 'tool_resolved',
      });
      onDecision(decision);
    } catch (e) {
      alert('Failed to submit decision: ' + (e as Error).message);
    }
  };

  useEffect(() => {
    if (pendingApproval) {
      expTimerRef.current = setTimeout(() => {
        onDecision('expired');
      }, 120000);
    }
    return () => clearTimer();
  }, [pendingApproval, onDecision]);

  const statusText = (m.status || '').toLowerCase();
  const statusCls = statusText.includes('ok') || statusText.includes('done') || statusText.includes('success')
    ? 'ok'
    : (statusText.includes('run') ? 'run' : '');

  return (
    <motion.div
      className="msg tool"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="tool-card">
        <motion.div
          className="tool-card-head"
          onClick={() => {
            if (m.code || pendingApproval) setIsOpen(!isOpen);
          }}
          whileHover={{ backgroundColor: 'rgba(201,162,78,0.12)' }}
          style={{ cursor: (m.code || pendingApproval) ? 'pointer' : 'default' }}
        >
          <span className="tool-ico">🔧</span>
          <span className="tool-name">{m.name || 'Tool'}</span>
          {m.code && (
            <button
              type="button"
              className="copy-btn tool-copy"
              data-copy={encodeURIComponent(m.code || '')}
              onClick={() => copyText(m.code || '')}
            >
              Copy
            </button>
          )}
          {m.status && (
            <span className={`tool-status ${statusCls}`}>{m.status}</span>
          )}
          <motion.span
            className="tool-chevron"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            ▼
          </motion.span>
        </motion.div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              className="tool-card-code-container"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            >
              <div>
                {m.code && (
                  <motion.pre
                    className="tool-card-code"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {m.code}
                  </motion.pre>
                )}

                {pendingApproval && (
                  <motion.div
                    className="tool-decisions"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <motion.button
                      style={{ background: 'var(--tool)', color: '#0b0906' }}
                      onClick={() => handleDecision('allow_once')}
                      whileHover={{ filter: 'brightness(1.12)' }}
                      whileTap={{ y: 1 }}
                    >
                      Allow Once
                    </motion.button>
                    <motion.button
                      style={{ background: 'var(--violet)', color: '#241a08' }}
                      onClick={() => handleDecision('always')}
                      whileHover={{ filter: 'brightness(1.12)' }}
                      whileTap={{ y: 1 }}
                    >
                      Always Allow
                    </motion.button>
                    <motion.button
                      style={{ background: 'var(--danger)', color: '#fbf3e2' }}
                      onClick={() => handleDecision('decline')}
                      whileHover={{ filter: 'brightness(1.12)' }}
                      whileTap={{ y: 1 }}
                    >
                      Decline
                    </motion.button>
                    <motion.button
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text)' }}
                      onClick={() => handleDecision('tool_resolved')}
                      whileHover={{ filter: 'brightness(1.12)' }}
                      whileTap={{ y: 1 }}
                    >
                      Resolve
                    </motion.button>
                  </motion.div>
                )}

                {m.failed && (
                  <motion.div
                    className="tool-decisions"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <motion.button
                      style={{ background: 'var(--danger)', color: '#fbf3e2' }}
                      onClick={() => onResend(m.text || '')}
                      whileHover={{ filter: 'brightness(1.12)' }}
                      whileTap={{ y: 1 }}
                    >
                      Retry
                    </motion.button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
