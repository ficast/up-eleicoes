import { describe, it, expect } from 'vitest';
import { interpolateRgb } from 'd3-interpolate';
import { fmtInt, fmtPct, fmtDelta, esc } from '@/lib/format';
import { seqColor, divColor, PALETTE } from '@/lib/colors';

it('formata pt-BR', () => {
  expect(fmtInt(122911)).toBe('122.911');
  expect(fmtPct(2.456)).toBe('2,46%');
  expect(fmtDelta(1200, 'votos')).toBe('+1.200');
  expect(fmtDelta(-0.5, 'pct')).toBe('−0,50 p.p.');
});
it('arredonda antes de decidir o sinal e nunca imprime -0', () => {
  expect(fmtDelta(-0.3, 'votos')).toBe('0');
  expect(fmtDelta(0.3, 'votos')).toBe('0');
  expect(fmtDelta(-0.004, 'pct')).toBe('0,00 p.p.');
  expect(fmtInt(-0.4)).toBe('0');
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
  it('entradas não finitas caem nas cores neutras', () => {
    expect(seqColor(NaN, 100)).toBe(PALETTE.zero);
    expect(seqColor(5, Infinity)).toBe(PALETTE.zero);
    expect(divColor(NaN, 10)).toBe(PALETTE.neutro);
    expect(divColor(5, NaN)).toBe(PALETTE.neutro);
  });
});

describe('esc', () => {
  it('escapa HTML', () => {
    expect(esc(`E.E. "Dr. <b>" & d'Ávila`)).toBe('E.E. &quot;Dr. &lt;b&gt;&quot; &amp; d&#39;Ávila');
  });
});

it('divColor comprime grandes diferenças (symlog)', () => {
  // com escala linear, +20 num domínio de ±6738 ficaria praticamente neutro (t≈0,5015);
  // com symlog deve ficar visivelmente afastado do neutro
  expect(divColor(20, 6738)).not.toBe(divColor(0, 6738));
  expect(divColor(20, 6738)).not.toBe(divColor(6738, 6738));
});
