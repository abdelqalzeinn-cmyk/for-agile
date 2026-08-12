/* ============================================================
   MARKDOWN RENDERER — ported verbatim from renderMarkdown() in source.
   Parses fenced code blocks, headings, lists, inline code, bold/italic,
   links. Code blocks get a copy button (handled by the caller via
   the .copy-btn class + delegated click handler).
   ============================================================ */

interface FenceBlock {
  lang: string;
  code: string;
}

function esc(s: string): string {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

export function renderMarkdown(raw: string): string {
  if (!raw) return '';

  const fences: FenceBlock[] = [];
  // Replace fenced code blocks with placeholders
  // eslint-disable-next-line no-control-regex -- \u0000 used as internal fence placeholder (ported from source)
  const text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const i = fences.length;
    fences.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
    return '\u0000FENCE' + i + '\u0000';
  });

  const lines = text.split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + esc(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push('<ul>' + list.map(li => '<li>' + li + '</li>').join('') + '</ul>');
      list = [];
    }
  };

  for (const line of lines) {
    // eslint-disable-next-line no-control-regex -- \u0000 used as internal fence placeholder (ported from source)
    const f = /^\u0000FENCE(\d+)\u0000$/.exec(line.trim());
    if (f) { flushPara(); flushList(); out.push('\u0000FENCE' + f[1] + '\u0000'); continue; }

    const h = /^(#{1,6}) (.*)$/.exec(line);
    if (h) {
      flushPara(); flushList();
      const lvl = Math.min(h[1].length, 3);
      out.push('<h' + lvl + '>' + esc(h[2]) + '</h' + lvl + '>');
      continue;
    }

    const li = /^\s*[-*] (.*)$/.exec(line);
    if (li) { flushPara(); list.push(esc(li[1])); continue; }

    if (line.trim() === '') { flushPara(); flushList(); continue; }

    para.push(line);
  }
  flushPara(); flushList();

  let html = out.join('\n');
  html = html
    .replace(/`([^`]+)`/g, '<code class="inline">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // eslint-disable-next-line no-control-regex -- \u0000 used as internal fence placeholder (ported from source)
  html = html.replace(/\u0000FENCE(\d+)\u0000/g, (_m, i: string) => {
    const f = fences[+i];
    return (
      '<div class="md-pre">' +
      '<div class="md-pre-head">' +
      '<span class="lang">' + esc(f.lang || 'code') + '</span>' +
      '<button type="button" class="copy-btn" data-copy="' + encodeURIComponent(f.code) + '">' +
      'Copy</button>' +
      '</div>' +
      '<pre>' + esc(f.code) + '</pre>' +
      '</div>'
    );
  });

  return html;
}

// Copy helpers — ported from copyText/fallbackCopy
export function fallbackCopy(txt: string): void {
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* ignore */ }
  ta.remove();
}

export function copyText(txt: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
  } else {
    fallbackCopy(txt);
  }
}
