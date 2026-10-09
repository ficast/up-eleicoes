'use client';
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, ScatterChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
echarts.use([BarChart, ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

export type ChartOption = echarts.EChartsCoreOption;
export const baseTextStyle = { fontFamily: 'var(--font-barlow), system-ui, sans-serif' };

export interface ThemeColors { fg: string; surface: string; muted: string }
const readTheme = (): ThemeColors => {
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue('--fg').trim() || '#000000';
  const surface = cs.getPropertyValue('--surface').trim() || '#ffffff';
  // --fg a ~70% (cor sólida, que o ECharts sabe interpolar)
  const muted = fg.toLowerCase() === '#ffffff' || fg.toLowerCase() === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  return { fg, surface, muted };
};

/** Cores do tema atual, relidas quando o sistema troca claro/escuro. */
export function useThemeColors(): ThemeColors {
  const [t, setT] = useState<ThemeColors>({ fg: '#000000', surface: '#ffffff', muted: 'rgba(0,0,0,0.7)' });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setT(readTheme());
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return t;
}

type Axis = { axisLabel?: object; axisLine?: object; nameTextStyle?: object };
const themedAxis = (a: unknown, t: ThemeColors) => (a && typeof a === 'object' && !Array.isArray(a)
  ? { ...(a as Axis), axisLabel: { color: t.muted, ...(a as Axis).axisLabel }, nameTextStyle: { color: t.muted, ...(a as Axis).nameTextStyle },
      axisLine: { lineStyle: { color: t.muted } , ...(a as Axis).axisLine } }
  : a);

export function EChart({ option, height = 360, label }: { option: ChartOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const theme = useThemeColors();
  useEffect(() => {
    chart.current = echarts.init(el.current!, undefined, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null; };
  }, []);
  useEffect(() => {
    const { legend, tooltip, xAxis, yAxis, ...rest } = option as { legend?: object; tooltip?: object; xAxis?: unknown; yAxis?: unknown };
    chart.current?.setOption({
      textStyle: { ...baseTextStyle, color: theme.fg },
      ...(legend && { legend: { textStyle: { color: theme.fg }, ...legend } }),
      tooltip: { backgroundColor: theme.surface, borderColor: theme.fg, borderWidth: 2, textStyle: { ...baseTextStyle, color: theme.fg }, ...tooltip },
      ...(xAxis !== undefined && { xAxis: themedAxis(xAxis, theme) }),
      ...(yAxis !== undefined && { yAxis: themedAxis(yAxis, theme) }),
      ...rest,
    }, true);
  }, [option, theme]);
  return <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full min-w-0" />;
}
