import { describe, it, expect } from 'vitest';
import { anosDoArgv, confere, somaOficial } from '../../scripts/etl/conferir';

describe('conferir', () => {
  it('anosDoArgv: sem --ano usa os existentes; "all" = todos; ano inválido é erro', () => {
    expect(anosDoArgv(['node', 'v'], (a) => a !== 2020)).toEqual([2022, 2024, 2026]);
    expect(anosDoArgv(['node', 'v', '--ano', 'all'], () => false)).toEqual([2020, 2022, 2024, 2026]);
    expect(anosDoArgv(['node', 'v', '--ano', '2024'], () => false)).toEqual([2024]);
    expect(() => anosDoArgv(['node', 'v', '--ano', '2023'], () => true)).toThrow(/2023.*2020, 2022, 2024, 2026/);
    expect(() => anosDoArgv(['node', 'v', '--ano'], () => true)).toThrow(/--ano/);
  });
  it('somaOficial: válidos = nominais + legenda; tolerância só sub judice (anulados não contam)', () => {
    const r = {
      QT_VOTOS_NOMINAIS_VALIDOS: '224', QT_VOTOS_LEGENDA_VALIDOS: '64',
      QT_VOTOS_LEGENDA_ANUL_SUBJUD: '1', QT_VOTOS_NOMINAIS_ANUL_SUBJUD: '2',
      QT_VOTOS_LEGENDA_ANULADOS: '190', QT_VOTOS_NOMINAIS_ANULADOS: '208',
    };
    expect(somaOficial(r)).toEqual({ validos: 288, subjud: 3 });
  });
  it('confere: nosso entre válidos e válidos + sub judice', () => {
    expect(confere(288, { validos: 288, subjud: 3 })).toBe(true);
    expect(confere(291, { validos: 288, subjud: 3 })).toBe(true);
    expect(confere(292, { validos: 288, subjud: 3 })).toBe(false);
    expect(confere(287, { validos: 288, subjud: 3 })).toBe(false);
  });
});
