import type { Cargo } from '../../src/lib/data-types';

const CODE_TO_CARGO: Record<number, Cargo> = { 1: 'presidente', 3: 'governador', 5: 'senador', 6: 'depfed', 7: 'depest', 8: 'depest', 11: 'prefeito', 13: 'vereador' };
export const cargoFromCode = (cd: number): Cargo | null => CODE_TO_CARGO[cd] ?? null;

const NOMINAL: Record<Cargo, RegExp> = {
  presidente: /^80$/, governador: /^80$/, senador: /^80\d$/, depfed: /^80\d{2}$/, depest: /^80\d{3}$/,
  prefeito: /^80$/, vereador: /^80\d{3}$/,
};
const PROPORCIONAIS = new Set<Cargo>(['depfed', 'depest', 'vereador']);
export const isUpLegenda = (cargo: Cargo, nr: string) => PROPORCIONAIS.has(cargo) && nr === '80';
export const isUpVote = (cargo: Cargo, nr: string) => NOMINAL[cargo].test(nr) || isUpLegenda(cargo, nr);
export const isValid = (nr: string) => nr !== '95' && nr !== '96';
