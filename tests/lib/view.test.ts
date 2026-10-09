import { describe, it, expect } from 'vitest';
import { buildView } from '@/lib/view';
import { DEFAULT_FILTERS, type Filters } from '@/lib/filters';
import type { Ano, Cargo, CargoAnoFile } from '@/lib/data-types';

const file = (ano: Ano, cargo: Cargo, upSP: number, upRJ: number, upLis: number | null): CargoAnoFile => ({
  ano, cargo, candidatos: ['X'], ufsComCandidatura: upLis === null ? ['RJ', 'SP'] : ['RJ', 'SP', 'ZZ'],
  ufs: [{ uf: 'RJ', up: upRJ, validos: 100 }, { uf: 'SP', up: upSP, validos: 100 }, ...(upLis === null ? [] : [{ uf: 'ZZ', up: upLis, validos: 10 }])],
  municipios: [{ ibge: 3550308, tse: 71072, uf: 'SP', nome: 'São Paulo', up: upSP, validos: 100 }, { ibge: 3304557, tse: 60011, uf: 'RJ', nome: 'Rio de Janeiro', up: upRJ, validos: 100 }],
  exterior: upLis === null ? null : { cidades: [{ tse: 29955, nome: 'Lisboa', iso3: 'PRT', pais: 'Portugal', lat: 1, lon: 1, up: upLis, validos: 10 }], paises: [{ iso3: 'PRT', isoNum: '620', pais: 'Portugal', up: upLis, validos: 10 }] },
});
const p22 = file(2022, 'presidente', 10, 5, 1), p26 = file(2026, 'presidente', 20, 2, 3);
const f = (o: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...o });

describe('buildView', () => {
  it('sem comparação: nível UF, KPIs incluem exterior no escopo tudo', () => {
    const v = buildView(f({}), p26);
    expect(v.level).toBe('uf');
    expect(v.rows.map((r) => r.id)).toEqual(['SP', 'RJ']);
    expect(v.kpis.total).toBe(25);
    expect(v.kpis.totalRef).toBeNull();
    expect(v.labelAtual).toBe('2026 · Presidente');
  });
  it('escopo brasil exclui exterior', () => {
    expect(buildView(f({ escopo: 'brasil' }), p26).kpis.total).toBe(22);
  });
  it('UF selecionada → municípios da UF', () => {
    const v = buildView(f({ uf: 'SP' }), p26);
    expect(v.level).toBe('municipio');
    expect(v.rows.map((r) => r.nome)).toEqual(['São Paulo']);
  });
  it('comparação correspondente no exterior → países com delta', () => {
    const v = buildView(f({ escopo: 'exterior', ref: 2022, refCargo: 'presidente' }), p26, p22);
    expect(v.level).toBe('pais');
    expect(v.correspondente).toBe(true);
    expect(v.rows[0]).toMatchObject({ id: 'PRT', a: { up: 1 }, b: { up: 3 }, delta: 2 });
    expect(v.kpis.total).toBe(3);
    expect(v.kpis.totalRef).toBe(1); // escopo exterior: só a UF ZZ nos dois lados
  });
  it('comparação não correspondente: só votos, sem exterior', () => {
    const ver = file(2024, 'vereador', 7, 0, null);
    const dep = file(2026, 'depfed', 9, 4, null);
    const v = buildView(f({ cargo: 'depfed', ref: 2024, refCargo: 'vereador' }), dep, ver);
    expect(v.correspondente).toBe(false);
    expect(v.rows.find((r) => r.id === 'SP')).toMatchObject({ a: { up: 7 }, b: { up: 9 }, delta: 2 });
    expect(v.labelRef).toBe('2024 · Vereador');
    expect(v.kpis.pctRef).toBeNull();
    const ext = buildView(f({ cargo: 'depfed', ref: 2024, refCargo: 'vereador', escopo: 'exterior' }), dep, ver);
    expect(ext.aviso).toMatch(/exterior/i);
  });
  it('cargo sem candidatura', () => {
    expect(buildView(f({ cargo: 'governador' }), undefined).aviso).toMatch(/não teve candidatura/);
  });
});
