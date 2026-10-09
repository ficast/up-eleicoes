import type { LocaisInfoFile } from './data-types';

export interface Joined<T, K> { key: K; a?: T; b?: T }
export function joinRows<T, K>(a: T[], b: T[], key: (x: T) => K): Joined<T, K>[] {
  const m = new Map<K, Joined<T, K>>();
  for (const x of a) m.set(key(x), { key: key(x), a: x });
  for (const x of b) { const k = key(x); const j = m.get(k) ?? { key: k }; j.b = x; m.set(k, j); }
  return [...m.values()];
}

export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ª/g, 'a').replace(/º/g, 'o')
    .toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Mapa chave2022 → chave2026: mesma chave; senão mesmo nome normalizado no mesmo município (tse). */
export function matchLocais(a: LocaisInfoFile, b: LocaisInfoFile): Map<string, string> {
  const out = new Map<string, string>();
  const usados = new Set<string>();
  for (const k of Object.keys(a)) if (b[k]) { out.set(k, k); usados.add(k); }
  const porNome = new Map<string, string>();
  for (const [k, v] of Object.entries(b)) if (!usados.has(k)) porNome.set(`${v[4]}|${normalizeName(v[0])}`, k);
  for (const [k, v] of Object.entries(a)) {
    if (out.has(k)) continue;
    const kb = porNome.get(`${v[4]}|${normalizeName(v[0])}`);
    if (kb && !usados.has(kb)) { out.set(k, kb); usados.add(kb); }
  }
  return out;
}
