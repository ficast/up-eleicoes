'use client';
import { useEffect, useRef, useState } from 'react';
import { ANOS, CARGOS_POR_TIPO, CARGO_LABEL, TIPO, type Ano, type Cargo, type MetaFile } from '@/lib/data-types';
import { isCompare, isCorrespondente, type Escopo, type Filters, type Tela } from '@/lib/filters';
import { Segmented } from './Segmented';
import { JoinCta } from './JoinCta';

type Props = { f: Filters; set: (p: Partial<Filters>) => void; meta: MetaFile | null };

const tipoLabel = (a: Ano) => (TIPO[a] === 'geral' ? 'geral' : 'municipal');
export const TABS: [Tela, string][] = [['mapa', 'Mapa'], ['linha', 'Linha do tempo']];
export const tabId = (t: Tela) => `aba-${t}`;
const ESCOPO_LABEL: Record<Escopo, string> = { tudo: 'Tudo', brasil: 'Brasil', exterior: 'Exterior' };

/** Resumo da seleção atual, para a barra compacta do celular. */
function resumo(f: Filters): string {
  const onde = f.escopo === 'tudo' ? '' : ` · ${ESCOPO_LABEL[f.escopo]}`;
  if (f.tela === 'linha') return `Linha do tempo · ${ESCOPO_LABEL[f.escopo]}`;
  const ref = isCompare(f) ? ` × ${f.ref} · ${CARGO_LABEL[f.refCargo!]}` : '';
  return `${f.ano} · ${CARGO_LABEL[f.cargo]}${ref} · ${f.metrica === 'votos' ? 'Votos' : '% válidos'}${onde}`;
}

function FilterControls({ f, set, meta }: Props) {
  const tem = (ano: Ano, cargo?: Cargo) => !!meta && (cargo ? (meta.disponivel[ano] ?? []).includes(cargo) : (meta.disponivel[ano] ?? []).length > 0);
  const compare = isCompare(f), corresp = isCorrespondente(f);
  return (
    <>
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
        options={(['tudo', 'brasil', 'exterior'] as const).map((e) => ({ value: e, label: ESCOPO_LABEL[e] }))} />
      {f.tela === 'mapa' && compare && !corresp && (
        <p className="basis-full text-sm">
          <span className="bg-amarelo text-preto px-1 font-semibold">Comparação entre cargos diferentes</span>{' '}
          ({CARGO_LABEL[f.cargo]} {f.ano} × {CARGO_LABEL[f.refCargo!]} {f.ref}): mostramos só o número de votos, por estado e município.
        </p>
      )}
    </>
  );
}

/** Celular: barra fixa inferior com o resumo + botão que abre os filtros numa folha inferior (diálogo modal). */
function MobileFilters(props: Props) {
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) d.showModal(); // modal nativo: prende o foco e fecha com Esc
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
        <div className="flex justify-end px-3 pb-2"><span className="pointer-events-auto"><JoinCta size="sm" /></span></div>
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-[var(--bg)] border-t-2 border-[var(--line)]">
          <p className="num flex-1 min-w-0 truncate font-display uppercase text-sm">{resumo(props.f)}</p>
          <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
            className="shrink-0 px-3 py-1.5 bg-[var(--fg)] text-[var(--bg)] font-display font-bold uppercase">Filtros</button>
        </div>
      </div>
      <dialog ref={dlg} aria-modal="true" aria-labelledby="filtros-titulo"
        onClose={() => { setOpen(false); trigger.current?.focus(); }}
        className="m-0 mt-auto h-auto max-h-[85dvh] w-full max-w-none overflow-y-auto p-0 bg-[var(--bg)] text-[var(--fg)] border-t-2 border-[var(--line)] backdrop:bg-black/60">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-[var(--bg)] border-b-2 border-[var(--line)]">
          <h2 id="filtros-titulo" className="font-display font-extrabold uppercase text-xl">Filtros</h2>
          <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 border-2 border-[var(--line)] font-display uppercase font-bold">Fechar</button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4 px-4 py-4"><FilterControls {...props} /></div>
        <div className="px-4 pb-4">
          <button type="button" onClick={() => setOpen(false)} className="w-full px-3 py-2 bg-[var(--fg)] text-[var(--bg)] font-display font-bold uppercase">Ver resultado</button>
        </div>
      </dialog>
    </div>
  );
}

export function FilterBar(props: Props) {
  const { f, set } = props;
  return (
    <>
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
        <div className="hidden lg:flex mx-auto max-w-7xl px-4 py-3 flex-wrap gap-x-6 gap-y-3 items-end border-t-2 border-[var(--line)]">
          <FilterControls {...props} />
        </div>
      </div>
      <MobileFilters {...props} />
    </>
  );
}

/** Esqueleto estático da barra (fallback do Suspense): abas + faixa dos filtros. */
export function FilterBarSkeleton() {
  return (
    <div className="border-b-2 border-[var(--line)]" aria-hidden>
      <div className="mx-auto max-w-7xl px-4 pt-3 flex gap-1">
        {TABS.map(([t, l]) => <span key={t} className="px-3 sm:px-4 py-2 font-display font-extrabold uppercase text-base sm:text-lg border-2 border-b-0 border-[var(--line)]">{l}</span>)}
      </div>
      <div className="border-t-2 border-[var(--line)] h-14 lg:h-20" />
    </div>
  );
}
