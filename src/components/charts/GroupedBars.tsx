'use client';
import { useMemo } from 'react';
import type { Tally } from '@/lib/data-types';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE } from '@/lib/colors';
import { value } from '@/lib/metrics';
import { fmtValue } from '@/lib/format';
import { EChart } from './EChart';

/** Barras referência × atual por UF/município/país (máx. 30). Lado sem candidatura = sem barra ("—"). */
export function GroupedBars({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const option = useMemo(() => {
    const val = (t?: Tally) => (t ? value(t, metrica) : null);
    const peak = (r: (typeof v.rows)[number]) => Math.max(val(r.a) ?? 0, val(r.b) ?? 0);
    const rows = [...v.rows].sort((a, b) => peak(b) - peak(a)).slice(0, 30);
    return {
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x: number | null | undefined) => (typeof x === 'number' ? fmtValue(x, metrica) : '—') },
      xAxis: { type: 'category', data: rows.map((r) => r.nome), axisLabel: { rotate: rows.length > 12 ? 45 : 0, interval: 0 } },
      yAxis: { type: 'value', axisLabel: { formatter: (x: number) => fmtValue(x, metrica) }, splitLine: { lineStyle: { color: '#8884' } } },
      series: [
        { name: v.labelRef, type: 'bar', data: rows.map((r) => val(r.a)), itemStyle: { color: PALETTE.ref } },
        { name: v.labelAtual, type: 'bar', data: rows.map((r) => val(r.b)), itemStyle: { color: PALETTE.atual } },
      ],
    };
  }, [v, metrica]);
  return <EChart option={option} height={380} label={`Comparativo ${v.labelRef} e ${v.labelAtual}`} />;
}
