'use client';
import { useMemo } from 'react';
import { ANOS, CARGOS, CARGO_LABEL, TIPO, type Ano, type Cargo, type MetaFile } from '@/lib/data-types';
import type { Escopo } from '@/lib/filters';
import { timelineRows } from '@/lib/timeline';
import { CARGO_COLOR } from '@/lib/colors';
import { fmtInt } from '@/lib/format';
import { EChart, useThemeColors } from './charts/EChart';
import { downloadCsv } from './DataTable';
import { Section } from './Section';

export function Timeline({ meta, escopo, onPick }: { meta: MetaFile; escopo: Escopo; onPick: (ano: Ano, cargo: Cargo) => void }) {
  const rows = useMemo(() => timelineRows(meta, escopo), [meta, escopo]);
  const cargos = useMemo(() => CARGOS.filter((c) => rows.some((r) => r.cargo === c)), [rows]);
  const anos = useMemo(() => ANOS.filter((a) => rows.some((r) => r.ano === a)), [rows]);

  const { fg } = useThemeColors();
  const option = useMemo(() => ({
    grid: { left: 8, right: 8, top: 56, bottom: 8, containLabel: true },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x: number | null | undefined) => (typeof x === 'number' ? fmtInt(x) : 'sem candidatura') },
    xAxis: { type: 'category', data: anos.map((a) => `${a}\n${TIPO[a] === 'geral' ? 'geral' : 'municipal'}`) },
    yAxis: { type: 'value', axisLabel: { formatter: (x: number) => fmtInt(x) }, splitLine: { lineStyle: { color: '#8884' } } },
    series: cargos.map((c) => ({
      name: CARGO_LABEL[c], type: 'bar', barGap: '10%', itemStyle: { color: CARGO_COLOR[c] },
      data: anos.map((a) => {
        const r = rows.find((x) => x.ano === a && x.cargo === c);
        return r ? { value: r.votos, itemStyle: { color: CARGO_COLOR[c], borderColor: r.proporcional ? fg : 'transparent', borderWidth: r.proporcional ? 2 : 0 } } : null;
      }),
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: { value: number }) => (p.value ? fmtInt(p.value) : '') },
    })),
  }), [rows, cargos, anos, fg]);

  if (!rows.length) return <p className="font-display uppercase text-xl">Ainda não há totais publicados para este recorte.</p>;

  return (
    <div className="space-y-10">
      <Section title="A UP de 2020 a 2026">
        <p className="max-w-3xl">Votos da Unidade Popular em cada eleição, cargo a cargo. Cada eleitor vota em vários cargos, então não somamos: compare as barras do mesmo tipo de cargo. Barra com contorno = cargo proporcional (Vereador / Dep. Federal), o melhor termômetro do tamanho do partido.</p>
        <EChart option={option} height={440} label="Votos da UP por eleição e cargo" />
      </Section>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {anos.map((a) => {
          const prop = rows.find((r) => r.ano === a && r.proporcional);
          const maj = rows.filter((r) => r.ano === a && r.total.candidatos.length);
          return (
            <div key={a} className="border-2 border-[var(--line)] p-4 bg-[var(--surface)]">
              <p className="font-display uppercase text-xs tracking-widest">{TIPO[a] === 'geral' ? 'Eleição geral' : 'Eleição municipal'}</p>
              <p className="font-display font-extrabold text-4xl">{a}</p>
              {prop && <p className="num mt-2"><b className="font-display text-2xl">{fmtInt(prop.votos)}</b> votos para {CARGO_LABEL[prop.cargo]}</p>}
              {prop && <p className="num text-sm text-[var(--muted)]">{fmtInt(prop.total.unidadesComCandidatura)} {TIPO[a] === 'geral' ? 'UFs' : 'municípios'} com candidatura · {fmtInt(prop.total.municipiosComVoto)} municípios com voto</p>}
              {maj.map((r) => <p key={r.cargo} className="text-sm mt-1">{CARGO_LABEL[r.cargo]}: {r.total.candidatos.slice(0, 2).join(', ')}{r.total.candidatos.length > 2 ? ` +${r.total.candidatos.length - 2}` : ''}</p>)}
            </div>
          );
        })}
      </div>

      <Section title="Tabela">
        <div className="border-2 border-[var(--line)] bg-[var(--surface)] overflow-auto">
          <table className="w-full text-sm num">
            <thead className="border-b-2 border-[var(--line)]"><tr>
              {['Eleição', 'Cargo', 'Votos', 'Unidades com candidatura', 'Municípios com voto'].map((h) => <th key={h} scope="col" className="text-left p-2 font-display uppercase">{h}</th>)}
              <th scope="col"><span className="sr-only">Ação</span></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.ano}-${r.cargo}`} className="border-b border-[var(--line)]/20">
                  <td className="p-2">{r.ano}</td>
                  <td className="p-2">{CARGO_LABEL[r.cargo]}{r.proporcional ? <span title="cargo proporcional"> ★</span> : ''}</td>
                  <td className="p-2 font-semibold">{fmtInt(r.votos)}</td>
                  <td className="p-2">{fmtInt(r.total.unidadesComCandidatura)}</td>
                  <td className="p-2">{fmtInt(r.total.municipiosComVoto)}</td>
                  <td className="p-2 whitespace-nowrap"><button type="button" className="underline underline-offset-4" onClick={() => onPick(r.ano, r.cargo)}>ver no mapa →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="px-3 py-1 border-2 border-[var(--line)] font-display uppercase font-bold"
          onClick={() => downloadCsv('up-linha-do-tempo.csv', ['ano', 'cargo', 'votos', 'unidades_com_candidatura', 'municipios_com_voto'],
            rows.map((r) => [r.ano, CARGO_LABEL[r.cargo], r.votos, r.total.unidadesComCandidatura, r.total.municipiosComVoto]))}>Baixar CSV</button>
      </Section>
    </div>
  );
}
