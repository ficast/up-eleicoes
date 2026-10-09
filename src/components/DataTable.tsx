'use client';
import { useMemo, useState } from 'react';
import type { Tally } from '@/lib/data-types';
import type { ViewModel, ViewRow } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { fmtDelta, fmtInt, fmtPct } from '@/lib/format';
import { value } from '@/lib/metrics';

type Col = 'nome' | 'a' | 'b' | 'delta';

export function downloadCsv(name: string, head: string[], lines: (string | number)[][]) {
  const body = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** `onPick`: abre o lugar no mapa (UF → municípios; município → locais). */
export function DataTable({ v, metrica, onPick }: { v: ViewModel; metrica: Metrica; onPick?: (r: ViewRow) => void }) {
  const { compare } = v;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: compare ? 'delta' : 'b', dir: -1 });
  const rows = useMemo(() => {
    // lado ausente (sem candidatura) vai para o fim em ordem decrescente
    const key = (r: ViewRow): string | number => sort.col === 'nome' ? norm(r.nome)
      : sort.col === 'a' ? (r.a ? value(r.a, metrica) : -Infinity)
      : sort.col === 'b' ? (r.b ? value(r.b, metrica) : -Infinity)
      : (r.delta ?? -Infinity);
    const nq = norm(q);
    return v.rows.filter((r) => norm(r.nome).includes(nq))
      .sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : 0) * sort.dir; });
  }, [v, q, sort, metrica]);

  const csv = () => compare
    ? downloadCsv(`up-${v.level}.csv`, ['lugar', `votos ${v.labelRef}`, `validos ${v.labelRef}`, `votos ${v.labelAtual}`, `validos ${v.labelAtual}`],
        rows.map((r) => [r.nome, r.a?.up ?? '', r.a?.validos ?? '', r.b?.up ?? '', r.b?.validos ?? '']))
    : downloadCsv(`up-${v.level}.csv`, ['lugar', 'votos', 'validos', 'pct'],
        rows.map((r) => [r.nome, r.b?.up ?? '', r.b?.validos ?? '', r.b ? value(r.b, 'pct').toFixed(4) : '']));

  const th = (col: Col, label: string) => (
    <th scope="col" className="text-left p-2 font-display uppercase tracking-wider"
      aria-sort={sort.col === col ? (sort.dir === -1 ? 'descending' : 'ascending') : undefined}>
      <button type="button" onClick={() => setSort((s) => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : -1 }))}>
        {label}{sort.col === col ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
  const cell = (t?: Tally) => t
    ? <>{fmtInt(t.up)} {v.correspondente || !compare ? <span className="text-[var(--muted)]">({fmtPct(value(t, 'pct'))})</span> : null}</>
    : <span className="text-[var(--muted)]" title="sem candidatura">—</span>;

  return (
    <div className="border-2 border-[var(--line)] bg-[var(--surface)]">
      <div className="flex gap-2 p-2 border-b-2 border-[var(--line)]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar na tabela"
          className="flex-1 min-w-0 px-2 py-1 border-2 border-[var(--line)] bg-transparent" />
        <button type="button" onClick={csv} className="px-3 py-1 border-2 border-[var(--line)] font-display uppercase font-bold whitespace-nowrap">Baixar CSV</button>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm num">
          <thead className="sticky top-0 bg-[var(--surface)] border-b-2 border-[var(--line)]">
            <tr>{th('nome', 'Lugar')}{compare ? <>{th('a', v.labelRef!)}{th('b', v.labelAtual)}{th('delta', 'Variação')}</> : th('b', 'Votos')}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)]/20">
                <td className="p-2">
                  {onPick
                    ? <button type="button" className="text-left underline underline-offset-4 decoration-[var(--muted)]" onClick={() => onPick(r)}>{r.nome}</button>
                    : r.nome}
                </td>
                {compare
                  ? <><td className="p-2">{cell(r.a)}</td><td className="p-2">{cell(r.b)}</td>
                      <td className={`p-2 font-semibold ${r.delta === null || r.delta === 0 ? '' : r.delta > 0 ? 'text-queimado' : 'text-roxo dark:text-creme'}`}>{r.delta === null ? '—' : fmtDelta(r.delta, metrica)}</td></>
                  : <td className="p-2">{cell(r.b)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm text-[var(--muted)]">Nenhum lugar encontrado.</p>}
      </div>
    </div>
  );
}
