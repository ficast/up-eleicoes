'use client';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, ScatterChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
echarts.use([BarChart, ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

export type ChartOption = echarts.EChartsCoreOption;
export const baseTextStyle = { fontFamily: 'var(--font-barlow), system-ui, sans-serif' };

const cssVar = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function EChart({ option, height = 360, label }: { option: ChartOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    chart.current = echarts.init(el.current!, undefined, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null; };
  }, []);
  useEffect(() => {
    const fg = cssVar('--fg', '#000'), bg = cssVar('--surface', '#fff');
    const { legend, tooltip, ...rest } = option as { legend?: object; tooltip?: object };
    chart.current?.setOption({
      textStyle: { ...baseTextStyle, color: fg },
      ...(legend && { legend: { textStyle: { color: fg }, ...legend } }),
      tooltip: { backgroundColor: bg, borderColor: fg, borderWidth: 2, textStyle: { ...baseTextStyle, color: fg }, ...tooltip },
      ...rest,
    }, true);
  }, [option]);
  return <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full min-w-0" />;
}
