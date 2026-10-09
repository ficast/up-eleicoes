'use client';
import { useMemo } from 'react';
import type { CargoAnoFile, LocaisInfoFile, LocaisVotosFile, Tally } from './data-types';
import { isCompare, isCorrespondente, type Filters } from './filters';
import { useJson, paths } from './load';
import { joinRows, matchLocais } from './compare';
import { delta, value } from './metrics';

/** Círculo no mapa: local de votação (com UF selecionada) ou cidade do exterior. `a`/`b` ausentes = sem voto/candidatura naquele lado. */
export interface PointRow {
  id: string; nome: string; lat: number; lon: number; aprox: boolean;
  a?: Tally; b?: Tally; up: number; value: number; delta: number | null;
  /** Local sem par na outra eleição (sem delta). */
  status?: 'novo' | 'extinto';
  secoes: string;
}

const votos = (vf: LocaisVotosFile | null) => new Map((vf?.rows ?? []).map(([k, up, validos]) => [k, { up, validos }]));
const secStr = (vf: LocaisVotosFile | null, k: string) => vf?.secoes[k]?.map(([s, up]) => `${s} (${up})`).join(', ') ?? '';

/**
 * Pontos só existem fora de comparações entre cargos diferentes:
 * - locais de votação, com UF selecionada (filtrados pelo município, se houver);
 * - cidades do exterior, no escopo Exterior (só Presidente).
 */
export function usePoints(f: Filters, munTse: number | undefined, atual?: CargoAnoFile, ref?: CargoAnoFile): PointRow[] {
  const compare = isCompare(f);
  const ok = !compare || isCorrespondente(f);
  const on = ok && f.escopo !== 'exterior' && !!f.uf;
  const iA = useJson<LocaisInfoFile>(on ? paths.locaisInfo(f.ano, f.uf!) : null);
  const vA = useJson<LocaisVotosFile>(on ? paths.locaisVotos(f.ano, f.cargo, f.uf!) : null);
  const iR = useJson<LocaisInfoFile>(on && compare ? paths.locaisInfo(f.ref!, f.uf!) : null);
  const vR = useJson<LocaisVotosFile>(on && compare ? paths.locaisVotos(f.ref!, f.cargo, f.uf!) : null);
  const loading = iA.loading || vA.loading || iR.loading || vR.loading;

  const locais = useMemo(() => {
    if (!on || loading || !iA.data) return [];
    if (f.mun && !munTse) return []; // município sem linha nos dados: sem candidatura ali

    const inMun = (tse: number) => !munTse || tse === munTse;
    const va = votos(vA.data), vr = votos(vR.data);
    const inv = new Map<string, string>(); // chave atual → chave referência
    if (compare && iR.data) for (const [r, a] of matchLocais(iR.data, iA.data)) inv.set(a, r);
    const out: PointRow[] = [];
    for (const [k, [nome, lat, lon, aprox, tse]] of Object.entries(iA.data)) {
      if (!inMun(tse)) continue;
      const b = va.get(k);
      const kr = inv.get(k);
      const a = kr ? vr.get(kr) : undefined;
      if (!b && !a) continue; // local fora das unidades com candidatura
      const novo = compare && !kr;
      out.push({
        id: k, nome, lat, lon, aprox: !!aprox, a, b, up: b?.up ?? a?.up ?? 0, value: value(b, f.metrica),
        delta: compare && !novo ? delta(a, b, f.metrica) : null, status: novo ? 'novo' : undefined, secoes: secStr(vA.data, k),
      });
    }
    if (compare && iR.data) {
      const casados = new Set(inv.values());
      for (const [k, [nome, lat, lon, aprox, tse]] of Object.entries(iR.data)) {
        const a = vr.get(k);
        if (casados.has(k) || !a || !inMun(tse)) continue;
        out.push({ id: `ref:${k}`, nome, lat, lon, aprox: !!aprox, a, up: a.up, value: 0, delta: null, status: 'extinto', secoes: '' });
      }
    }
    return out;
  }, [on, loading, compare, f.metrica, f.mun, munTse, iA.data, vA.data, iR.data, vR.data]);

  const cidades = useMemo(() => {
    if (!ok || f.escopo !== 'exterior' || f.cargo !== 'presidente') return [];
    const cs = (file?: CargoAnoFile) => file?.exterior?.cidades ?? [];
    return joinRows(compare ? cs(ref) : [], cs(atual), (c) => c.tse).flatMap(({ key, a, b }): PointRow[] => {
      const c = (b ?? a)!;
      if (c.lat === null || c.lon === null) return [];
      const ta = a && { up: a.up, validos: a.validos }, tb = b && { up: b.up, validos: b.validos };
      return [{
        id: `ext:${key}`, nome: `${c.nome} (${c.pais})`, lat: c.lat, lon: c.lon, aprox: false, a: ta, b: tb,
        up: tb?.up ?? ta?.up ?? 0, value: value(tb, f.metrica), delta: compare ? delta(ta, tb, f.metrica) : null, secoes: '',
      }];
    });
  }, [ok, compare, f.escopo, f.cargo, f.metrica, atual, ref]);

  return f.escopo === 'exterior' ? cidades : locais;
}
