import { ANOS, CARGOS_POR_TIPO, PROPORCIONAL, TIPO, type Ano, type Cargo } from './data-types';

export type Metrica = 'votos' | 'pct';
export type Escopo = 'tudo' | 'brasil' | 'exterior';
export type Tela = 'mapa' | 'linha';
export interface Filters {
  tela: Tela; ano: Ano; cargo: Cargo; ref?: Ano; refCargo?: Cargo;
  metrica: Metrica; escopo: Escopo; uf?: string; mun?: number;
}

export const DEFAULT_FILTERS: Filters = {
  tela: 'mapa', ano: 2026, cargo: 'presidente', ref: undefined, refCargo: undefined,
  metrica: 'votos', escopo: 'tudo', uf: undefined, mun: undefined,
};

export const isCompare = (f: Filters) => f.ref !== undefined;
export const isCorrespondente = (f: Filters) => isCompare(f) && f.refCargo === f.cargo;
/** Cargo de referência padrão para comparar `cargo` (de `ano`) com a eleição `ref`. */
export const defaultRefCargo = (ano: Ano, cargo: Cargo, ref: Ano): Cargo =>
  TIPO[ano] === TIPO[ref] ? cargo : PROPORCIONAL[TIPO[ref]];

const pick = <T extends string>(v: string | null, ok: readonly T[], d: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : d);
const pickAno = (v: string | null): Ano | undefined => (ANOS as readonly number[]).includes(Number(v)) ? (Number(v) as Ano) : undefined;

export function parseFilters(q: URLSearchParams): Filters {
  const ano = pickAno(q.get('ano')) ?? DEFAULT_FILTERS.ano;
  const cargosAno = CARGOS_POR_TIPO[TIPO[ano]];
  const cargo = pick(q.get('cargo'), cargosAno, ano === DEFAULT_FILTERS.ano ? DEFAULT_FILTERS.cargo : cargosAno[0]);
  const refRaw = pickAno(q.get('ref'));
  const ref = refRaw !== ano ? refRaw : undefined;
  const refCargo = ref ? pick(q.get('refCargo'), CARGOS_POR_TIPO[TIPO[ref]], defaultRefCargo(ano, cargo, ref)) : undefined;
  const escopo = pick(q.get('escopo'), ['tudo', 'brasil', 'exterior'] as const, DEFAULT_FILTERS.escopo);
  const uf = escopo !== 'exterior' && /^[A-Z]{2}$/.test(q.get('uf') ?? '') ? q.get('uf')! : undefined;
  const mun = uf && /^\d{7}$/.test(q.get('mun') ?? '') ? Number(q.get('mun')) : undefined;
  let metrica = pick(q.get('metrica'), ['votos', 'pct'] as const, DEFAULT_FILTERS.metrica);
  if (ref && refCargo !== cargo) metrica = 'votos';
  return { tela: pick(q.get('tela'), ['mapa', 'linha'] as const, 'mapa'), ano, cargo, ref, refCargo, metrica, escopo, uf, mun };
}

export function toQuery(f: Filters): string {
  const q = new URLSearchParams();
  if (f.tela !== 'mapa') q.set('tela', f.tela);
  if (f.ano !== DEFAULT_FILTERS.ano) q.set('ano', String(f.ano));
  if (f.cargo !== DEFAULT_FILTERS.cargo) q.set('cargo', f.cargo);
  if (f.ref) {
    q.set('ref', String(f.ref));
    if (f.refCargo && f.refCargo !== defaultRefCargo(f.ano, f.cargo, f.ref)) q.set('refCargo', f.refCargo);
  }
  if (f.metrica !== DEFAULT_FILTERS.metrica) q.set('metrica', f.metrica);
  if (f.escopo !== DEFAULT_FILTERS.escopo) q.set('escopo', f.escopo);
  if (f.uf) q.set('uf', f.uf);
  if (f.mun) q.set('mun', String(f.mun));
  return q.toString();
}
