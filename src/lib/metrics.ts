import type { Tally } from './data-types';
import type { Metrica } from './filters';
export const value = (t: Tally | undefined, m: Metrica): number =>
  !t ? 0 : m === 'votos' ? t.up : t.validos > 0 ? (t.up / t.validos) * 100 : 0;
export const delta = (a: Tally | undefined, b: Tally | undefined, m: Metrica): number | null =>
  !a && !b ? null : value(b, m) - value(a, m);
