import { scaleSequentialSqrt, scaleDiverging } from 'd3-scale';
import { interpolateRgbBasis, interpolateRgb } from 'd3-interpolate';
import type { Cargo } from './data-types';

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
export const divColor = (d: number, maxAbs: number) => {
  if (!Number.isFinite(d) || !Number.isFinite(maxAbs) || maxAbs <= 0) return PALETTE.neutro;
  const s = scaleDiverging((t: number) => (t < 0.5 ? interpolateRgb(PALETTE.caiu, PALETTE.neutro)(t * 2) : interpolateRgb(PALETTE.neutro, PALETTE.cresceu)((t - 0.5) * 2)))
    .domain([-maxAbs, 0, maxAbs]).clamp(true);
  return s(d);
};
