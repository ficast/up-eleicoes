import { describe, it, expect } from 'vitest';
import { circleRadius, colorLayer, legendTitle, makeScale, sizeKey } from '@/lib/mapScale';
import { divColor, PALETTE, seqColor } from '@/lib/colors';

describe('mapScale', () => {
  it('makeScale: max e cor da mesma escala (sequencial e divergente)', () => {
    const s = makeScale([{ value: 30, delta: null }, { value: 5, delta: null }], false, 'votos');
    expect(s.max).toBe(30);
    expect(s.color({ value: 5, delta: null })).toBe(seqColor(5, 30));
    expect(s.color(undefined)).toBe(PALETTE.zero);
    const d = makeScale([{ value: 0, delta: -12 }, { value: 0, delta: 4 }, { value: 0, delta: null }], true, 'pct');
    expect(d.max).toBe(12);
    expect(d.color({ value: 0, delta: 4 })).toBe(divColor(4, 12, 'pct'));
    expect(d.color({ value: 0, delta: null })).toBe(divColor(0, 12, 'pct'));
  });
  it('colorLayer: locais com município, ou UF com zoom alto; exterior e sem pontos = áreas', () => {
    expect(colorLayer({ escopo: 'brasil', uf: 'MG', mun: 3135 }, 5, 10)).toBe('points');
    expect(colorLayer({ escopo: 'brasil', uf: 'MG', mun: 3135 }, 5, 0)).toBe('areas');
    expect(colorLayer({ escopo: 'brasil', uf: 'SP' }, 7.9, 10)).toBe('areas');
    expect(colorLayer({ escopo: 'brasil', uf: 'SP' }, 8, 10)).toBe('points');
    expect(colorLayer({ escopo: 'brasil' }, 12, 10)).toBe('areas');
    expect(colorLayer({ escopo: 'exterior' }, 12, 10)).toBe('areas');
  });
  it('legendTitle', () => {
    expect(legendTitle('areas', { escopo: 'brasil' })).toBe('Estados');
    expect(legendTitle('areas', { escopo: 'brasil', uf: 'MG' })).toBe('Municípios de MG');
    expect(legendTitle('points', { escopo: 'brasil', uf: 'MG', mun: 3135 }, 'Itabirito')).toBe('Locais de votação em Itabirito');
    expect(legendTitle('points', { escopo: 'brasil', uf: 'SP' })).toBe('Locais de votação em SP');
    expect(legendTitle('areas', { escopo: 'exterior' })).toBe('Países');
  });
  it('circleRadius espelha a expressão do mapa', () => {
    expect(circleRadius(0)).toBe(2);
    expect(circleRadius(100)).toBe(8);
    expect(circleRadius(1600)).toBe(22);
    expect(circleRadius(1e6)).toBe(22);
  });
  it('sizeKey: dois tamanhos redondos', () => {
    expect(sizeKey(31)).toEqual([3, 30]);
    expect(sizeKey(2636)).toEqual([250, 2500]);
    expect(sizeKey(4)).toEqual([4]);
    expect(sizeKey(0)).toEqual([]);
  });
});
