import { ANOS, CARGOS, PROPORCIONAL, TIPO, type Ano, type Cargo, type MetaFile, type TotalCargo } from './data-types';
import type { Escopo } from './filters';

export interface TimelineRow { ano: Ano; cargo: Cargo; votos: number; proporcional: boolean; total: TotalCargo }

/** Uma linha por eleição×cargo a partir de `meta.totais` (nunca soma cargos). No exterior, só Presidente. */
export function timelineRows(meta: MetaFile, escopo: Escopo): TimelineRow[] {
  const out: TimelineRow[] = [];
  for (const ano of ANOS) for (const cargo of CARGOS) {
    const t = meta.totais[ano]?.[cargo];
    if (!t) continue;
    if (escopo === 'exterior' && (cargo !== 'presidente' || !t.upExterior)) continue;
    const votos = escopo === 'exterior' ? t.upExterior : escopo === 'brasil' ? t.upBrasil : t.up;
    out.push({ ano, cargo, votos, proporcional: PROPORCIONAL[TIPO[ano]] === cargo, total: t });
  }
  return out;
}
