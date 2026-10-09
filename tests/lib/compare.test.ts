import { describe, it, expect } from 'vitest';
import { value, delta } from '@/lib/metrics';
import { joinRows, matchLocais, normalizeName } from '@/lib/compare';

describe('metrics', () => {
  it('valor e delta', () => {
    expect(value({ up: 5, validos: 200 }, 'pct')).toBeCloseTo(2.5);
    expect(value({ up: 5, validos: 0 }, 'pct')).toBe(0);
    expect(delta({ up: 5, validos: 100 }, { up: 15, validos: 100 }, 'votos')).toBe(10);
    expect(delta({ up: 5, validos: 100 }, { up: 15, validos: 100 }, 'pct')).toBeCloseTo(10);
    expect(delta(undefined, { up: 3, validos: 10 }, 'votos')).toBe(3);   // ausente = 0 votos
    expect(delta(undefined, undefined, 'votos')).toBeNull();
  });
});

describe('compare', () => {
  it('junta por chave, mantendo ausentes', () => {
    const r = joinRows([{ id: 1, up: 1, validos: 10 }], [{ id: 1, up: 2, validos: 10 }, { id: 2, up: 3, validos: 9 }], (x) => x.id);
    expect(r.map((x) => [x.key, x.a?.up, x.b?.up])).toEqual([[1, 1, 2], [2, undefined, 3]]);
  });
  it('normaliza nomes', () => {
    expect(normalizeName('E.M.E.F.  Profª  Maria José ')).toBe('emef profa maria jose');
  });
  it('nomes repetidos no mesmo município casam todos, sem reutilizar chaves', () => {
    const a = { '1-1-1': ['ESCOLA X', 0, 0, 0, 1], '1-1-2': ['Escola X', 0, 0, 0, 1] } as const;
    const b = { '1-2-7': ['ESCOLA X', 0, 0, 0, 1], '1-2-8': ['ESCOLA X', 0, 0, 0, 1] } as const;
    const m = matchLocais(a as any, b as any);
    expect(m.size).toBe(2);
    expect(new Set(m.values())).toEqual(new Set(['1-2-7', '1-2-8']));
  });
  it('casa locais por chave e, na falta, por nome no mesmo município', () => {
    const a = { '1-1-10': ['ESCOLA A', 0, 0, 0, 1], '1-1-11': ['ESCOLA B', 0, 0, 0, 1] } as const;
    const b = { '1-1-10': ['ESCOLA A', 0, 0, 0, 1], '1-2-99': ['Escola B', 0, 0, 0, 1], '1-2-50': ['ESCOLA C', 0, 0, 0, 1] } as const;
    expect(matchLocais(a as any, b as any)).toEqual(new Map([['1-1-10', '1-1-10'], ['1-1-11', '1-2-99']]));
  });
});
