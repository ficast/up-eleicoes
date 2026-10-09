import { describe, it, expect } from 'vitest';
import { parseCoord, parseTseIbge } from '../../scripts/etl/refs';

describe('refs', () => {
  it('converte coordenadas do TSE', () => {
    expect(parseCoord('-10,1572326')).toBeCloseTo(-10.1572326);
    expect(parseCoord('-1')).toBeNull();
    expect(parseCoord('')).toBeNull();
  });
  it('lê tabela TSE→IBGE', () => {
    const m = parseTseIbge('codigo_tse,uf,nome_municipio,capital,codigo_ibge\n1120,AC,ACRELÂNDIA,0,1200013\n');
    expect(m.get(1120)).toEqual({ ibge: 1200013, nome: 'Acrelândia' });
  });
});
