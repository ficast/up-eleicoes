'use client';
import { useMemo } from 'react';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE, seqColor } from '@/lib/colors';
import { fmtDelta, fmtValue } from '@/lib/format';
import { EChart } from './EChart';

/** Com comparação: 15 maiores ganhos e 15 maiores quedas; sem: 20 maiores votações. */
export function DivergingBars({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const { compare } = v;
  const data = useMemo(() => {
    if (!compare) return [...v.rows].sort((a, b) => b.value - a.value).slice(0, 20).reverse();
    const rows = v.rows.filter((r) => r.delta !== null).sort((a, b) => b.delta! - a.delta!);
    const top = rows.slice(0, 15);
    return [...top, ...rows.slice(-15).filter((r) => !top.includes(r))].reverse();
  }, [v, compare]);
  const option = useMemo(() => {
    const fmt = (x: number) => (compare ? fmtDelta(x, metrica) : fmtValue(x, metrica));
    const max = Math.max(0, ...data.map((r) => r.value));
    return {
      grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x: number) => fmt(x) },
      xAxis: { type: 'value', axisLabel: { formatter: fmt }, splitLine: { lineStyle: { color: '#8884' } } },
      yAxis: { type: 'category', data: data.map((r) => r.nome), axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 14, name: compare ? 'Variação' : metrica === 'votos' ? 'Votos' : '% válidos',
        data: data.map((r) => ({ value: compare ? r.delta : r.value, itemStyle: { color: compare ? (r.delta! >= 0 ? PALETTE.cresceu : PALETTE.caiu) : seqColor(r.value, max) } })),
        label: { show: true, position: 'right', fontSize: 11, formatter: (p: { value: number }) => fmt(p.value) },
      }],
    };
  }, [data, compare, metrica]);
  return <EChart option={option} height={Math.max(320, data.length * 22 + 40)} label={compare ? 'Maiores ganhos e quedas' : 'Maiores votações'} />;
}
