import { PALETTE, seqColor, divColor } from '@/lib/colors';
import { fmtDelta, fmtValue } from '@/lib/format';
import type { Metrica } from '@/lib/filters';

const Swatch = ({ color }: { color: string }) => <span className="inline-block size-2.5 border border-preto align-middle" style={{ background: color }} />;

export function MapLegend({ max, compare, metrica }: { max: number; compare: boolean; metrica: Metrica }) {
  const steps = Array.from({ length: 7 }, (_, i) => i / 6);
  const colors = steps.map((t) => (compare ? divColor((t * 2 - 1) * max, max) : seqColor(t * max || 0.0001, max)));
  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--line)] p-2 text-xs w-48 sm:w-56">
      <div className="flex h-3" aria-hidden>{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
      <div className="num flex justify-between mt-1">
        {compare ? <><span>{fmtDelta(-max, metrica)}</span><span>0</span><span>{fmtDelta(max, metrica)}</span></>
                 : <><span>0</span><span>{fmtValue(max, metrica)}</span></>}
      </div>
      {compare && (
        <div className="flex justify-between mt-1 font-display uppercase">
          <span><Swatch color={PALETTE.caiu} /> caiu</span><span>cresceu <Swatch color={PALETTE.cresceu} /></span>
        </div>
      )}
    </div>
  );
}
