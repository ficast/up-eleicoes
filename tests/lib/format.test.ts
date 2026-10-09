import { describe, it, expect } from 'vitest';
import { interpolateRgb } from 'd3-interpolate';
import { fmtInt, fmtPct, fmtDelta, esc } from '@/lib/format';
import { seqColor, divColor, divInverse, divLegendTicks, divT, niceRound, symlogC, PALETTE } from '@/lib/colors';

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

describe('symlog divergente', () => {
  it('constante tem piso: domínio minúsculo não satura', () => {
    expect(symlogC(2, 'votos')).toBe(1);
    expect(symlogC(0.5, 'pct')).toBe(0.01);
    expect(symlogC(6738, 'votos')).toBeCloseTo(6.738);
    // ±2 votos: +1 não pode já estar perto do extremo (com c = 0,002 ficaria t≈0,9)
    expect(divT(1, 2, 'votos')).toBeLessThan(0.7);
  });
  it('divInverse inverte divT', () => {
    for (const [d, m, met] of [[20, 6738, 'votos'], [0.3, 4, 'pct'], [1, 2, 'votos']] as const) {
      expect(divInverse(divT(d, m, met), m, met)).toBeCloseTo(d, 6);
    }
    expect(divInverse(1, 6738, 'votos')).toBeCloseTo(6738, 6);
    expect(divInverse(0, 6738, 'votos')).toBe(0);
  });
  it('divColor usa a métrica', () => {
    expect(divColor(1, 2, 'votos')).not.toBe(divColor(1, 2, 'pct'));
    expect(divColor(1, 2)).toBe(divColor(1, 2, 'votos'));
  });
  it('ticks da legenda: −max, −meio, 0, +meio, +max (meio arredondado, posições em t)', () => {
    const t = divLegendTicks(6738, 'votos');
    expect(t.map((x) => x.value)).toEqual([-6738, -200, 0, 200, 6738]);
    expect(t[0].pos).toBe(0); expect(t[2].pos).toBe(0.5); expect(t[4].pos).toBe(1);
    expect(t[3].pos).toBeCloseTo(0.5 + 0.5 * divT(200, 6738, 'votos'));
    expect(divLegendTicks(0, 'votos')).toEqual([]);
  });
  it('niceRound', () => {
    expect(niceRound(207.6)).toBe(200);
    expect(niceRound(0.137)).toBe(0.15);
    expect(niceRound(3.2)).toBe(3);
    expect(niceRound(0)).toBe(0);
  });
});
