'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Ano, Cargo, CargoAnoFile, LocaisInfoFile, LocaisVotosFile, MetaFile } from './data-types';

/** `data: null, error: false` = arquivo inexistente (404, ex.: sem candidatura); `error: true` = falha (rede, servidor, JSON inválido). */
export interface Loaded<T> { data: T | null; error: boolean }

const cache = new Map<string, Promise<Loaded<unknown>>>();
/** Busca JSON com cache em memória. 404 fica em cache; falhas não (nova tentativa depois). */
export function fetchJson<T>(path: string): Promise<Loaded<T>> {
  if (!cache.has(path)) {
    const fail = (): Loaded<unknown> => { cache.delete(path); return { data: null, error: true }; };
    cache.set(path, fetch(path)
      .then(async (r): Promise<Loaded<unknown>> => {
        if (r.ok) return { data: await r.json(), error: false };
        return r.status === 404 ? { data: null, error: false } : fail();
      })
      .catch(fail));
  }
  return cache.get(path) as Promise<Loaded<T>>;
}

export interface JsonState<T> extends Loaded<T> { loading: boolean; retry: () => void }

/** Carrega `path` (ou nada, se null). `loading` é true enquanto o dado corrente não chegou. */
export function useJson<T>(path: string | null): JsonState<T> {
  const [state, set] = useState<{ key: string | null } & Loaded<T>>({ key: null, data: null, error: false });
  const [tentativa, setTentativa] = useState(0);
  const key = path && `${tentativa}|${path}`;
  useEffect(() => {
    let on = true;
    if (path) fetchJson<T>(path).then((r) => on && set({ key, ...r }));
    return () => { on = false; };
  }, [path, key]);
  const retry = useCallback(() => setTentativa((n) => n + 1), []);
  const cur = state.key === key;
  return { data: cur ? state.data : null, error: cur && state.error, loading: !!path && !cur, retry };
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
