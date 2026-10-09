import type { CidadeExteriorRow, LocaisInfoFile, LocaisVotosFile, MunicipioRow, PaisRow, UfRow } from '../../src/lib/data-types';
import { localKey } from '../../src/lib/data-types';
import type { SecAcc } from './aggregate';

export interface ExteriorRef { iso3: string; isoNum: string; pais: string; nome: string; lat: number | null; lon: number | null }
export interface Refs {
  tseIbge: Map<number, { ibge: number; nome: string }>;
  locais: Map<string, { lat: number; lon: number }>;
  centroides: Map<number, [number, number]>; // ibge → [lon, lat]
  exterior: Map<number, ExteriorRef>;
}
export interface RollupResult {
  ufs: UfRow[]; municipios: MunicipioRow[]; cidades: CidadeExteriorRow[]; paises: PaisRow[];
  locaisPorUf: Map<string, { info: LocaisInfoFile; votos: LocaisVotosFile }>;
}

const add = <K>(m: Map<K, { up: number; validos: number }>, k: K, s: { up: number; validos: number }, init: () => any) => {
  let t = m.get(k); if (!t) { t = init(); m.set(k, t!); }
  t!.up += s.up; t!.validos += s.validos;
};

export function rollup(secs: SecAcc[], refs: Refs): RollupResult {
  const ufs = new Map<string, UfRow>();
  const muns = new Map<number, MunicipioRow>();
  const cidades = new Map<number, CidadeExteriorRow>();
  const paises = new Map<string, PaisRow>();
  const locais = new Map<string, { uf: string; key: string; tse: number; nome: string; up: number; validos: number; secoes: [number, number, number][] }>();

  for (const s of secs) {
    add(ufs, s.uf, s, () => ({ uf: s.uf, up: 0, validos: 0 }));
    if (s.uf === 'ZZ') {
      const ref = refs.exterior.get(s.tse);
      if (!ref) throw new Error(`Cidade do exterior sem referência: ${s.tse} ${s.munNome}`);
      add(cidades, s.tse, s, () => ({ tse: s.tse, nome: ref.nome, iso3: ref.iso3, pais: ref.pais, lat: ref.lat, lon: ref.lon, up: 0, validos: 0 }));
      add(paises, ref.iso3, s, () => ({ iso3: ref.iso3, isoNum: ref.isoNum, pais: ref.pais, up: 0, validos: 0 }));
      continue;
    }
    const m = refs.tseIbge.get(s.tse);
    if (!m) throw new Error(`Município TSE ${s.tse} (${s.munNome}/${s.uf}) sem código IBGE`);
    add(muns, m.ibge, s, () => ({ ibge: m.ibge, tse: s.tse, uf: s.uf, nome: m.nome, up: 0, validos: 0 }));
    const key = localKey(s.tse, s.zona, s.local);
    let l = locais.get(key);
    if (!l) { l = { uf: s.uf, key, tse: s.tse, nome: s.localNome, up: 0, validos: 0, secoes: [] }; locais.set(key, l); }
    l.up += s.up; l.validos += s.validos;
    if (s.up > 0) l.secoes.push([s.secao, s.up, s.validos]);
  }

  const locaisPorUf = new Map<string, { info: LocaisInfoFile; votos: LocaisVotosFile }>();
  for (const l of [...locais.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    let f = locaisPorUf.get(l.uf);
    if (!f) { f = { info: {}, votos: { rows: [], secoes: {} } }; locaisPorUf.set(l.uf, f); }
    const c = refs.locais.get(l.key);
    if (c) f.info[l.key] = [l.nome, c.lat, c.lon, 0, l.tse];
    else {
      const ibge = refs.tseIbge.get(l.tse)!.ibge;
      const [lon, lat] = refs.centroides.get(ibge) ?? [NaN, NaN];
      f.info[l.key] = [l.nome, lat, lon, 1, l.tse];
    }
    f.votos.rows.push([l.key, l.up, l.validos]);
    if (l.secoes.length) f.votos.secoes[l.key] = l.secoes.sort((a, b) => a[0] - b[0]);
  }

  const byUp = <T extends { up: number }>(a: T, b: T) => b.up - a.up;
  return {
    ufs: [...ufs.values()].sort((a, b) => a.uf.localeCompare(b.uf)),
    municipios: [...muns.values()].sort((a, b) => a.ibge - b.ibge),
    cidades: [...cidades.values()].sort(byUp),
    paises: [...paises.values()].sort(byUp),
    locaisPorUf,
  };
}
