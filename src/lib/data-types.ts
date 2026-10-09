export const CARGOS = ['presidente', 'governador', 'senador', 'depfed', 'depest', 'prefeito', 'vereador'] as const;
export type Cargo = (typeof CARGOS)[number];
export const ANOS = [2020, 2022, 2024, 2026] as const;
export type Ano = (typeof ANOS)[number];
export type TipoEleicao = 'geral' | 'municipal';
export const TIPO: Record<Ano, TipoEleicao> = { 2020: 'municipal', 2022: 'geral', 2024: 'municipal', 2026: 'geral' };
export const CARGOS_POR_TIPO: Record<TipoEleicao, Cargo[]> = {
  geral: ['presidente', 'governador', 'senador', 'depfed', 'depest'],
  municipal: ['prefeito', 'vereador'],
};
/** Cargo proporcional de cada tipo: padrão ao comparar eleições de tipos diferentes. */
export const PROPORCIONAL: Record<TipoEleicao, Cargo> = { geral: 'depfed', municipal: 'vereador' };
/** Unidade em que a candidatura existe (fora dela = "sem candidatura"). */
export const UNIDADE: Record<Cargo, 'br' | 'uf' | 'municipio'> = {
  presidente: 'br', governador: 'uf', senador: 'uf', depfed: 'uf', depest: 'uf', prefeito: 'municipio', vereador: 'municipio',
};

export const CARGO_LABEL: Record<Cargo, string> = {
  presidente: 'Presidente', governador: 'Governador', senador: 'Senador',
  depfed: 'Dep. Federal', depest: 'Dep. Estadual/Distrital', prefeito: 'Prefeito', vereador: 'Vereador',
};

export interface Tally { up: number; validos: number }

export interface UfRow extends Tally { uf: string }
export interface MunicipioRow extends Tally { ibge: number; tse: number; uf: string; nome: string }
export interface CidadeExteriorRow extends Tally { tse: number; nome: string; iso3: string; pais: string; lat: number | null; lon: number | null }
export interface PaisRow extends Tally { iso3: string; isoNum: string; pais: string }

/** public/data/{ano}/{cargo}.json */
export interface CargoAnoFile {
  ano: Ano; cargo: Cargo;
  candidatos: string[];          // nomes (NM_VOTAVEL) dos candidatos da UP
  ufsComCandidatura: string[];   // UFs onde a UP disputou (Presidente: todas + ZZ; municipais: UFs com ≥1 município)
  ufs: UfRow[];                  // soma das unidades com candidatura em cada UF
  municipios: MunicipioRow[];    // só municípios dentro de unidades com candidatura
  exterior: { cidades: CidadeExteriorRow[]; paises: PaisRow[] } | null; // só Presidente
}

/** public/data/{ano}/locais/{UF}.json — nomes e coordenadas */
export interface LocaisInfoFile { [key: string]: [nome: string, lat: number, lon: number, aprox: 0 | 1, tse: number] }

/** public/data/{ano}/{cargo}/locais/{UF}.json — votos por local; key = `${tse}-${zona}-${local}` */
export interface LocaisVotosFile {
  rows: [key: string, up: number, validos: number][];
  secoes: Record<string, [secao: number, up: number, validos: number][]>; // só seções com up > 0
}

/** Totais de uma eleição×cargo, para a linha do tempo. */
export interface TotalCargo {
  up: number; validos: number;            // validos só nas unidades com candidatura
  upBrasil: number; upExterior: number;
  unidadesComCandidatura: number;         // UFs (gerais) ou municípios (municipais); 1 para Presidente
  municipiosComVoto: number;
  candidatos: string[];                   // só majoritários (Presidente, Governador, Senador, Prefeito)
}

/** public/data/meta.json */
export interface MetaFile {
  geradoEm: string; fonte: string;
  disponivel: Record<string, Cargo[]>;                       // ano → cargos com dados
  totais: Record<string, Partial<Record<Cargo, TotalCargo>>>; // ano → cargo → totais
}

export const localKey = (tse: number, zona: number, local: number) => `${tse}-${zona}-${local}`;
