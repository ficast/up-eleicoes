import type { Metrica } from './filters';
const int = new Intl.NumberFormat('pt-BR');
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (n: number) => int.format(Math.round(n) || 0);
export const fmtPct = (n: number) => `${dec2.format(n)}%`;
export const fmtValue = (n: number, m: Metrica) => (m === 'votos' ? fmtInt(n) : fmtPct(n));
/** Arredonda primeiro e só então decide o sinal, para nunca mostrar "+0" ou "−0". */
export const fmtDelta = (n: number, m: Metrica) => {
  const r = m === 'votos' ? Math.round(n) : Math.round(n * 100) / 100;
  const s = r > 0 ? '+' : r < 0 ? '−' : '';
  return m === 'votos' ? `${s}${fmtInt(Math.abs(r))}` : `${s}${dec2.format(Math.abs(r))} p.p.`;
};
/** Escapa texto vindo dos dados para interpolar em HTML (popups e tooltips). */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
