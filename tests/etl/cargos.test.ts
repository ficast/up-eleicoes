import { describe, it, expect } from 'vitest';
import { cargoFromCode, isUpVote, isValid, isUpLegenda } from '../../scripts/etl/cargos';

describe('cargos', () => {
  it('mapeia códigos', () => {
    expect(cargoFromCode(1)).toBe('presidente');
    expect(cargoFromCode(8)).toBe('depest');
    expect(cargoFromCode(11)).toBe('prefeito');
    expect(cargoFromCode(13)).toBe('vereador');
    expect(cargoFromCode(12)).toBeNull(); // vice-prefeito não é votado separadamente
  });
  it('municipais', () => {
    expect(isUpVote('prefeito', '80')).toBe(true);
    expect(isUpVote('vereador', '80123')).toBe(true);
    expect(isUpVote('vereador', '80')).toBe(true);
    expect(isUpLegenda('vereador', '80')).toBe(true);
    expect(isUpLegenda('prefeito', '80')).toBe(false);
  });
  it('identifica votos da UP', () => {
    expect(isUpVote('presidente', '80')).toBe(true);
    expect(isUpVote('presidente', '800')).toBe(false);
    expect(isUpVote('senador', '801')).toBe(true);
    expect(isUpVote('depfed', '8012')).toBe(true);
    expect(isUpVote('depfed', '80')).toBe(true);
    expect(isUpVote('depfed', '1380')).toBe(false);
    expect(isUpVote('depest', '80123')).toBe(true);
    expect(isUpVote('depest', '8012')).toBe(false);
  });
  it('legenda e válidos', () => {
    expect(isUpLegenda('depfed', '80')).toBe(true);
    expect(isUpLegenda('presidente', '80')).toBe(false);
    expect(isValid('95')).toBe(false);
    expect(isValid('96')).toBe(false);
    expect(isValid('80')).toBe(true);
  });
});
