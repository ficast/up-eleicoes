import { PALETTE, seqColor, divColor, divInverse, divLegendTicks } from '@/lib/colors';
import { fmtDelta, fmtValue } from '@/lib/format';
import type { Metrica } from '@/lib/filters';

const Swatch = ({ color }: { color: string }) => <span className="inline-block size-2.5 border border-preto align-middle" style={{ background: color }} />;

/** 7 amostras uniformes em t (symlog no modo comparação): cada amostra ocupa a mesma largura da barra. */
function swatches(max: number, compare: boolean, metrica: Metrica): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    if (!compare) return seqColor((i / 6) * max || 0.0001, max);
    const s = (i / 3) - 1; // −1..1
    return divColor(Math.sign(s) * divInverse(Math.abs(s), max, metrica), max, metrica);
  });
}

export function MapLegend({ max, compare, metrica }: { max: number; compare: boolean; metrica: Metrica }) {
  const colors = swatches(max, compare, metrica);
  const ticks = compare ? divLegendTicks(max, metrica) : [];
  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--line)] p-2 text-xs w-48 sm:w-56">
      <div className="flex h-3" aria-hidden>{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
      {compare ? (
        <div className="num relative h-4 mt-1">
          {ticks.map((t, i) => (
            <span key={i} className="absolute whitespace-nowrap"
              style={i === 0 ? { left: 0 } : i === ticks.length - 1 ? { right: 0 } : { left: `${t.pos * 100}%`, transform: 'translateX(-50%)' }}>
              {t.value === 0 ? '0' : fmtDelta(t.value, metrica)}
            </span>
          ))}
        </div>
      ) : (
        <div className="num flex justify-between mt-1"><span>0</span><span>{fmtValue(max, metrica)}</span></div>
      )}
      {compare && (
        <div className="flex justify-between mt-1 font-display uppercase">
          <span><Swatch color={PALETTE.caiu} /> caiu</span><span>cresceu <Swatch color={PALETTE.cresceu} /></span>
        </div>
      )}
    </div>
  );
}
