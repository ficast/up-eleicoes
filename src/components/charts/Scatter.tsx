'use client';
import { useMemo } from 'react';
import type { Tally } from '@/lib/data-types';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE } from '@/lib/colors';
import { value } from '@/lib/metrics';
import { fmtValue } from '@/lib/format';
import { EChart } from './EChart';

/** Referência (x) × atual (y), com diagonal de referência. Lado sem candidatura fica no zero, com "—" no tooltip. */
export function Scatter({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const option = useMemo(() => {
    const raw = (t?: Tally) => (t ? value(t, metrica) : null);
    const pts = v.rows.map((r) => ({ name: r.nome, raw: [raw(r.a), raw(r.b)] as (number | null)[] }));
    const max = Math.max(1, ...pts.flatMap((p) => p.raw.map((x) => x ?? 0)));
    const log = metrica === 'votos' && max > 1000;
    const fix = (x: number | null) => (log ? Math.max(1, x ?? 0) : x ?? 0);
    const show = (x: number | null) => (x === null ? '—' : fmtValue(x, metrica));
    return {
      grid: { left: 8, right: 24, top: 24, bottom: 32, containLabel: true },
      tooltip: { formatter: (p: { name: string; data: { raw?: (number | null)[] } }) => p.data.raw ? `<b>${p.name}</b><br>${v.labelRef}: ${show(p.data.raw[0])}<br>${v.labelAtual}: ${show(p.data.raw[1])}` : '' },
      xAxis: { type: log ? 'log' : 'value', name: v.labelRef, nameLocation: 'middle', nameGap: 28, min: log ? 1 : 0, axisLabel: { formatter: (x: number) => fmtValue(x, metrica) }, splitLine: { lineStyle: { color: '#8884' } } },
      yAxis: { type: log ? 'log' : 'value', name: v.labelAtual, min: log ? 1 : 0, axisLabel: { formatter: (x: number) => fmtValue(x, metrica) }, splitLine: { lineStyle: { color: '#8884' } } },
      series: [
        { type: 'scatter', symbolSize: 8,
          data: pts.map((p) => ({ name: p.name, raw: p.raw, value: p.raw.map(fix),
            itemStyle: { color: (p.raw[1] ?? 0) >= (p.raw[0] ?? 0) ? PALETTE.cresceu : PALETTE.caiu, opacity: 0.85, borderColor: '#000', borderWidth: 0.5 } })) },
        { type: 'line', data: [[fix(0), fix(0)], [max, max]], symbol: 'none', lineStyle: { type: 'dashed', width: 1, color: '#888' }, tooltip: { show: false }, silent: true },
      ],
    };
  }, [v, metrica]);
  return <EChart option={option} height={380} label="Dispersão: acima da diagonal, a UP cresceu" />;
}
