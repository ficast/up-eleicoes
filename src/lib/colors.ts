import { scaleSequentialSqrt } from 'd3-scale';
import { interpolateRgbBasis, interpolateRgb } from 'd3-interpolate';
import type { Cargo } from './data-types';
import type { Metrica } from './filters';

export const PALETTE = {
  preto: '#000000', grafite: '#242424', branco: '#FFFFFF', cinzaClaro: '#E8E8E8', areia: '#CCC5BC',
  amarelo: '#FFC107', verde: '#2B3B2B', creme: '#EAD8BF', queimado: '#C66F2F', vermelho: '#D64444',
  roxo: '#545288', mostarda: '#DDCB6E', laranjaClaro: '#F4AA34', laranja: '#F4900C',
  ref: '#545288', atual: '#F4900C', cresceu: '#C66F2F', caiu: '#545288', neutro: '#EAD8BF', zero: '#F3EFEA',
} as const;

/** Cores por cargo (linha do tempo). Proporcionais (Dep. Federal, Vereador) em laranjas: "força do partido". */
export const CARGO_COLOR: Record<Cargo, string> = {
  presidente: PALETTE.roxo, governador: PALETTE.verde, senador: PALETTE.vermelho,
  depfed: PALETTE.laranja, depest: PALETTE.mostarda, prefeito: PALETTE.queimado, vereador: PALETTE.laranjaClaro,
};

const seq = interpolateRgbBasis([PALETTE.creme, PALETTE.laranjaClaro, PALETTE.queimado, PALETTE.verde]);
export const seqColor = (v: number, max: number) => (!Number.isFinite(v) || !Number.isFinite(max) || v <= 0 || max <= 0 ? PALETTE.zero : scaleSequentialSqrt(seq).domain([0, max])(v));
/**
 * Escala divergente symlog: uma capital com +6.000 votos não "apaga" municípios com ±20.
 * A constante escala com o domínio, com piso (1 voto / 0,01 p.p.) para domínios minúsculos não saturarem.
 */
export const symlogC = (maxAbs: number, metrica: Metrica = 'votos') => Math.max(maxAbs / 1000, metrica === 'votos' ? 1 : 0.01);
/** |d| → t em 0..1. */
export const divT = (d: number, maxAbs: number, metrica: Metrica = 'votos') => {
  const c = symlogC(maxAbs, metrica);
  return Math.min(1, Math.log1p(Math.abs(d) / c) / Math.log1p(maxAbs / c));
};
/** Inversa de divT: t em 0..1 → |d|. */
export const divInverse = (t: number, maxAbs: number, metrica: Metrica = 'votos') => {
  const c = symlogC(maxAbs, metrica);
  return c * Math.expm1(t * Math.log1p(maxAbs / c));
};
export const divColor = (d: number, maxAbs: number, metrica: Metrica = 'votos') => {
  if (!Number.isFinite(d) || !Number.isFinite(maxAbs) || maxAbs <= 0) return PALETTE.neutro;
  const t = divT(d, maxAbs, metrica);
  return d >= 0 ? interpolateRgb(PALETTE.neutro, PALETTE.cresceu)(t) : interpolateRgb(PALETTE.neutro, PALETTE.caiu)(t);
};

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];
/** Arredonda para um valor "redondo" (1; 1,5; 2; 2,5; 3; 4… × 10^k). */
export const niceRound = (x: number) => {
  if (!Number.isFinite(x) || x === 0) return 0;
  const sign = Math.sign(x), a = Math.abs(x), p = 10 ** Math.floor(Math.log10(a)), m = a / p;
  const n = NICE.reduce((b, v) => (Math.abs(v - m) < Math.abs(b - m) ? v : b));
  return sign * Number((n * p).toPrecision(12));
};

/** Rótulos da legenda divergente: −max, −meio, 0, +meio, +max; `pos` em 0..1 ao longo da barra (em t). */
export function divLegendTicks(maxAbs: number, metrica: Metrica = 'votos'): { value: number; pos: number }[] {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return [];
  let mid = niceRound(divInverse(0.5, maxAbs, metrica));
  if (metrica === 'votos') mid = Math.round(mid);
  const pos = (d: number) => 0.5 + 0.5 * Math.sign(d) * divT(d, maxAbs, metrica);
  const vals = mid > 0 && mid < maxAbs ? [-maxAbs, -mid, 0, mid, maxAbs] : [-maxAbs, 0, maxAbs];
  return vals.map((value) => ({ value, pos: value === 0 ? 0.5 : pos(value) }));
}
