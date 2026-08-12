import { useRef, useEffect, useCallback, useState } from 'react';
import type { Attachment } from '../lib/types';

interface ComposerProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onImproving?: (text: string) => Promise<string | null>;
  disabled?: boolean;
  statusText?: string;
}

export function Composer({ onSend, onImproving, disabled, statusText }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isImproving, setIsImproving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Auto-resize textarea (grows up to 160px, then scrolls)
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '24px';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  useEffect(() => { resize(); }, [resize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!text.trim() || disabled) return;
      onSend(text.trim(), attachments);
      setText('');
      setAttachments([]);
    }
    // Shift+Enter = newline (default)
  };

  const handleImprove = async () => {
    if (!text.trim() || !onImproving) return;
    setIsImproving(true);
    try {
      const improved = await onImproving(text.trim());
      if (improved) setText(improved);
    } finally {
      setIsImproving(false);
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const mime = file.type || ({
        lua: 'text/x-lua', luau: 'text/x-lua', rbxmx: 'application/xml',
        rbxlx: 'application/xml', rbxl: 'application/octet-stream',
        txt: 'text/plain', json: 'application/json',
      } as Record<string, string>)[ext] || 'application/octet-stream';
      setAttachments(prev => [...prev, { name: file.name, mime, data }]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Drag-and-drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div id="composer-wrap">
      {attachments.length > 0 && (
        <div id="attach-tray" className="show">
          {attachments.map((a, i) => (
            <span key={i} className="att-chip">
              <span className="att-name">{a.name}</span>
              <span className="att-x" onClick={() => removeAttachment(i)}>✕</span>
            </span>
          ))}
        </div>
      )}
      <form
        id="composer"
        className={dragOver ? 'drag-over' : ''}
        onSubmit={(e) => { e.preventDefault(); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          type="button"
          id="attach-btn"
          className="composer-btn"
          title="Attach photo / file"
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>
        <input
          type="file"
          id="file-input"
          ref={fileInputRef}
          accept="image/*,.lua,.luau,.rbxmx,.rbxlx,.rbxl,.txt,.json,*/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <textarea
          id="input"
          ref={textareaRef}
          className="flex-1 resize-none border-0 outline-none bg-transparent text-[var(--text)] font-sans text-sm"
          placeholder="Message the paired plugin...  (Enter to send, Shift+Enter for newline)"
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          type="button"
          id="improve-btn"
          className="composer-btn"
          title="Improve prompt"
          onClick={handleImprove}
          disabled={isImproving || !text.trim() || !onImproving}
        >
          {isImproving ? '...' : 'Improve'}
        </button>
        <button
          id="send"
          type="submit"
          disabled={!text.trim() || disabled}
          onClick={() => {
            if (text.trim() && !disabled) {
              onSend(text.trim(), attachments);
              setText('');
              setAttachments([]);
            }
          }}
        >
          Send
        </button>
      </form>
      {statusText && <div id="send-status" className="opacity-100 text-xs text-[var(--text-faint)]">{statusText}</div>}
    </div>
  );
}

