/* ============================================================
   useKeyboardShortcuts — ports the global keydown handler:
   - Ctrl/Cmd+K: new conversation
   - Esc: close panels & menus
   Plus composer-level Enter/Shift+Enter.
   ============================================================ */
import { useEffect } from 'react';
import type { RefObject } from 'react';

interface UseKeyboardShortcutsProps {
  onNewConversation: () => void;
  onEscape: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
}

export function useKeyboardShortcuts({
  onNewConversation,
  onEscape,
  inputRef,
  onSend,
}: UseKeyboardShortcutsProps) {
  // Global shortcuts (Ctrl/Cmd+K, Esc)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onNewConversation();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        onEscape();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNewConversation, onEscape, inputRef]);

  // Composer-level Enter/Shift+Enter
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
      // Shift+Enter = newline (default behavior, do nothing)
    };
    input.addEventListener('keydown', handler);
    return () => input.removeEventListener('keydown', handler);
  }, [inputRef, onSend]);
}
