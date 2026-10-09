import type { ViewModel } from '@/lib/view';
import { fmtDelta, fmtInt, fmtPct } from '@/lib/format';

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`min-w-0 p-4 border-2 border-[var(--line)] ${highlight ? 'bg-amarelo text-preto' : 'bg-[var(--surface)]'}`}>
      <p className="font-display uppercase text-xs tracking-widest">{label}</p>
      <p className="num font-display font-extrabold text-3xl sm:text-4xl md:text-5xl leading-none mt-1 break-words">{value}</p>
      {sub && <p className="num text-sm mt-1">{sub}</p>}
    </div>
  );
}

const LUGAR = { uf: 'UFs', municipio: 'municípios', pais: 'países' } as const;

export function KpiRow({ v }: { v: ViewModel }) {
  const { total, totalRef, pct, pctRef, lugaresComVoto } = v.kpis;
  const variacao = totalRef ? Math.round(((total - totalRef) / totalRef) * 100) : null;
  const n = v.candidatos.length;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi highlight label={`Votos UP · ${v.labelAtual}`} value={fmtInt(total)}
        sub={totalRef !== null ? `${fmtDelta(total - totalRef, 'votos')} vs. ${v.labelRef}` : undefined} />
      <Kpi label="% dos válidos onde disputamos" value={fmtPct(pct)}
        sub={pctRef !== null ? `${fmtDelta(pct - pctRef, 'pct')} vs. ${v.labelRef}` : undefined} />
      {v.compare
        ? <Kpi label="Variação" value={variacao === null ? '—' : `${variacao > 0 ? '+' : variacao < 0 ? '−' : ''}${Math.abs(variacao)}%`}
            sub={totalRef !== null ? `${fmtInt(totalRef)} votos em ${v.labelRef}` : undefined} />
        : <Kpi label={`${LUGAR[v.level]} com voto`} value={fmtInt(lugaresComVoto)} />}
      {n > 0
        ? <Kpi label={n === 1 ? 'Candidatura' : 'Candidaturas'} value={fmtInt(n)}
            sub={v.candidatos.slice(0, 3).join(' · ') + (n > 3 ? '…' : '')} />
        : v.compare && <Kpi label={`${LUGAR[v.level]} com voto`} value={fmtInt(lugaresComVoto)} />}
    </div>
  );
}
