import { useState, useRef, useEffect } from 'react';
import type { ModelInfo } from '../lib/types';

interface ModelPickerProps {
  models: ModelInfo[];
  selected: string;
  onChange: (model: string) => void;
}

export function ModelPicker({ models, selected, onChange }: ModelPickerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const providerForModel = (value: string, label: string): string => {
    const provider = String(value || '').split('/')[0].toLowerCase();
    if (provider === 'anthropic' || label.toLowerCase().includes('claude')) return 'CL';
    if (provider === 'google' || label.toLowerCase().includes('gemini')) return 'G';
    if (provider === 'openai' || label.toLowerCase().includes('gpt')) return '';
    if (provider === 'minimax') return 'M';
    return 'AI';
  };

  const providerIcon = (value: string, label: string): string => {
    const id = String(value || '').toLowerCase();
    const name = String(label || '').toLowerCase();
    if (id.startsWith('openai/') || name.includes('gpt')) return 'https://cdn.simpleicons.org/openai/ffffff';
    if (id.startsWith('anthropic/') || name.includes('claude')) return 'https://cdn.simpleicons.org/anthropic/ffffff';
    if (id.startsWith('google/') || name.includes('gemini')) return 'https://cdn.simpleicons.org/googlegemini/ffffff';
    if (id.startsWith('minimax/') || name.includes('minimax')) return 'https://cdn.simpleicons.org/minimax/ffffff';
    return '';
  };

  const providerBadge = (value: string, label: string): string => {
    const icon = providerIcon(value, label);
    return icon
      ? `<span class="provider-badge"><img src="${icon}" alt="" onerror="this.parentElement.textContent='${providerForModel(value, label)}'" /></span>`
      : `<span class="provider-badge">${providerForModel(value, label)}</span>`;
  };

  const updateModelContext = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('nano') || lower.includes('flash')) return 'Best for fast, lightweight tasks';
    if (lower.includes('opus') || lower.includes('sol')) return 'Best for complex coding and architecture';
    if (lower.includes('claude')) return 'Best for careful code review and refactors';
    if (lower.includes('gemini')) return 'Best for broad context and exploration';
    return 'Best for balanced Roblox Studio work';
  };

  const selectedOption = models.find(m => m.id === selected) || models[0];
  const contextText = selectedOption ? updateModelContext(selectedOption.label || selectedOption.name || '') : 'Default model';

  return (
    <div className="model-picker-wrap">
      <div className="model-menu" ref={menuRef}>
        <button
          type="button"
          id="model-menu-trigger"
          className="model-menu-trigger"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span
            className="provider-badge"
            dangerouslySetInnerHTML={{ __html: providerBadge(selectedOption?.id || '', selectedOption?.label || '') }}
          />
          <span id="model-menu-label">{selectedOption ? (selectedOption.label || selectedOption.name) : 'Default model'}</span>
        </button>
        {menuOpen && (
          <div id="model-menu-list" className="model-menu-list">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`model-option ${m.id === selected ? 'selected' : ''}`}
                data-model={m.id}
                onClick={() => {
                  onChange(m.id);
                  setMenuOpen(false);
                }}
              >
                <span
                  className="provider-badge"
                  dangerouslySetInnerHTML={{ __html: providerBadge(m.id, m.label || '') }}
                />
                <span>
                  <strong>{m.label || m.name || m.id}</strong>
                  <small>{m.id ? 'Provider model' : 'Automatic selection'}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span id="model-context" className="text-[var(--text-faint)] text-[9px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[190px]">
        {contextText}
      </span>
    </div>
  );
}
