'use client';
import { useJson, paths } from '@/lib/load';
import type { MetaFile } from '@/lib/data-types';

/** Data de geração dos dados (meta.json), lida no cliente: o restante do Hero é HTML estático. */
export function GeradoEm() {
  const meta = useJson<MetaFile>(paths.meta).data;
  if (!meta?.geradoEm) return null;
  return <p className="mx-auto max-w-7xl px-4 pb-4 text-sm text-[var(--muted)]">Dados: TSE · atualizados em {new Date(meta.geradoEm).toLocaleDateString('pt-BR')}</p>;
}
