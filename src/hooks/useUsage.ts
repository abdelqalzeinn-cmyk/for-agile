/* ============================================================
   useUsage — ports usagePctField, usageResetAt, fmtCountdown,
   usageBarColor, renderUsagePanel, tickUsageTimers, fetchUsage
   ============================================================ */
import { useEffect, useState, useCallback } from 'react';
import type { UsageData } from '../lib/types';
import { getWorkspace } from '../lib/api';

export function usagePctField(u: UsageData, period: 'daily' | 'weekly' | 'monthly'): number {
  if (period === 'daily') return Number(u.daily_usage_percent || 0);
  if (period === 'weekly') return Number(u.weekly_usage_percent || 0);
  return Number(u.monthly_usage_percent || u.usage_percent || 0);
}

export function usageResetAt(u: UsageData, period: 'daily' | 'weekly' | 'monthly'): number | null {
  let raw = period === 'daily' ? u.daily_window_end
    : period === 'weekly' ? u.weekly_window_end
    : (u.usage_period_end || u.current_period_end);
  raw = raw || u.reset_at || u.usage_reset_at;
  if (raw == null) return null;
  if (typeof raw === 'number') return Math.floor(raw);
  if (typeof raw === 'string' && raw.length) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw);
    if (m) return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 1000);
    const t = Date.parse(raw);
    if (!isNaN(t)) return Math.floor(t / 1000);
  }
  return null;
}

export function fmtCountdown(sec: number): string {
  if (sec <= 0) return 'ready';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function usageBarColor(pct: number): string {
  if (pct >= 90) return '#e2554f';
  if (pct >= 60) return '#e8b923';
  return '#5fb888';
}

export interface UsageRow {
  label: string;
  pct: number;
  color: string;
  timer: string;
  active: boolean;
  left: number;
}

export function renderUsageRows(u: UsageData | null): UsageRow[] {
  if (!u) return [];
  const periods: { key: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];
  return periods.map(p => {
    const pct = usagePctField(u, p.key);
    const at = usageResetAt(u, p.key);
    const active = pct > 1 && at != null;
    const now = Math.floor(Date.now() / 1000);
    const left = active ? Math.max(0, at! - now) : 0;
    const color = usageBarColor(pct);
    const timer = active
      ? `\u21bb ${fmtCountdown(left)}`
      : (pct > 1 ? 'reset time unknown' : 'idle (<1%)');
    return { label: p.label, pct, color, timer, active, left };
  });
}

export function useUsage(isPanelOpen: boolean) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async (token?: string | null) => {
    if (token === null) return;
    try {
      const data = await getWorkspace() as Record<string, unknown>;
      if (data && data.usage && typeof data.usage === 'object') {
        setUsage(data.usage as UsageData);
      }
    } catch { /* transient / unsupported on some plans */ }
  }, []);

  // Live countdown timer — only when panel is open (matches source)
  useEffect(() => {
    if (!isPanelOpen) return;
    const interval = setInterval(() => {
      // Force re-render to update countdown
      setUsage(u => u ? { ...u } : u);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPanelOpen]);

  return { usage, fetchUsage, renderUsageRows, usagePctField, usageBarColor };
}
