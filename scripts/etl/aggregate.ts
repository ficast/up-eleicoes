import { UNIDADE, type Cargo } from '../../src/lib/data-types';
import { cargoFromCode, isUpLegenda, isUpVote, isValid } from './cargos';

/** Chave da unidade de candidatura: 'BR' | UF | 'UF-tse'. */
export const unidadeKey = (cargo: Cargo, uf: string, tse: number) =>
  UNIDADE[cargo] === 'br' ? 'BR' : UNIDADE[cargo] === 'uf' ? uf : `${uf}-${tse}`;

export interface SecAcc {
  cargo: Cargo; uf: string; tse: number; munNome: string; zona: number; secao: number;
  local: number; localNome: string; up: number; validos: number;
}

/** Candidatos da UP com votos válidos ou sub judice e as unidades (`cargo|unidadeKey`) onde estão. */
export interface Totalizacao { candidatos: Set<string>; unidades: Set<string> }

/** Colunas exigidas nos CSVs de votacao_secao. */
export const COLUNAS_SECAO = [
  'NR_TURNO', 'CD_CARGO', 'SG_UF', 'CD_MUNICIPIO', 'NM_MUNICIPIO', 'NR_ZONA', 'NR_SECAO', 'NR_LOCAL_VOTACAO',
  'NM_LOCAL_VOTACAO', 'NR_VOTAVEL', 'NM_VOTAVEL', 'QT_VOTOS', 'SQ_CANDIDATO',
] as const;

export class Aggregator {
  private secs = new Map<string, SecAcc>();
  private cand = new Map<Cargo, Set<string>>();
  private unidades = new Map<Cargo, Set<string>>();

  /**
   * @param tot totalização oficial (votacao_candidato_munzona, ver loadTotalizados). Com ela:
   *   - voto nominal em candidato da UP fora de `tot.candidatos` (candidatura anulada, cancelada ou
   *     indeferida: votos computados como nulos/anulados) não conta como voto da UP nem como válido;
   *   - voto de legenda só conta (e só marca a unidade como "com candidatura") onde a UP tem ao menos
   *     um candidato válido ou sub judice (`tot.unidades`); senão a chapa inteira foi anulada.
   *   Sem `tot`, todo voto 80/80x… conta.
   */
  constructor(private tot?: Totalizacao) {}

  add(r: Record<string, string>): void {
    if (r.NR_TURNO !== '1') return;
    const cargo = cargoFromCode(Number(r.CD_CARGO));
    if (!cargo) return;
    const key = `${cargo}|${r.SG_UF}|${r.CD_MUNICIPIO}|${r.NR_ZONA}|${r.NR_SECAO}`;
    let s = this.secs.get(key);
    if (!s) {
      s = {
        cargo, uf: r.SG_UF, tse: Number(r.CD_MUNICIPIO), munNome: r.NM_MUNICIPIO, zona: Number(r.NR_ZONA),
        secao: Number(r.NR_SECAO), local: Number(r.NR_LOCAL_VOTACAO), localNome: r.NM_LOCAL_VOTACAO.trim(), up: 0, validos: 0,
      };
      this.secs.set(key, s);
    }
    const votos = Number(r.QT_VOTOS);
    if (this.tot && isUpVote(cargo, r.NR_VOTAVEL)) {
      const ok = isUpLegenda(cargo, r.NR_VOTAVEL)
        ? this.tot.unidades.has(`${cargo}|${unidadeKey(cargo, s.uf, s.tse)}`)
        : this.tot.candidatos.has(r.SQ_CANDIDATO);
      if (!ok) return; // nulo/anulado: não é voto da UP nem válido
    }
    if (isValid(r.NR_VOTAVEL)) s.validos += votos;
    if (isUpVote(cargo, r.NR_VOTAVEL)) {
      s.up += votos;
      if (!this.unidades.has(cargo)) this.unidades.set(cargo, new Set());
      this.unidades.get(cargo)!.add(unidadeKey(cargo, s.uf, s.tse));
      if (!isUpLegenda(cargo, r.NR_VOTAVEL)) {
        if (!this.cand.has(cargo)) this.cand.set(cargo, new Set());
        this.cand.get(cargo)!.add(r.NM_VOTAVEL.trim());
      }
    }
  }

  sections(): SecAcc[] { return [...this.secs.values()]; }
  candidatos(cargo: Cargo): string[] { return [...(this.cand.get(cargo) ?? [])].sort(); }
  unidadesComCandidatura(cargo: Cargo): Set<string> { return this.unidades.get(cargo) ?? new Set(); }
  /** Seções do cargo dentro das unidades onde a UP disputou. */
  sectionsComCandidatura(cargo: Cargo): SecAcc[] {
    const u = this.unidadesComCandidatura(cargo);
    return this.sections().filter((s) => s.cargo === cargo && u.has(unidadeKey(cargo, s.uf, s.tse)));
  }
}
