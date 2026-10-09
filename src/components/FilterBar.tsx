'use client';
import { ANOS, CARGOS_POR_TIPO, CARGO_LABEL, TIPO, type Ano, type Cargo, type MetaFile } from '@/lib/data-types';
import { isCompare, isCorrespondente, type Filters, type Tela } from '@/lib/filters';
import { Segmented } from './Segmented';
import { JoinCta } from './JoinCta';

const tipoLabel = (a: Ano) => (TIPO[a] === 'geral' ? 'geral' : 'municipal');
export const TABS: [Tela, string][] = [['mapa', 'Mapa'], ['linha', 'Linha do tempo']];
export const tabId = (t: Tela) => `aba-${t}`;

export function FilterBar({ f, set, meta }: { f: Filters; set: (p: Partial<Filters>) => void; meta: MetaFile | null }) {
  const tem = (ano: Ano, cargo?: Cargo) => !!meta && (cargo ? (meta.disponivel[ano] ?? []).includes(cargo) : (meta.disponivel[ano] ?? []).length > 0);
  const compare = isCompare(f), corresp = isCorrespondente(f);

  return (
    <div className="lg:sticky lg:top-0 z-30 bg-[var(--bg)]/95 backdrop-blur border-b-2 border-[var(--line)]">
      <div className="mx-auto max-w-7xl px-4 pt-3 flex items-center gap-4">
        <div role="tablist" aria-label="Telas" className="flex gap-1">
          {TABS.map(([t, l]) => (
            <button key={t} id={tabId(t)} type="button" role="tab" aria-selected={f.tela === t} aria-controls="painel" onClick={() => set({ tela: t })}
              className={`px-3 sm:px-4 py-2 font-display font-extrabold uppercase text-base sm:text-lg border-2 border-b-0 border-[var(--line)] ${f.tela === t ? 'bg-[var(--fg)] text-[var(--bg)]' : 'hover:bg-[var(--band)]'}`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto hidden lg:block"><JoinCta size="sm" /></div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-3 items-end border-t-2 border-[var(--line)]">
        {f.tela === 'mapa' && <>
          <Segmented label="Eleição" value={f.ano} onChange={(ano) => set({ ano, refCargo: undefined, ref: f.ref === ano ? undefined : f.ref })}
            options={ANOS.map((a) => ({ value: a, label: String(a), disabled: !tem(a), hint: `Eleição ${tipoLabel(a)}` }))} />
          <Segmented label="Cargo" value={f.cargo} onChange={(cargo) => set({ cargo, refCargo: undefined })}
            options={CARGOS_POR_TIPO[TIPO[f.ano]].map((c) => ({ value: c, label: CARGO_LABEL[c], disabled: !tem(f.ano, c) }))} />
          <Segmented<Ano | 0> label="Comparar com" value={f.ref ?? 0} onChange={(r) => set({ ref: r === 0 ? undefined : r, refCargo: undefined })}
            options={[{ value: 0, label: 'Nenhuma' }, ...ANOS.filter((a) => a !== f.ano).map((a) => ({ value: a, label: String(a), disabled: !tem(a), hint: `Eleição ${tipoLabel(a)}` }))]} />
          {compare && (
            <Segmented label="Cargo de referência" value={f.refCargo} onChange={(refCargo) => set({ refCargo })}
              options={CARGOS_POR_TIPO[TIPO[f.ref!]].map((c) => ({ value: c, label: CARGO_LABEL[c], disabled: !tem(f.ref!, c) }))} />
          )}
          <Segmented label="Métrica" value={f.metrica} onChange={(metrica) => set({ metrica })}
            options={[{ value: 'votos', label: 'Votos' }, { value: 'pct', label: '% válidos', disabled: compare && !corresp, hint: 'Só em comparações do mesmo cargo' }]} />
        </>}
        <Segmented label="Onde" value={f.escopo} onChange={(escopo) => set({ escopo, uf: undefined, mun: undefined })}
          options={[{ value: 'tudo', label: 'Tudo' }, { value: 'brasil', label: 'Brasil' }, { value: 'exterior', label: 'Exterior' }]} />
        {f.tela === 'mapa' && compare && !corresp && (
          <p className="basis-full text-sm">
            <span className="bg-amarelo text-preto px-1 font-semibold">Comparação entre cargos diferentes</span>{' '}
            ({CARGO_LABEL[f.cargo]} {f.ano} × {CARGO_LABEL[f.refCargo!]} {f.ref}): mostramos só o número de votos, por estado e município.
          </p>
        )}
      </div>
    </div>
  );
}
