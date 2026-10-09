import { PALETTE, seqColor, divColor, divInverse, divLegendTicks } from '@/lib/colors';
import { fmtDelta, fmtInt, fmtValue } from '@/lib/format';
import { circleRadius, sizeKey, type MapScale } from '@/lib/mapScale';

const Swatch = ({ color }: { color: string }) => <span className="inline-block size-2.5 border border-preto align-middle" style={{ background: color }} />;

/** 7 amostras uniformes em t (symlog no modo comparação): cada amostra ocupa a mesma largura da barra. */
function swatches({ max, compare, metrica }: MapScale): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    if (!compare) return seqColor((i / 6) * max || 0.0001, max);
    const s = (i / 3) - 1; // −1..1
    return divColor(Math.sign(s) * divInverse(Math.abs(s), max, metrica), max, metrica);
  });
}

/** Chave de tamanho dos círculos (votos da UP), com os mesmos raios do mapa. */
function SizeKey({ maxUp, label }: { maxUp: number; label: string }) {
  const vals = sizeKey(maxUp);
  if (!vals.length) return null;
  const h = 2 * circleRadius(vals[vals.length - 1]) + 2;
  return (
    <div className="flex items-end gap-2 mt-1.5">
      <span className="font-display uppercase self-center">{label}</span>
      {vals.map((v) => {
        const r = circleRadius(v);
        return (
          <span key={v} className="num inline-flex items-center gap-1">
            <svg width={2 * r + 2} height={h} aria-hidden><circle cx={r + 1} cy={h - r - 1} r={r} fill={PALETTE.zero} stroke="#000" /></svg>
            {fmtInt(v)}
          </span>
        );
      })}
    </div>
  );
}

export function MapLegend({ title, scale, sizes }: { title: string; scale: MapScale; sizes?: { maxUp: number; label: string } }) {
  const { max, compare, metrica } = scale;
  const colors = swatches(scale);
  const ticks = compare ? divLegendTicks(max, metrica) : [];
  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--line)] p-1.5 sm:p-2 text-[10px] sm:text-xs w-44 sm:w-56">
      <div className="font-display uppercase font-bold leading-tight mb-1 truncate" title={title}>{title}</div>
      <div className="flex h-2.5 sm:h-3" aria-hidden>{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
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
        <div className="hidden sm:flex justify-between mt-1 font-display uppercase">
          <span><Swatch color={PALETTE.caiu} /> caiu</span><span>cresceu <Swatch color={PALETTE.cresceu} /></span>
        </div>
      )}
      {sizes && <SizeKey {...sizes} />}
    </div>
  );
}
