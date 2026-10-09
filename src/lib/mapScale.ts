import { divColor, niceRound, PALETTE, seqColor } from './colors';
import type { Filters, Metrica } from './filters';

/** Zoom a partir do qual os locais de votação aparecem numa UF sem município escolhido. */
export const POINTS_ZOOM = 8;

/** Escala de cor do mapa: a mesma instância pinta a camada e desenha a legenda. */
export interface MapScale {
  max: number; compare: boolean; metrica: Metrica;
  color: (x?: { value: number; delta: number | null }) => string;
}

export function makeScale(items: { value: number; delta: number | null }[], compare: boolean, metrica: Metrica): MapScale {
  let max = 0;
  for (const x of items) { const v = compare ? Math.abs(x.delta ?? 0) : x.value; if (Number.isFinite(v) && v > max) max = v; }
  return {
    max, compare, metrica,
    color: (x) => (!x ? PALETTE.zero : compare ? divColor(x.delta ?? 0, max, metrica) : seqColor(x.value, max)),
  };
}

/**
 * Qual camada carrega a cor (e portanto a legenda): os locais de votação quando estão visíveis
 * (município escolhido, ou UF com zoom ≥ POINTS_ZOOM) e existem; senão as áreas.
 * No exterior as cidades usam a escala dos países (uma só legenda).
 */
export function colorLayer(f: Pick<Filters, 'escopo' | 'uf' | 'mun'>, zoom: number, nPoints: number): 'areas' | 'points' {
  if (f.escopo === 'exterior' || nPoints === 0) return 'areas';
  return f.mun || (f.uf && zoom >= POINTS_ZOOM) ? 'points' : 'areas';
}

/** Título da legenda. */
export function legendTitle(layer: 'areas' | 'points', f: Pick<Filters, 'escopo' | 'uf' | 'mun'>, munNome?: string, comExterior = false): string {
  if (f.escopo === 'exterior') return 'Países';
  if (layer === 'points') return `Locais de votação em ${f.mun && munNome ? munNome : f.uf}`;
  return f.uf ? `Municípios de ${f.uf}` : comExterior ? 'Estados e exterior' : 'Estados';
}

/** Raio do círculo (px) — espelha a expressão 'circle-radius' do MapLibre (linear em √votos, limitada). */
export function circleRadius(up: number): number {
  const s = Math.sqrt(Math.max(0, up));
  if (s <= 10) return 2 + 0.6 * s;
  if (s <= 40) return 8 + ((s - 10) * 14) / 30;
  return 22;
}
/** Expressão MapLibre equivalente a circleRadius. */
export const CIRCLE_RADIUS_EXPR = ['interpolate', ['linear'], ['sqrt', ['get', 'up']], 0, 2, 10, 8, 40, 22];

/** Valores de exemplo para a chave de tamanho dos círculos (votos), do menor ao maior. */
export function sizeKey(maxUp: number): number[] {
  if (!Number.isFinite(maxUp) || maxUp < 1) return [];
  const big = Math.max(1, Math.round(niceRound(maxUp)));
  const small = Math.round(niceRound(big / 10));
  return small >= 1 && small < big ? [small, big] : [big];
}
