import { describe, it, expect } from 'vitest';
import { rollup, type Refs } from '../../scripts/etl/rollup';
import type { SecAcc } from '../../scripts/etl/aggregate';

const sec = (o: Partial<SecAcc>): SecAcc => ({ cargo: 'presidente', uf: 'SP', tse: 71072, munNome: 'SÃO PAULO', zona: 1, secao: 1, local: 10, localNome: 'ESCOLA', up: 1, validos: 10, ...o });
const refs: Refs = {
  tseIbge: new Map([[71072, { ibge: 3550308, nome: 'São Paulo' }]]),
  locais: new Map([['71072-1-10', { lat: -23.5, lon: -46.6 }]]),
  centroides: new Map([[3550308, [-46.63, -23.55]]]),
  exterior: new Map([[29955, { iso3: 'PRT', isoNum: '620', pais: 'Portugal', nome: 'Lisboa', lat: 38.72, lon: -9.14 }]]),
};

describe('rollup', () => {
  it('agrega por local, município e UF', () => {
    const r = rollup([sec({}), sec({ secao: 2, up: 2, validos: 20 }), sec({ local: 11, secao: 3, up: 0, validos: 5 })], refs);
    expect(r.ufs).toEqual([{ uf: 'SP', up: 3, validos: 35 }]);
    expect(r.municipios).toEqual([{ ibge: 3550308, tse: 71072, uf: 'SP', nome: 'São Paulo', up: 3, validos: 35 }]);
    const sp = r.locaisPorUf.get('SP')!;
    expect(sp.votos.rows).toEqual([['71072-1-10', 3, 30], ['71072-1-11', 0, 5]]);
    expect(sp.votos.secoes).toEqual({ '71072-1-10': [[1, 1, 10], [2, 2, 20]] });
    expect(sp.info['71072-1-10']).toEqual(['ESCOLA', -23.5, -46.6, 0, 71072]);
    expect(sp.info['71072-1-11']).toEqual(['ESCOLA', -23.55, -46.63, 1, 71072]); // sem coord → centroide aproximado
  });
  it('agrega exterior por cidade e país', () => {
    const r = rollup([sec({ uf: 'ZZ', tse: 29955, munNome: 'LISBOA', up: 4, validos: 40 })], refs);
    expect(r.ufs).toEqual([{ uf: 'ZZ', up: 4, validos: 40 }]);
    expect(r.municipios).toEqual([]);
    expect(r.cidades).toEqual([{ tse: 29955, nome: 'Lisboa', iso3: 'PRT', pais: 'Portugal', lat: 38.72, lon: -9.14, up: 4, validos: 40 }]);
    expect(r.paises).toEqual([{ iso3: 'PRT', isoNum: '620', pais: 'Portugal', up: 4, validos: 40 }]);
  });
  it('falha se município não tem correspondência IBGE', () => {
    expect(() => rollup([sec({ tse: 1 })], refs)).toThrow(/IBGE/);
  });
});
