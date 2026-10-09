import { UNIDADE, type Cargo } from '../../src/lib/data-types';
import { cargoFromCode, isUpLegenda, isUpVote, isValid } from './cargos';

/** Chave da unidade de candidatura: 'BR' | UF | 'UF-tse'. */
export const unidadeKey = (cargo: Cargo, uf: string, tse: number) =>
  UNIDADE[cargo] === 'br' ? 'BR' : UNIDADE[cargo] === 'uf' ? uf : `${uf}-${tse}`;

export interface SecAcc {
  cargo: Cargo; uf: string; tse: number; munNome: string; zona: number; secao: number;
  local: number; localNome: string; up: number; validos: number;
}

export class Aggregator {
  private secs = new Map<string, SecAcc>();
  private cand = new Map<Cargo, Set<string>>();
  private unidades = new Map<Cargo, Set<string>>();

  /**
   * @param totalizados SQ_CANDIDATO dos candidatos da UP que constam da totalização oficial
   *   (votacao_candidato_munzona). Voto nominal em candidato da UP fora desse conjunto
   *   (candidatura cancelada/indeferida antes da eleição: votos computados como nulos) não conta
   *   como voto da UP nem como válido. Sem o conjunto, todo voto 80/80x… conta.
   */
  constructor(private totalizados?: Set<string>) {}

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
    if (this.totalizados && isUpVote(cargo, r.NR_VOTAVEL) && !isUpLegenda(cargo, r.NR_VOTAVEL)
      && !this.totalizados.has(r.SQ_CANDIDATO)) return; // nulo: candidato fora da totalização
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
