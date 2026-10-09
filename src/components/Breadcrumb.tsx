import { UFS, type Filters } from '@/lib/filters';

export function Breadcrumb({ f, set, munNome }: { f: Filters; set: (p: Partial<Filters>) => void; munNome?: string }) {
  const items: { label: string; go?: Partial<Filters> }[] =
    f.escopo === 'exterior' ? [{ label: 'Exterior' }] : [{ label: 'Brasil', go: { uf: undefined, mun: undefined } }];
  if (f.uf) items.push({ label: f.uf, go: { mun: undefined } });
  if (f.mun) items.push({ label: munNome ?? 'Município' });
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
      {f.escopo !== 'exterior' && !f.uf && (
        <label className="flex items-center gap-2 text-sm">
          <span className="font-display uppercase tracking-wider">Ir para o estado</span>
          <select value="" onChange={(e) => e.target.value && set({ uf: e.target.value })}
            className="border-2 border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-display uppercase">
            <option value="">UF…</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
