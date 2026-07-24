import { useUsage, usagePctField } from '../hooks/useUsage';
import type { UsageData } from '../lib/types';

interface UsagePanelProps {
  usage: UsageData | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function UsagePanel({ usage, isOpen, onClose, onRefresh }: UsagePanelProps) {
  const { renderUsageRows } = useUsage(isOpen);
  const rows = renderUsageRows(usage);

  // Header pill = max period %
  const maxPct = usage
    ? Math.max(
        usagePctField(usage, 'daily'),
        usagePctField(usage, 'weekly'),
        usagePctField(usage, 'monthly'),
      )
    : 0;

  return (
    <>
      {/* Header pill (plain gold text, no icon glyph) */}
      <button
        id="usage-btn"
        title="Usage"
        onClick={onClose}
        className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-dim)] cursor-pointer px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-2"
      >
        <span style={{ color: '#e8b923' }}>Usage</span>
        <span
          id="usage-pill"
          className="bg-[rgba(95,184,138,0.18)] text-[#5fb888] text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            background: maxPct >= 90 ? 'rgba(226,85,79,0.2)' : 'rgba(95,184,138,0.18)',
            color: maxPct >= 90 ? '#e2554f' : '#5fb888',
          }}
        >
          {maxPct.toFixed(0)}%
        </span>
      </button>

      {/* Modal panel */}
      {isOpen && (
        <div
          id="usage-panel"
          className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.55)] flex items-center justify-center"
          onClick={onClose}
        >
          <div
            className="w-[min(440px,92vw)] bg-[var(--chat-panel)] border border-[var(--border-color)] rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold text-[var(--text)]">Usage</div>
              <button
                id="usage-close"
                className="bg-none border-none text-[var(--text-faint)] cursor-pointer text-xl p-0.5 rounded-lg"
                onClick={onClose}
              >
                X
              </button>
            </div>

            <div id="usage-rows">
              {!usage ? (
                <div className="text-[var(--text-faint)] text-sm py-1.5">
                  No usage data yet — pair in Studio and send a message.
                </div>
              ) : (
                rows.map((row) => (
                  <div key={row.label} className="mb-3.5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12.5px] font-semibold text-[var(--text)]">{row.label}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm text-[var(--text-dim)]">{row.pct.toFixed(row.pct < 10 ? 1 : 0)}%</span>
                        <span className="font-mono text-sm" style={{ color: row.color }}>
                          {row.timer}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.75 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, row.pct)}%`, background: row.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {onRefresh && (
              <button
                id="usage-refresh"
                className="mt-3 text-xs text-[var(--text-faint)] underline cursor-pointer bg-none border-none"
                onClick={onRefresh}
              >
                Refresh usage
              </button>
            )}

            <div className="mt-3.5 text-xs text-[var(--text-faint)] leading-1.5">
              Timers start once a period passes <b>1%</b> used. Countdown to the next reset from the backend window-end.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
