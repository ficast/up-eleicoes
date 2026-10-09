import { describe, it, expect } from 'vitest';
import { Aggregator } from '../../scripts/etl/aggregate';

const row = (o: Partial<Record<string, string>>) => ({
  NR_TURNO: '1', SG_UF: 'SP', CD_MUNICIPIO: '71072', NM_MUNICIPIO: 'SÃO PAULO', NR_ZONA: '1', NR_SECAO: '10',
  CD_CARGO: '6', NR_VOTAVEL: '8012', NM_VOTAVEL: 'FULANA', QT_VOTOS: '3', NR_LOCAL_VOTACAO: '1015', NM_LOCAL_VOTACAO: 'ESCOLA X', ...o,
}) as Record<string, string>;

describe('Aggregator', () => {
  it('soma UP e válidos por seção, ignora 2º turno, brancos e nulos', () => {
    const a = new Aggregator();
    a.add(row({}));
    a.add(row({ NR_VOTAVEL: '80', NM_VOTAVEL: 'UNIDADE POPULAR', QT_VOTOS: '2' }));
    a.add(row({ NR_VOTAVEL: '1310', QT_VOTOS: '10' }));
    a.add(row({ NR_VOTAVEL: '95', QT_VOTOS: '4' }));
    a.add(row({ NR_VOTAVEL: '96', QT_VOTOS: '5' }));
    a.add(row({ NR_TURNO: '2', QT_VOTOS: '100' }));
    a.add(row({ CD_CARGO: '12', QT_VOTOS: '100' })); // cargo ignorado
    const s = a.sections();
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ cargo: 'depfed', uf: 'SP', tse: 71072, zona: 1, secao: 10, local: 1015, up: 5, validos: 15 });
    expect(a.candidatos('depfed')).toEqual(['FULANA']);    // legenda não entra como candidato
    expect(a.unidadesComCandidatura('depfed')).toEqual(new Set(['SP']));
  });
  it('ignora voto nominal em candidato da UP fora da totalização (nulo), mantém legenda', () => {
    const a = new Aggregator(new Set(['111']));
    a.add(row({ CD_CARGO: '13', NR_VOTAVEL: '80123', NM_VOTAVEL: 'TOTALIZADA', SQ_CANDIDATO: '111', QT_VOTOS: '3' }));
    a.add(row({ CD_CARGO: '13', NR_VOTAVEL: '80180', NM_VOTAVEL: 'CANCELADA', SQ_CANDIDATO: '222', QT_VOTOS: '7' }));
    a.add(row({ CD_CARGO: '13', NR_VOTAVEL: '80', NM_VOTAVEL: 'UNIDADE POPULAR', SQ_CANDIDATO: '-3', QT_VOTOS: '2' }));
    a.add(row({ CD_CARGO: '13', NR_VOTAVEL: '13013', SQ_CANDIDATO: '333', QT_VOTOS: '4' })); // outro partido: sem filtro
    expect(a.sections()[0]).toMatchObject({ up: 5, validos: 9 });
    expect(a.candidatos('vereador')).toEqual(['TOTALIZADA']);
  });
  it('separa cargos na mesma seção', () => {
    const a = new Aggregator();
    a.add(row({ CD_CARGO: '3', NR_VOTAVEL: '80', NM_VOTAVEL: 'CICLANO', QT_VOTOS: '7' }));
    a.add(row({ CD_CARGO: '6', NR_VOTAVEL: '1310', QT_VOTOS: '1' }));
    expect(a.sections().map((s) => s.cargo).sort()).toEqual(['depfed', 'governador']);
    expect(a.unidadesComCandidatura('depfed').size).toBe(0);
  });
  it('municipais: candidatura por município e filtro de seções', () => {
    const a = new Aggregator();
    a.add(row({ CD_CARGO: '13', NR_VOTAVEL: '80111', QT_VOTOS: '2' }));                                // SP capital, com UP
    a.add(row({ CD_CARGO: '13', NR_VOTAVEL: '1310', QT_VOTOS: '9', CD_MUNICIPIO: '62910', NR_SECAO: '5' })); // outro município, sem UP
    expect(a.unidadesComCandidatura('vereador')).toEqual(new Set(['SP-71072']));
    expect(a.sectionsComCandidatura('vereador').map((s) => s.tse)).toEqual([71072]);
  });
  it('presidente: unidade é o Brasil (inclui exterior)', () => {
    const a = new Aggregator();
    a.add(row({ CD_CARGO: '1', NR_VOTAVEL: '80', NM_VOTAVEL: 'X', QT_VOTOS: '1' }));
    a.add(row({ CD_CARGO: '1', NR_VOTAVEL: '13', QT_VOTOS: '9', SG_UF: 'ZZ', CD_MUNICIPIO: '29955' }));
    expect(a.sectionsComCandidatura('presidente')).toHaveLength(2);
  });
});
