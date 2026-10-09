import { Suspense } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { FilterBarSkeleton } from '@/components/FilterBar';
import { Hero } from '@/components/Hero';
import { Notes } from '@/components/Notes';
import { Footer } from '@/components/Footer';

/** Hero, notas e rodapé saem no HTML estático; só o painel (que lê a URL) espera o cliente. */
function DashboardSkeleton() {
  return (
    <>
      <FilterBarSkeleton />
      <div className="mx-auto max-w-7xl px-4 py-8" aria-busy>
        <div className="h-[60vh] min-h-[420px] border-2 border-[var(--line)] bg-[var(--surface)] grid place-items-center font-display uppercase text-2xl">
          <span className="animate-pulse">Carregando votos…</span>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <>
      <Hero />
      <Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense>
      <Notes />
      <Footer />
    </>
  );
}
