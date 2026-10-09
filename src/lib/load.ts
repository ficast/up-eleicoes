'use client';
import { useEffect, useState } from 'react';
import type { Ano, Cargo, CargoAnoFile, LocaisInfoFile, LocaisVotosFile, MetaFile } from './data-types';

const cache = new Map<string, Promise<unknown>>();
export function fetchJson<T>(path: string): Promise<T | null> {
  if (!cache.has(path)) cache.set(path, fetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(path) as Promise<T | null>;
}

/** Carrega `path` (ou nada, se null). `loading` é true enquanto o dado corrente não chegou. */
export function useJson<T>(path: string | null): { data: T | null; loading: boolean } {
  const [state, set] = useState<{ path: string | null; data: T | null }>({ path: null, data: null });
  useEffect(() => {
    let on = true;
    if (path) fetchJson<T>(path).then((d) => on && set({ path, data: d }));
    return () => { on = false; };
  }, [path]);
  return { data: state.path === path ? state.data : null, loading: !!path && state.path !== path };
}

export const paths = {
  meta: '/data/meta.json',
  cargoAno: (ano: Ano, cargo: Cargo) => `/data/${ano}/${cargo}.json`,
  locaisInfo: (ano: Ano, uf: string) => `/data/${ano}/locais/${uf}.json`,
  locaisVotos: (ano: Ano, cargo: Cargo, uf: string) => `/data/${ano}/${cargo}/locais/${uf}.json`,
};

/** Arquivo de uma eleição×cargo, só se o meta diz que existe (evita 404). */
export function useSerie(meta: MetaFile | null, ano: Ano | undefined, cargo: Cargo | undefined) {
  const ok = !!meta && !!ano && !!cargo && (meta.disponivel[ano] ?? []).includes(cargo);
  return useJson<CargoAnoFile>(ok ? paths.cargoAno(ano!, cargo!) : null);
}
export type { MetaFile, LocaisInfoFile, LocaisVotosFile };
