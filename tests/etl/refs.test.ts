import { describe, it, expect } from 'vitest';
import { loadTotalizados, parseCoord, parseTseIbge } from '../../scripts/etl/refs';
import { mkZip } from './zip-helper';

describe('refs', () => {
  it('converte coordenadas do TSE', () => {
    expect(parseCoord('-10,1572326')).toBeCloseTo(-10.1572326);
    expect(parseCoord('-1')).toBeNull();
    expect(parseCoord('')).toBeNull();
  });
  it('loadTotalizados: candidatos da UP válidos ou sub judice (1º turno), e suas unidades', async () => {
    const H = '"NR_TURNO";"SG_UF";"CD_MUNICIPIO";"CD_CARGO";"SQ_CANDIDATO";"NR_PARTIDO";"NM_TIPO_DESTINACAO_VOTOS"\n';
    const { zip } = mkZip({
      'votacao_candidato_munzona_2024_CE.csv': H
        + '1;"CE";13897;13;101;80;"Válido"\n'
        + '1;"CE";13897;13;102;80;"Anulado sub judice"\n'
        + '1;"CE";13897;13;103;80;"Anulado"\n'
        + '1;"CE";13897;13;104;80;"Válido (legenda)"\n'
        + '1;"CE";14478;13;105;80;"Anulado"\n'            // município com chapa toda anulada
        + '1;"CE";14478;11;106;80;"Válido"\n'
        + '2;"CE";13897;11;107;80;"Válido"\n'             // 2º turno: ignora
        + '1;"CE";13897;13;201;13;"Válido"\n',            // outro partido
      'votacao_candidato_munzona_2024_BRASIL.csv': H + '1;"CE";13897;13;999;80;"Válido"\n',
    });
    const t = await loadTotalizados(zip);
    expect([...t.candidatos].sort()).toEqual(['101', '102', '104', '106']);
    expect([...t.unidades].sort()).toEqual(['prefeito|CE-14478', 'vereador|CE-13897']);
  });
  it('lê tabela TSE→IBGE', () => {
    const m = parseTseIbge('codigo_tse,uf,nome_municipio,capital,codigo_ibge\n1120,AC,ACRELÂNDIA,0,1200013\n');
    expect(m.get(1120)).toEqual({ ibge: 1200013, nome: 'Acrelândia' });
  });
});
