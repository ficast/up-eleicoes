import type { Filters } from '@/lib/filters';

export function Breadcrumb({ f, set, munNome }: { f: Filters; set: (p: Partial<Filters>) => void; munNome?: string }) {
  const items: { label: string; go?: Partial<Filters> }[] =
    f.escopo === 'exterior' ? [{ label: 'Exterior' }] : [{ label: 'Brasil', go: { uf: undefined, mun: undefined } }];
  if (f.uf) items.push({ label: f.uf, go: { mun: undefined } });
  if (f.mun && munNome) items.push({ label: munNome });
  return (
    <nav aria-label="Navegação do mapa" className="font-display uppercase text-sm tracking-wider">
      <ol className="flex flex-wrap gap-2">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex gap-2">
              {i > 0 && <span aria-hidden>›</span>}
              {it.go && !last
                ? <button type="button" className="underline underline-offset-4" onClick={() => set(it.go!)}>{it.label}</button>
                : <span className="font-bold" aria-current={last ? 'location' : undefined}>{it.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
