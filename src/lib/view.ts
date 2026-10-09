import { CARGO_LABEL, type Ano, type Cargo, type CargoAnoFile, type MetaFile, type Tally } from './data-types';
import { isCompare, isCorrespondente, type Filters } from './filters';
import { delta, value } from './metrics';
import { joinRows } from './compare';

export type Level = 'uf' | 'municipio' | 'pais';
export interface ViewRow { id: string; nome: string; uf?: string; a?: Tally; b?: Tally; value: number; delta: number | null; isoNum?: string }
export interface ViewModel {
  level: Level; rows: ViewRow[]; aviso?: string; nota?: string;
  compare: boolean; correspondente: boolean;
  labelAtual: string; labelRef?: string;
  kpis: { total: number; totalRef: number | null; pct: number; pctRef: number | null; lugaresComVoto: number; municipiosComVoto: number };
  candidatos: string[];
}

export const serieLabel = (ano: Ano, cargo: Cargo) => `${ano} · ${CARGO_LABEL[cargo]}`;
const sum = (xs: Tally[]): Tally => xs.reduce((s, x) => ({ up: s.up + x.up, validos: s.validos + x.validos }), { up: 0, validos: 0 });

interface Base { id: string; nome: string; uf?: string; isoNum?: string; t: Tally }
/** No nível UF, o escopo 'tudo' inclui o exterior (UF 'ZZ' do TSE, só Presidente) como mais uma área. */
function rowsFor(file: CargoAnoFile | undefined, f: Filters, level: Level, escopo: Filters['escopo']): Base[] {
  if (!file) return [];
  switch (level) {
    case 'uf': return file.ufs.filter((u) => u.uf !== 'ZZ' || escopo === 'tudo')
      .map((u) => ({ id: u.uf, nome: u.uf === 'ZZ' ? 'Exterior' : u.uf, t: u }));
    case 'municipio': return file.municipios.filter((m) => m.uf === f.uf).map((m) => ({ id: String(m.ibge), nome: m.nome, uf: m.uf, t: m }));
    case 'pais': return (file.exterior?.paises ?? []).map((p) => ({ id: p.iso3, nome: p.pais, isoNum: p.isoNum, t: p }));
  }
}

function scopeTally(file: CargoAnoFile | undefined, f: Filters, escopo: Filters['escopo']): Tally | null {
  if (!file) return null;
  if (f.mun) return sum(file.municipios.filter((m) => m.ibge === f.mun));
  return sum(file.ufs
    .filter((u) => (escopo === 'exterior' ? u.uf === 'ZZ' : escopo === 'brasil' ? u.uf !== 'ZZ' : true))
    .filter((u) => !f.uf || u.uf === f.uf));
}

export function buildView(f: Filters, atual: CargoAnoFile | undefined, ref?: CargoAnoFile): ViewModel {
  const compare = isCompare(f), correspondente = isCorrespondente(f);
  const level: Level = f.escopo === 'exterior' ? 'pais' : f.uf ? 'municipio' : 'uf';
  const labelAtual = serieLabel(f.ano, f.cargo);
  const labelRef = compare ? serieLabel(f.ref!, f.refCargo!) : undefined;

  let aviso: string | undefined;
  if (f.escopo === 'exterior' && (f.cargo !== 'presidente' || (compare && f.refCargo !== 'presidente')))
    aviso = 'No exterior só se vota para Presidente (2022 e 2026). Escolha Presidente nos dois lados para ver os votos internacionais.';
  else if (!atual && !(compare && ref)) aviso = `A UP não teve candidatura para ${CARGO_LABEL[f.cargo]} em ${f.ano}.`;
  else if (f.uf && ![atual, compare ? ref : undefined].some((x) => x?.ufsComCandidatura.includes(f.uf!)))
    aviso = `A UP não teve candidatura para este cargo em ${f.uf}.`;

  // Comparação entre cargos diferentes: 'tudo' vale como 'brasil' (no exterior só se vota para Presidente).
  const escopo = compare && !correspondente && f.escopo === 'tudo' ? 'brasil' : f.escopo;
  const joined = aviso ? [] : joinRows(rowsFor(compare ? ref : undefined, f, level, escopo), rowsFor(atual, f, level, escopo), (r) => r.id);
  const rows: ViewRow[] = joined.map(({ key, a, b }) => {
    const base = (b ?? a)!;
    return {
      id: key, nome: base.nome, uf: base.uf, isoNum: base.isoNum,
      a: a ? { up: a.t.up, validos: a.t.validos } : undefined,
      b: b ? { up: b.t.up, validos: b.t.validos } : undefined,
      value: value(b?.t, f.metrica),
      delta: compare ? delta(a?.t, b?.t, f.metrica) : null,
    };
  }).sort((x, y) => (compare ? Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0) : y.value - x.value));

  const ta = scopeTally(atual, f, escopo);
  const tr = compare ? (scopeTally(ref, f, escopo) ?? { up: 0, validos: 0 }) : null;

  let nota: string | undefined;
  if (!aviso && compare) {
    if (!ref) nota = `A UP não teve candidatura para ${CARGO_LABEL[f.refCargo!]} em ${f.ref} — comparando com zero.`;
    else if (!atual) nota = `A UP não teve candidatura para ${CARGO_LABEL[f.cargo]} em ${f.ano}.`;
  }
  return {
    level, rows, aviso, nota, compare, correspondente, labelAtual, labelRef,
    kpis: {
      total: ta?.up ?? 0, totalRef: tr ? tr.up : null,
      pct: value(ta ?? undefined, 'pct'), pctRef: tr && correspondente ? value(tr, 'pct') : null,
      lugaresComVoto: rows.filter((r) => (r.b?.up ?? 0) > 0).length,
      municipiosComVoto: escopo === 'exterior' ? 0 : (atual?.municipios ?? [])
        .filter((m) => m.up > 0 && (!f.uf || m.uf === f.uf) && (!f.mun || m.ibge === f.mun)).length,
    },
    candidatos: atual?.candidatos ?? [],
  };
}

/** Eleição (atual ou de referência) ainda sem nenhum dado publicado — diferente de "sem candidatura". */
export function faltaPublicar(meta: MetaFile, f: Filters): string | undefined {
  const vazio = (ano: Ano) => !(meta.disponivel[ano] ?? []).length;
  if (vazio(f.ano)) return `Dados de ${f.ano} ainda não publicados.`;
  if (f.ref && vazio(f.ref)) return `Dados de ${f.ref} ainda não publicados.`;
}
