import { ANOS, type Ano } from '../../src/lib/data-types';

/** Anos a conferir: `--ano N|all`; sem a opção, os anos já gerados (`existe`). */
export function anosDoArgv(argv: string[], existe: (a: Ano) => boolean): Ano[] {
  const i = argv.indexOf('--ano');
  if (i === -1) return ANOS.filter(existe);
  const v = argv[i + 1];
  if (!v) throw new Error(`--ano exige um valor: ${ANOS.join(', ')} ou all`);
  if (v === 'all') return [...ANOS];
  const ano = Number(v) as Ano;
  if (!ANOS.includes(ano)) throw new Error(`ano inválido: ${v} (use ${ANOS.join(', ')} ou all)`);
  return [ano];
}

export interface Oficial { validos: number; subjud: number }

/** Uma linha de votacao_partido_munzona → válidos (nominais + legenda) e anulados sub judice. */
export const somaOficial = (r: Record<string, string>): Oficial => ({
  validos: Number(r.QT_VOTOS_NOMINAIS_VALIDOS || 0) + Number(r.QT_VOTOS_LEGENDA_VALIDOS || 0),
  subjud: Number(r.QT_VOTOS_LEGENDA_ANUL_SUBJUD || 0) + Number(r.QT_VOTOS_NOMINAIS_ANUL_SUBJUD || 0),
});

/** Nosso total conta válidos e sub judice; anulados (QT_VOTOS_*_ANULADOS) não. */
export const confere = (nosso: number, o: Oficial) => nosso >= o.validos && nosso <= o.validos + o.subjud;
