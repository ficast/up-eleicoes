import { describe, it, expect } from 'vitest';
import { timelineRows } from '@/lib/timeline';
import type { MetaFile, TotalCargo } from '@/lib/data-types';

const t = (up: number, ext = 0): TotalCargo => ({ up, validos: up * 50, upBrasil: up - ext, upExterior: ext, unidadesComCandidatura: 3, municipiosComVoto: 10, candidatos: [] });
const meta: MetaFile = { geradoEm: '', fonte: '', disponivel: {}, totais: {
  2020: { vereador: t(100), prefeito: t(40) }, 2022: { presidente: t(53519, 319), depfed: t(500) },
  2024: { vereador: t(300) }, 2026: { presidente: t(122911, 1053), depfed: t(900) },
} };

describe('timelineRows', () => {
  it('uma linha por eleição×cargo, com proporcional marcado', () => {
    const rows = timelineRows(meta, 'tudo');
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.ano === 2024 && r.cargo === 'vereador')).toMatchObject({ votos: 300, proporcional: true });
    expect(rows.find((r) => r.ano === 2022 && r.cargo === 'presidente')).toMatchObject({ votos: 53519, proporcional: false });
  });
  it('escopo exterior: só presidente', () => {
    expect(timelineRows(meta, 'exterior').map((r) => [r.ano, r.votos])).toEqual([[2022, 319], [2026, 1053]]);
  });
  it('escopo brasil desconta exterior', () => {
    expect(timelineRows(meta, 'brasil').find((r) => r.ano === 2026 && r.cargo === 'presidente')!.votos).toBe(121858);
  });
});
