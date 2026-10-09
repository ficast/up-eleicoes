import { describe, it, expect } from 'vitest';
import { parseFilters, toQuery, DEFAULT_FILTERS, isCompare, isCorrespondente } from '@/lib/filters';

const p = (q: string) => parseFilters(new URLSearchParams(q));

describe('filters', () => {
  it('usa padrões quando vazio ou inválido', () => {
    expect(p('')).toEqual(DEFAULT_FILTERS);
    expect(p('ano=1999&cargo=rei')).toEqual(DEFAULT_FILTERS);
  });
  it('cargo inválido para o tipo da eleição cai no primeiro cargo do tipo', () => {
    expect(p('ano=2024&cargo=presidente')).toMatchObject({ ano: 2024, cargo: 'prefeito' });
  });
  it('referência do mesmo tipo usa o mesmo cargo; de outro tipo usa o proporcional', () => {
    expect(p('ano=2026&cargo=senador&ref=2022')).toMatchObject({ ref: 2022, refCargo: 'senador' });
    expect(p('ano=2026&cargo=depfed&ref=2024')).toMatchObject({ ref: 2024, refCargo: 'vereador' });
    expect(p('ano=2026&cargo=depfed&ref=2024&refCargo=prefeito')).toMatchObject({ refCargo: 'prefeito' });
    expect(p('ano=2026&ref=2026').ref).toBeUndefined(); // referência igual ao ano atual é descartada
  });
  it('comparação não correspondente força votos', () => {
    const f = p('ano=2026&cargo=depfed&ref=2024&metrica=pct');
    expect(isCompare(f)).toBe(true);
    expect(isCorrespondente(f)).toBe(false);
    expect(f.metrica).toBe('votos');
    expect(p('ano=2026&cargo=depfed&ref=2022&metrica=pct').metrica).toBe('pct');
  });
  it('UF precisa ser uma das 27 brasileiras', () => {
    expect(p('uf=ZZ').uf).toBeUndefined();
    expect(p('uf=XX').uf).toBeUndefined();
    expect(p('uf=SP').uf).toBe('SP');
  });
  it('escopo exterior zera UF e município', () => {
    expect(p('escopo=exterior&uf=SP&mun=3550308')).toMatchObject({ escopo: 'exterior', uf: undefined, mun: undefined });
  });
  it('ida e volta e omissão de padrões', () => {
    const g = { ...DEFAULT_FILTERS, ano: 2024, cargo: 'vereador', ref: 2020, refCargo: 'vereador', metrica: 'pct', escopo: 'brasil', uf: 'SP', mun: 3550308 } as const;
    expect(p(toQuery(g))).toEqual(g);
    expect(toQuery(DEFAULT_FILTERS)).toBe('');
    expect(toQuery({ ...DEFAULT_FILTERS, ref: 2022, refCargo: 'presidente' })).toBe('ref=2022'); // refCargo padrão omitido
  });
});
