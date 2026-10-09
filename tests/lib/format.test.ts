import { describe, it, expect } from 'vitest';
import { interpolateRgb } from 'd3-interpolate';
import { fmtInt, fmtPct, fmtDelta } from '@/lib/format';
import { seqColor, divColor, PALETTE } from '@/lib/colors';

it('formata pt-BR', () => {
  expect(fmtInt(122911)).toBe('122.911');
  expect(fmtPct(2.456)).toBe('2,46%');
  expect(fmtDelta(1200, 'votos')).toBe('+1.200');
  expect(fmtDelta(-0.5, 'pct')).toBe('−0,50 p.p.');
});
describe('escalas', () => {
  it('sequencial: zero é a cor de zero', () => {
    expect(seqColor(0, 100)).toBe(PALETTE.zero);
    expect(seqColor(10, 0)).toBe(PALETTE.zero);
  });
  it('divergente: extremos nas cores de caiu/cresceu, zero no neutro', () => {
    expect(divColor(10, 10)).toBe(interpolateRgb(PALETTE.neutro, PALETTE.cresceu)(1));
    expect(divColor(-10, 10)).toBe(interpolateRgb(PALETTE.caiu, PALETTE.neutro)(0));
    expect(divColor(0, 10)).toBe(interpolateRgb(PALETTE.neutro, PALETTE.cresceu)(0));
    expect(divColor(5, 0)).toBe(PALETTE.neutro);
  });
});
