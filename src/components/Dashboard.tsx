'use client';
import { useCallback, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Ano, MetaFile } from '@/lib/data-types';
import { isCorrespondente, parseFilters, toQuery, type Filters } from '@/lib/filters';
import { useJson, useSerie, paths } from '@/lib/load';
import { buildView } from '@/lib/view';
import { usePoints } from '@/lib/usePoints';
import { Hero } from './Hero';
import { FilterBar, tabId } from './FilterBar';
import { KpiRow } from './KpiRow';
import { Breadcrumb } from './Breadcrumb';
import { DivergingBars } from './charts/DivergingBars';
import { Scatter } from './charts/Scatter';
import { GroupedBars } from './charts/GroupedBars';
import { DataTable } from './DataTable';
import { Timeline } from './Timeline';
import { Notes } from './Notes';
import { Footer } from './Footer';
import { JoinCta } from './JoinCta';
import { Section } from './Section';

// MapLibre só existe no navegador.
const MapPanel = dynamic(() => import('./MapPanel').then((m) => m.MapPanel), {
  ssr: false,
  loading: () => <div className="h-[60vh] min-h-[420px] border-2 border-[var(--line)] bg-[var(--surface)]" />,
});

/** Eleição equivalente do mesmo tipo (mesmo cargo): 2022 ↔ 2026, 2020 ↔ 2024. */
const EQUIVALENTE: Record<Ano, Ano> = { 2020: 2024, 2022: 2026, 2024: 2020, 2026: 2022 };

const Centro = ({ children }: { children: ReactNode }) => (
  <div className="h-[50vh] grid place-items-center text-center font-display uppercase text-2xl">{children}</div>
);

export function Dashboard() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);
  const set = useCallback((p: Partial<Filters>) => {
    const q = toQuery({ ...f, ...p });
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [f, router, pathname]);

  const metaQ = useJson<MetaFile>(paths.meta);
  const meta = metaQ.data;
  const atual = useSerie(meta, f.ano, f.cargo);
  const ref = useSerie(meta, f.ref, f.refCargo);
  const loading = metaQ.loading || atual.loading || ref.loading;
  const v = useMemo(() => buildView(f, atual.data ?? undefined, ref.data ?? undefined), [f, atual.data, ref.data]);
  const munRow = f.mun ? [atual.data, ref.data].flatMap((d) => d?.municipios ?? []).find((m) => m.ibge === f.mun) : undefined;
  const points = usePoints(f, munRow?.tse, atual.data ?? undefined, ref.data ?? undefined);
  const equivalente = EQUIVALENTE[f.ano];
  const temEquivalente = !!meta && (meta.disponivel[equivalente] ?? []).includes(f.cargo);

  return (
    <>
      <Hero geradoEm={meta?.geradoEm} />
      <FilterBar f={f} set={set} meta={meta} />
      <main id="painel" role="tabpanel" aria-labelledby={tabId(f.tela)} aria-busy={loading}
        className="mx-auto max-w-7xl px-4 py-8 space-y-10">
        {!metaQ.loading && !meta ? (
          <Centro>Os dados ainda não foram publicados. Volte em breve.</Centro>
        ) : f.tela === 'linha' ? (
          meta && <Timeline meta={meta} escopo={f.escopo} onPick={(ano, cargo) => set({ tela: 'mapa', ano, cargo, ref: undefined, refCargo: undefined })} />
        ) : loading ? (
          <Centro><span className="animate-pulse">Carregando votos…</span></Centro>
        ) : (
          <>
            {!v.aviso && <KpiRow v={v} />}
            {v.nota && (
              <p role="status" className="text-sm">
                <span className="inline-block bg-amarelo text-preto px-1.5 font-display font-bold uppercase mr-2">Atenção</span>{v.nota}
              </p>
            )}
            <Section title={v.compare ? 'Onde crescemos e onde caímos' : 'Mapa dos votos'}>
              <Breadcrumb f={f} set={set} munNome={munRow?.nome} />
              <MapPanel v={v} f={f} set={set} points={points} />
              {f.escopo !== 'exterior' && !f.uf && <p className="text-sm text-[var(--muted)]">Clique em um estado para ver os municípios{!v.compare || isCorrespondente(f) ? ' e os locais de votação' : ''}.</p>}
            </Section>
            {!v.aviso && (
              <div className="grid gap-10 lg:grid-cols-2">
                <Section title={v.compare ? 'Maiores ganhos e quedas' : 'Onde mais votamos'}><DivergingBars v={v} metrica={f.metrica} /></Section>
                {v.compare
                  ? <Section title="Lugar a lugar"><Scatter v={v} metrica={f.metrica} /><p className="text-sm text-[var(--muted)]">Acima da linha tracejada: a UP cresceu.</p></Section>
                  : <Section title="Compare com outra eleição">
                      <p>Use <b>Comparar com</b> na barra de filtros para ver onde a UP cresceu: a mesma disputa em outro ano (ex.: 2022 × 2026) ou, só em número de votos, eleições diferentes (ex.: Vereador 2024 × Dep. Federal 2026).</p>
                      {temEquivalente && (
                        <button type="button" className="mt-3 px-3 py-2 border-2 border-[var(--line)] font-display uppercase font-bold hover:bg-[var(--band)]" onClick={() => set({ ref: equivalente, refCargo: undefined })}>
                          Comparar com {equivalente}
                        </button>
                      )}
                    </Section>}
                {v.compare && <div className="lg:col-span-2 min-w-0"><Section title={f.escopo === 'exterior' ? 'Por país' : f.uf ? `Municípios de ${f.uf}` : 'Por estado'}><GroupedBars v={v} metrica={f.metrica} /></Section></div>}
              </div>
            )}
            {!v.aviso && <Section title="Todos os dados"><DataTable v={v} metrica={f.metrica} /></Section>}
          </>
        )}
        <div className="flex justify-center py-6"><JoinCta /></div>
      </main>
      <Notes />
      <Footer />
      <div className="fixed bottom-3 right-3 z-40 lg:hidden"><JoinCta size="sm" /></div>
    </>
  );
}
