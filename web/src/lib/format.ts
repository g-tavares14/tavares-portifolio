export const pad = (n: number) => String(n).padStart(2, '0');

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** 197 → "3:17" */
export const minSec = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

/** 197 → "03:17" */
export const clockSec = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

export function timeIn(timezone: string, ms: number): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '--:--:--';
  }
}

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** "2026-09-16" → "16 SET 2026"; devolve o texto original se não for uma data ISO. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d} ${MONTHS[Number(mo) - 1] ?? mo} ${y}`;
}
