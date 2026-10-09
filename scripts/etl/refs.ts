import fs from 'node:fs';
import { readZipCsv } from './csv';
import { localKey } from '../../src/lib/data-types';
import type { ExteriorRef } from './rollup';

export const parseCoord = (s: string): number | null => {
  if (!s || s === '-1') return null;
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) && v !== -1 ? v : null;
};

/** "ACRELÂNDIA" → "Acrelândia"; preposições em minúsculas. */
export const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E|D')\b/g, (w) => w.toLowerCase());

export function parseTseIbge(csv: string): Map<number, { ibge: number; nome: string }> {
  const m = new Map<number, { ibge: number; nome: string }>();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const [tse, , nome, , ibge] = line.split(',');
    m.set(Number(tse), { ibge: Number(ibge), nome: titleCase(nome) });
  }
  return m;
}
export const loadTseIbge = (path = 'data/ref/municipios_tse_ibge.csv') => parseTseIbge(fs.readFileSync(path, 'utf8'));

/** Coordenadas por local de votação (chave tse-zona-local), ignorando o CSV agregado "BRASIL". */
export async function loadLocais(zipPath: string): Promise<Map<string, { lat: number; lon: number }>> {
  const m = new Map<string, { lat: number; lon: number }>();
  for await (const r of readZipCsv(zipPath, (n) => !/BRASIL/i.test(n))) {
    if (r.NR_TURNO && r.NR_TURNO !== '1') continue;
    const key = localKey(Number(r.CD_MUNICIPIO), Number(r.NR_ZONA), Number(r.NR_LOCAL_VOTACAO));
    if (m.has(key)) continue;
    const lat = parseCoord(r.NR_LATITUDE), lon = parseCoord(r.NR_LONGITUDE);
    if (lat !== null && lon !== null) m.set(key, { lat, lon });
  }
  return m;
}

/** SQ_CANDIDATO dos candidatos da UP em votacao_candidato_munzona (votos totalizados, inclusive sub judice). */
export async function loadTotalizados(zipPath: string): Promise<Set<string>> {
  const s = new Set<string>();
  for await (const r of readZipCsv(zipPath, (n) => !/BRASIL/i.test(n))) if (r.NR_PARTIDO === '80') s.add(r.SQ_CANDIDATO);
  return s;
}

export function loadExterior(path = 'data/ref/exterior_cidades.json'): Map<number, ExteriorRef> {
  const arr: (ExteriorRef & { tse: number })[] = JSON.parse(fs.readFileSync(path, 'utf8'));
  return new Map(arr.map((c) => [c.tse, c]));
}

export function loadCentroides(path = 'data/ref/centroides.json'): Map<number, [number, number]> {
  const obj: Record<string, [number, number]> = JSON.parse(fs.readFileSync(path, 'utf8'));
  return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
}
