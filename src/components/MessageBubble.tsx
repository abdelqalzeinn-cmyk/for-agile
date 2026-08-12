import { motion } from 'framer-motion';
import { renderMarkdown, copyText } from '../lib/markdown';
import type { Message } from '../lib/types';

interface MessageBubbleProps {
  message: Message;
  onResend: (text: string) => void;
}

export function MessageBubble({ message, onResend }: MessageBubbleProps) {
  const { role, text, meta, attachments } = message;

  // Tool card
  if (role === 'tool') {
    const m = meta || {};
    const pendingApproval = m.status === 'pending approval' && m.tool_request_id && m.op_id;
    const statusText = (m.status || '').toLowerCase();
    const statusCls = statusText.includes('ok') || statusText.includes('done') || statusText.includes('success')
      ? 'ok'
      : (statusText.includes('run') ? 'run' : '');

    return (
      <motion.div
        className="msg tool"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="tool-card" data-tool-id={m.tool_request_id}>
          <div className="tool-card-head">
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
            <span className="tool-chevron">▼</span>
          </div>
          <div className="tool-card-code-container">
            <div>
              {m.code && (
                <pre className="tool-card-code">{m.code}</pre>
              )}
              {pendingApproval && (
                <div className="tool-decisions">
                  <motion.button
                    style={{ background: 'var(--tool)', color: '#0b0906' }}
                    whileHover={{ filter: 'brightness(1.12)' }}
                    whileTap={{ y: 1 }}
                  >
                    Allow Once
                  </motion.button>
                  <motion.button
                    style={{ background: 'var(--violet)', color: '#241a08' }}
                    whileHover={{ filter: 'brightness(1.12)' }}
                    whileTap={{ y: 1 }}
                  >
                    Always Allow
                  </motion.button>
                  <motion.button
                    style={{ background: 'var(--danger)', color: '#fbf3e2' }}
                    whileHover={{ filter: 'brightness(1.12)' }}
                    whileTap={{ y: 1 }}
                  >
                    Decline
                  </motion.button>
                  <motion.button
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text)' }}
                    whileHover={{ filter: 'brightness(1.12)' }}
                    whileTap={{ y: 1 }}
                  >
                    Resolve
                  </motion.button>
                </div>
              )}
              {m.failed && (
                <div className="tool-decisions">
                  <motion.button
                    style={{ background: 'var(--danger)', color: '#fbf3e2' }}
                    onClick={() => onResend(m.text || '')}
                    whileHover={{ filter: 'brightness(1.12)' }}
                    whileTap={{ y: 1 }}
                  >
                    Retry
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </div>
        {attachments && attachments.length > 0 && renderAttachments(attachments)}
      </motion.div>
    );
  }

  // Thinking row
  if (role === 'thinking') {
    return (
      <motion.div
        className="msg thinking"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <div className="thinking-badge">
          <motion.span
            className="think-dot"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="think-dot"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          />
          <motion.span
            className="think-dot"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
          <span className="think-label">Reasoning</span>
          <span className="think-chevron">▼</span>
        </div>
        <div className="thinking-body">
          <div>{text}</div>
        </div>
      </motion.div>
    );
  }

  // Regular message (user / assistant)
  return (
    <motion.div
      className={`msg ${role}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {role === 'user' && <div className="role">{role}</div>}
      <div
        className="bubble-text"
        dangerouslySetInnerHTML={{
          __html: role === 'assistant' ? renderMarkdown(text || '') : text || '',
        }}
      />
      {role === 'assistant' && (
        <div className="msg-actions">
          <motion.button
            className="msg-action"
            onClick={() => copyText(text || '')}
            whileHover={{ color: 'var(--gold-hi)', borderColor: 'var(--violet-soft)' }}
            whileTap={{ scale: 0.95 }}
          >
            Copy
          </motion.button>
          <motion.button
            className="msg-action"
            onClick={() => onResend(text || '')}
            whileHover={{ color: 'var(--gold-hi)', borderColor: 'var(--violet-soft)' }}
            whileTap={{ scale: 0.95 }}
          >
            Retry
          </motion.button>
        </div>
      )}
      {attachments && attachments.length > 0 && renderAttachments(attachments)}
    </motion.div>
  );
}

function renderAttachments(atts: NonNullable<Message['attachments']>) {
  return (
    <div className="msg-attachments">
      {atts.map(a => (
        <div key={a.name} className="att-file">
          {a.name}
        </div>
      ))}
    </div>
  );
}
