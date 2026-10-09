import type { Metrica } from './filters';
const int = new Intl.NumberFormat('pt-BR');
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (n: number) => int.format(Math.round(n));
export const fmtPct = (n: number) => `${dec2.format(n)}%`;
export const fmtValue = (n: number, m: Metrica) => (m === 'votos' ? fmtInt(n) : fmtPct(n));
export const fmtDelta = (n: number, m: Metrica) => {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return m === 'votos' ? `${s}${fmtInt(Math.abs(n))}` : `${s}${dec2.format(Math.abs(n))} p.p.`;
};
