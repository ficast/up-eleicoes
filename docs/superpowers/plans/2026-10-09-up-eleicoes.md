# UP nas urnas (2020–2026) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hotsite estático (Vercel) com mapa, gráficos e linha do tempo dos votos da Unidade Popular (nº 80) nas eleições gerais de 2022/2026 e municipais de 2020/2024 (Fase 5), por UF, município, local/seção e exterior, com comparações correspondentes (mesmo cargo) e não correspondentes (só votos).

**Architecture:** Um ETL Node/TypeScript lê os CSVs de votação por seção do TSE (em streaming, dentro dos zips), agrega os votos da UP e os votos válidos por seção → local → município → UF/país, e grava JSONs em `public/data/`. Um site Next.js (`output: 'export'`) lê esses JSONs no cliente. Uma camada pura `src/lib/view.ts` transforma filtros + dados em linhas de visualização, consumidas pelo mapa (MapLibre), pelos gráficos (ECharts) e pela tabela.

**Tech Stack:** Node 24, TypeScript, tsx, yauzl, Vitest; Next.js 16 (App Router, export estático), React 19, Tailwind CSS 4, MapLibre GL 6, ECharts 6, d3-scale/d3-interpolate/d3-geo, topojson-client/server, world-atlas, i18n-iso-countries.

**Spec:** `docs/superpowers/specs/2026-10-09-up-eleicoes-design.md`

## Ajustes ao spec decididos no plano

- JSON como objetos/tuplas simples, sem camada de "cabeçalho + tuplas" genérica: arquivos por `(ano, cargo)` e locais por `(ano, cargo, UF)`.
- Comparação (deltas e casamento de locais) é calculada **no cliente** por funções puras testadas (`src/lib/compare.ts`), em vez de arquivos `compare/` pré-gerados. Menos arquivos, mesma lógica testada.
- Nomes/coordenadas dos locais ficam num arquivo por `(ano, UF)`, independente do cargo; os votos por local ficam por `(ano, cargo, UF)`. Evita repetir nomes 5×.
- Validação usa `votacao_partido_munzona_{ano}.zip` (CSV oficial agregado por partido) em vez do Relatório de Totalização (que é PDF).

## Fatos dos dados (verificados em 2026-10-09)

- CSV latin1, `;`, campos texto entre aspas, números sem aspas.
- `votacao_secao_{ano}_BR.zip` → só Presidente (cd 1), inclui exterior (`SG_UF = "ZZ"`). 2022 tem turnos 1 e 2.
- `votacao_secao_{ano}_{UF}.zip` → Governador 3, Senador 5, Dep. Federal 6, Dep. Estadual 7, Dep. Distrital 8 (DF).
- Brancos `95`, nulos `96`. Legenda = número do partido (2 dígitos).
- Locais: `eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip` — 2022: um CSV; 2026: CSV por UF + `ZZ` + `BRASIL` (ignorar `BRASIL`). `CD_MUNICIPIO` com zeros à esquerda; `NR_LATITUDE`/`NR_LONGITUDE` com vírgula decimal, `-1` = ausente. Exterior sempre `-1`.
- `votacao_partido_munzona_{ano}.zip` → CSVs por UF **e** `_BRASIL.csv` (ler só os por UF, senão duplica).
- Totais de referência (Presidente, 1º turno, seção): 2022 = 53.519; 2026 = 122.911.

## File Structure

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts, .gitignore
scripts/etl/
  csv.ts            parseLine + readZipCsv (streaming, latin1)
  cargos.ts         códigos de cargo, isUpVote, isValid
  download.ts       ensureFile (download com cache em .cache/tse)
  aggregate.ts      Aggregator: linhas → acumuladores por seção
  rollup.ts         seções → locais/municípios/UFs/cidades/países (puro)
  refs.ts           carrega TSE→IBGE, coordenadas de locais, exterior, centroides
  write.ts          gravação de JSON
  index.ts          orquestra o ETL (npm run etl)
  validate.ts       confere com votacao_partido_munzona (npm run validate)
  build-geo.ts      malhas IBGE + world-atlas → public/geo, centroides (npm run geo)
  geocode-exterior.ts  cidades do exterior → país + lat/lon (npm run geocode, uma vez)
data/ref/
  municipios_tse_ibge.csv, exterior_cidades.json, centroides.json
src/lib/
  data-types.ts     tipos compartilhados ETL ↔ site
  filters.ts        estado dos filtros ↔ querystring
  metrics.ts        valor por métrica, deltas
  compare.ts        junção referência×atual, casamento de locais
  view.ts           filtros + dados → ViewModel (linhas, KPIs, nível)
  colors.ts         paleta e escalas
  format.ts         formatação pt-BR
  load.ts           fetch com cache + hooks
  usePoints.ts      pontos dos locais de votação (com casamento entre anos)
  timeline.ts       linhas da linha do tempo a partir de meta.totais
src/components/
  Logo.tsx, Hero.tsx, JoinCta.tsx, FilterBar.tsx, Segmented.tsx, KpiRow.tsx,
  MapPanel.tsx, MapLegend.tsx, Breadcrumb.tsx,
  charts/EChart.tsx, charts/DivergingBars.tsx, charts/Scatter.tsx, charts/GroupedBars.tsx,
  DataTable.tsx, Timeline.tsx, Notes.tsx, Footer.tsx, Dashboard.tsx
src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
tests/etl/*.test.ts, tests/lib/*.test.ts, tests/fixtures/*
public/data/** (gerado), public/geo/** (gerado), public/brand/** (existente)
```

---

## Fase 1 — Projeto e ETL

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "up-eleicoes",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "npx serve out",
    "test": "vitest run",
    "etl": "tsx scripts/etl/index.ts",
    "validate": "tsx scripts/etl/validate.ts",
    "geo": "tsx scripts/etl/build-geo.ts",
    "geocode": "tsx scripts/etl/geocode-exterior.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Instalar dependências**

```bash
npm i next@16.4.0 react@19 react-dom@19 maplibre-gl@6.13.0 echarts@6.1.0 d3-scale d3-interpolate topojson-client
npm i -D typescript @types/node @types/react @types/react-dom tailwindcss@4 @tailwindcss/postcss vitest tsx yauzl @types/yauzl topojson-server d3-geo @types/d3-geo @types/d3-scale @types/d3-interpolate @types/topojson-client @types/topojson-server world-atlas i18n-iso-countries
```

- [ ] **Step 3: Configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "es2023"], "module": "esnext",
    "moduleResolution": "bundler", "strict": true, "noEmit": true, "esModuleInterop": true,
    "resolveJsonModule": true, "isolatedModules": true, "jsx": "preserve", "skipLibCheck": true,
    "incremental": true, "plugins": [{ "name": "next" }], "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src", "scripts", "tests", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';
const config: NextConfig = { output: 'export', images: { unoptimized: true }, trailingSlash: true };
export default config;
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['tests/**/*.test.ts'] },
});
```

Acrescentar a `.gitignore`: `next-env.d.ts`, `*.tsbuildinfo`.

- [ ] **Step 4: Verificar** — `npx tsc --version` e `npx vitest --version` imprimem versões.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore: scaffold Next.js + ETL toolchain"`

### Task 2: Tipos compartilhados

**Files:** Create `src/lib/data-types.ts`

- [ ] **Step 1: Escrever tipos**

```ts
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
```

- [ ] **Step 2: `npx tsc --noEmit`** — sem erros.
- [ ] **Step 3: Commit** — `feat: tipos de dados compartilhados`

### Task 3: Parser de CSV do TSE

**Files:** Create `scripts/etl/csv.ts`; Test `tests/etl/csv.test.ts`; Fixture `tests/fixtures/secao_mini.csv`

- [ ] **Step 1: Teste (falhando)**

```ts
import { describe, it, expect } from 'vitest';
import { parseLine } from '../../scripts/etl/csv';

describe('parseLine', () => {
  it('lida com campos com e sem aspas', () => {
    expect(parseLine('"AC";1392;"RIO BRANCO";9')).toEqual(['AC', '1392', 'RIO BRANCO', '9']);
  });
  it('preserva ; e aspas escapadas dentro de aspas', () => {
    expect(parseLine('"A;B";"diz ""oi""";3')).toEqual(['A;B', 'diz "oi"', '3']);
  });
  it('campo vazio', () => {
    expect(parseLine('"";1;')).toEqual(['', '1', '']);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/etl/csv.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementação**

```ts
import yauzl from 'yauzl';
import readline from 'node:readline';
import type { Readable } from 'node:stream';

export function parseLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    if (line[i] === '"') {
      let s = ''; i++;
      while (i < n) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { s += '"'; i += 2; continue; }
          i++; break;
        }
        s += line[i++];
      }
      out.push(s);
      i++; // pula ';'
    } else {
      const j = line.indexOf(';', i);
      const end = j === -1 ? n : j;
      out.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return out;
}

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((res, rej) => yauzl.open(path, { lazyEntries: true }, (e, z) => (e ? rej(e) : res(z!))));
}

/** Lista as entradas .csv do zip que passam no filtro. */
export async function listZipCsv(zipPath: string, filter: (name: string) => boolean = () => true): Promise<string[]> {
  const zip = await openZip(zipPath);
  const names: string[] = [];
  await new Promise<void>((res, rej) => {
    zip.on('entry', (e: yauzl.Entry) => { if (e.fileName.endsWith('.csv') && filter(e.fileName)) names.push(e.fileName); zip.readEntry(); });
    zip.on('end', () => res()); zip.on('error', rej); zip.readEntry();
  });
  zip.close();
  return names;
}

/** Itera as linhas (como objetos coluna→valor) de todos os CSVs do zip que passam no filtro. */
export async function* readZipCsv(zipPath: string, filter: (name: string) => boolean = () => true): AsyncGenerator<Record<string, string>> {
  const zip = await openZip(zipPath);
  const entries: yauzl.Entry[] = [];
  await new Promise<void>((res, rej) => {
    zip.on('entry', (e: yauzl.Entry) => { if (e.fileName.endsWith('.csv') && filter(e.fileName)) entries.push(e); zip.readEntry(); });
    zip.on('end', () => res()); zip.on('error', rej); zip.readEntry();
  });
  for (const entry of entries) {
    const stream: Readable = await new Promise((res, rej) => zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s!))));
    stream.setEncoding('latin1');
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let header: string[] | null = null;
    for await (const line of rl) {
      if (!line) continue;
      const cells = parseLine(line);
      if (!header) { header = cells; continue; }
      const row: Record<string, string> = {};
      for (let k = 0; k < header.length; k++) row[header[k]] = cells[k] ?? '';
      yield row;
    }
  }
  zip.close();
}
```

- [ ] **Step 4:** teste passa.
- [ ] **Step 5: Teste de integração com zip** — criar `tests/fixtures/secao_mini.csv` (latin1) com cabeçalho real e 8 linhas (ver Task 5, Step 1) e um zip gerado no próprio teste:

```ts
import { readZipCsv } from '../../scripts/etl/csv';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

it('lê CSV latin1 de dentro de zip', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'));
  const csv = path.join(dir, 'x.csv');
  fs.writeFileSync(csv, Buffer.from('"NM";"QT"\n"SÃO PAULO";3\n', 'latin1'));
  const zip = path.join(dir, 'x.zip');
  execFileSync('tar', ['-a', '-c', '-f', zip, '-C', dir, 'x.csv']); // bsdtar (Windows/macOS) cria zip
  const rows = []; for await (const r of readZipCsv(zip)) rows.push(r);
  expect(rows).toEqual([{ NM: 'SÃO PAULO', QT: '3' }]);
});
```

- [ ] **Step 6:** `npx vitest run tests/etl/csv.test.ts` → PASS.
- [ ] **Step 7: Commit** — `feat(etl): parser de CSV do TSE em streaming`

### Task 4: Regras de cargo e voto

**Files:** Create `scripts/etl/cargos.ts`; Test `tests/etl/cargos.test.ts`

- [ ] **Step 1: Teste**

```ts
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
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
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
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(etl): regras de cargo e voto da UP`

### Task 5: Agregador por seção

**Files:** Create `scripts/etl/aggregate.ts`; Test `tests/etl/aggregate.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { Aggregator } from '../../scripts/etl/aggregate';

const row = (o: Partial<Record<string, string>>) => ({
  NR_TURNO: '1', SG_UF: 'SP', CD_MUNICIPIO: '71072', NM_MUNICIPIO: 'SÃO PAULO', NR_ZONA: '1', NR_SECAO: '10',
  CD_CARGO: '6', NR_VOTAVEL: '8012', NM_VOTAVEL: 'FULANA', QT_VOTOS: '3', NR_LOCAL_VOTACAO: '1015', NM_LOCAL_VOTACAO: 'ESCOLA X', ...o,
});

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
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
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
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(etl): agregador por seção`

### Task 6: Rollup (seção → local → município → UF / exterior)

**Files:** Create `scripts/etl/rollup.ts`; Test `tests/etl/rollup.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { rollup, type Refs } from '../../scripts/etl/rollup';
import type { SecAcc } from '../../scripts/etl/aggregate';

const sec = (o: Partial<SecAcc>): SecAcc => ({ cargo: 'presidente', uf: 'SP', tse: 71072, munNome: 'SÃO PAULO', zona: 1, secao: 1, local: 10, localNome: 'ESCOLA', up: 1, validos: 10, ...o });
const refs: Refs = {
  tseIbge: new Map([[71072, { ibge: 3550308, nome: 'São Paulo' }]]),
  locais: new Map([['71072-1-10', { lat: -23.5, lon: -46.6 }]]),
  centroides: new Map([[3550308, [-46.63, -23.55]]]),
  exterior: new Map([[29955, { iso3: 'PRT', isoNum: '620', pais: 'Portugal', nome: 'Lisboa', lat: 38.72, lon: -9.14 }]]),
};

describe('rollup', () => {
  it('agrega por local, município e UF', () => {
    const r = rollup([sec({}), sec({ secao: 2, up: 2, validos: 20 }), sec({ local: 11, secao: 3, up: 0, validos: 5 })], refs);
    expect(r.ufs).toEqual([{ uf: 'SP', up: 3, validos: 35 }]);
    expect(r.municipios).toEqual([{ ibge: 3550308, tse: 71072, uf: 'SP', nome: 'São Paulo', up: 3, validos: 35 }]);
    const sp = r.locaisPorUf.get('SP')!;
    expect(sp.votos.rows).toEqual([['71072-1-10', 3, 30], ['71072-1-11', 0, 5]]);
    expect(sp.votos.secoes).toEqual({ '71072-1-10': [[1, 1, 10], [2, 2, 20]] });
    expect(sp.info['71072-1-10']).toEqual(['ESCOLA', -23.5, -46.6, 0, 71072]);
    expect(sp.info['71072-1-11']).toEqual(['ESCOLA', -23.55, -46.63, 1, 71072]); // sem coord → centroide aproximado
  });
  it('agrega exterior por cidade e país', () => {
    const r = rollup([sec({ uf: 'ZZ', tse: 29955, munNome: 'LISBOA', up: 4, validos: 40 })], refs);
    expect(r.ufs).toEqual([{ uf: 'ZZ', up: 4, validos: 40 }]);
    expect(r.municipios).toEqual([]);
    expect(r.cidades).toEqual([{ tse: 29955, nome: 'Lisboa', iso3: 'PRT', pais: 'Portugal', lat: 38.72, lon: -9.14, up: 4, validos: 40 }]);
    expect(r.paises).toEqual([{ iso3: 'PRT', isoNum: '620', pais: 'Portugal', up: 4, validos: 40 }]);
  });
  it('falha se município não tem correspondência IBGE', () => {
    expect(() => rollup([sec({ tse: 1 })], refs)).toThrow(/IBGE/);
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
import type { CidadeExteriorRow, LocaisInfoFile, LocaisVotosFile, MunicipioRow, PaisRow, UfRow } from '../../src/lib/data-types';
import { localKey } from '../../src/lib/data-types';
import type { SecAcc } from './aggregate';

export interface ExteriorRef { iso3: string; isoNum: string; pais: string; nome: string; lat: number | null; lon: number | null }
export interface Refs {
  tseIbge: Map<number, { ibge: number; nome: string }>;
  locais: Map<string, { lat: number; lon: number }>;
  centroides: Map<number, [number, number]>; // ibge → [lon, lat]
  exterior: Map<number, ExteriorRef>;
}
export interface RollupResult {
  ufs: UfRow[]; municipios: MunicipioRow[]; cidades: CidadeExteriorRow[]; paises: PaisRow[];
  locaisPorUf: Map<string, { info: LocaisInfoFile; votos: LocaisVotosFile }>;
}

const add = <K>(m: Map<K, { up: number; validos: number }>, k: K, s: { up: number; validos: number }, init: () => any) => {
  let t = m.get(k); if (!t) { t = init(); m.set(k, t!); }
  t!.up += s.up; t!.validos += s.validos;
};

export function rollup(secs: SecAcc[], refs: Refs): RollupResult {
  const ufs = new Map<string, UfRow>();
  const muns = new Map<number, MunicipioRow>();
  const cidades = new Map<number, CidadeExteriorRow>();
  const paises = new Map<string, PaisRow>();
  const locais = new Map<string, { uf: string; key: string; tse: number; nome: string; up: number; validos: number; secoes: [number, number, number][] }>();

  for (const s of secs) {
    add(ufs, s.uf, s, () => ({ uf: s.uf, up: 0, validos: 0 }));
    if (s.uf === 'ZZ') {
      const ref = refs.exterior.get(s.tse);
      if (!ref) throw new Error(`Cidade do exterior sem referência: ${s.tse} ${s.munNome}`);
      add(cidades, s.tse, s, () => ({ tse: s.tse, nome: ref.nome, iso3: ref.iso3, pais: ref.pais, lat: ref.lat, lon: ref.lon, up: 0, validos: 0 }));
      add(paises, ref.iso3, s, () => ({ iso3: ref.iso3, isoNum: ref.isoNum, pais: ref.pais, up: 0, validos: 0 }));
      continue;
    }
    const m = refs.tseIbge.get(s.tse);
    if (!m) throw new Error(`Município TSE ${s.tse} (${s.munNome}/${s.uf}) sem código IBGE`);
    add(muns, m.ibge, s, () => ({ ibge: m.ibge, tse: s.tse, uf: s.uf, nome: m.nome, up: 0, validos: 0 }));
    const key = localKey(s.tse, s.zona, s.local);
    let l = locais.get(key);
    if (!l) { l = { uf: s.uf, key, tse: s.tse, nome: s.localNome, up: 0, validos: 0, secoes: [] }; locais.set(key, l); }
    l.up += s.up; l.validos += s.validos;
    if (s.up > 0) l.secoes.push([s.secao, s.up, s.validos]);
  }

  const locaisPorUf = new Map<string, { info: LocaisInfoFile; votos: LocaisVotosFile }>();
  for (const l of [...locais.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    let f = locaisPorUf.get(l.uf);
    if (!f) { f = { info: {}, votos: { rows: [], secoes: {} } }; locaisPorUf.set(l.uf, f); }
    const c = refs.locais.get(l.key);
    if (c) f.info[l.key] = [l.nome, c.lat, c.lon, 0, l.tse];
    else {
      const ibge = refs.tseIbge.get(l.tse)!.ibge;
      const [lon, lat] = refs.centroides.get(ibge) ?? [NaN, NaN];
      f.info[l.key] = [l.nome, lat, lon, 1, l.tse];
    }
    f.votos.rows.push([l.key, l.up, l.validos]);
    if (l.secoes.length) f.votos.secoes[l.key] = l.secoes.sort((a, b) => a[0] - b[0]);
  }

  const byUp = <T extends { up: number }>(a: T, b: T) => b.up - a.up;
  return {
    ufs: [...ufs.values()].sort((a, b) => a.uf.localeCompare(b.uf)),
    municipios: [...muns.values()].sort((a, b) => a.ibge - b.ibge),
    cidades: [...cidades.values()].sort(byUp),
    paises: [...paises.values()].sort(byUp),
    locaisPorUf,
  };
}
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(etl): rollup de seções para locais, municípios, UFs e exterior`

### Task 7: Referências (TSE→IBGE, locais, exterior, centroides)

**Files:** Create `scripts/etl/refs.ts`, `data/ref/municipios_tse_ibge.csv`; Test `tests/etl/refs.test.ts`

- [ ] **Step 1: Baixar a tabela TSE→IBGE**

```bash
mkdir -p data/ref
curl -sL -o data/ref/municipios_tse_ibge.csv https://raw.githubusercontent.com/betafcc/Municipios-Brasileiros-TSE/master/municipios_brasileiros_tse.csv
head -2 data/ref/municipios_tse_ibge.csv   # codigo_tse,uf,nome_municipio,capital,codigo_ibge
```

- [ ] **Step 2: Teste de `parseCoord` e `loadTseIbge`**

```ts
import { describe, it, expect } from 'vitest';
import { parseCoord, parseTseIbge } from '../../scripts/etl/refs';

describe('refs', () => {
  it('converte coordenadas do TSE', () => {
    expect(parseCoord('-10,1572326')).toBeCloseTo(-10.1572326);
    expect(parseCoord('-1')).toBeNull();
    expect(parseCoord('')).toBeNull();
  });
  it('lê tabela TSE→IBGE', () => {
    const m = parseTseIbge('codigo_tse,uf,nome_municipio,capital,codigo_ibge\n1120,AC,ACRELÂNDIA,0,1200013\n');
    expect(m.get(1120)).toEqual({ ibge: 1200013, nome: 'Acrelândia' });
  });
});
```

- [ ] **Step 3: Implementação**

```ts
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

export function loadExterior(path = 'data/ref/exterior_cidades.json'): Map<number, ExteriorRef> {
  const arr: (ExteriorRef & { tse: number })[] = JSON.parse(fs.readFileSync(path, 'utf8'));
  return new Map(arr.map((c) => [c.tse, c]));
}

export function loadCentroides(path = 'data/ref/centroides.json'): Map<number, [number, number]> {
  const obj: Record<string, [number, number]> = JSON.parse(fs.readFileSync(path, 'utf8'));
  return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
}
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(etl): carregadores de referências`

### Task 8: Download com cache

**Files:** Create `scripts/etl/download.ts`

- [ ] **Step 1: Implementação**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const TSE = 'https://cdn.tse.jus.br/estatistica/sead/odsele';
export const CACHE = '.cache/tse';
export const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export const urls = {
  secao: (ano: number, uf: string) => `${TSE}/votacao_secao/votacao_secao_${ano}_${uf}.zip`,
  locais: (ano: number) => `${TSE}/eleitorado_locais_votacao/eleitorado_local_votacao_${ano}.zip`,
  partido: (ano: number) => `${TSE}/votacao_partido_munzona/votacao_partido_munzona_${ano}.zip`,
};

/** Baixa `url` para .cache/tse se ausente ou com tamanho diferente do servidor. Retorna o caminho local. */
export async function ensureFile(url: string): Promise<string> {
  fs.mkdirSync(CACHE, { recursive: true });
  const dest = path.join(CACHE, path.basename(url));
  const head = await fetch(url, { method: 'HEAD' });
  if (!head.ok) throw new Error(`HEAD ${url} → ${head.status}`);
  const size = Number(head.headers.get('content-length'));
  if (fs.existsSync(dest) && fs.statSync(dest).size === size) return dest;
  console.log(`↓ ${url} (${(size / 1e6).toFixed(0)} MB)`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
  const tmp = dest + '.part';
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));
  if (fs.statSync(tmp).size !== size) throw new Error(`Download incompleto: ${url}`);
  fs.renameSync(tmp, dest);
  return dest;
}
```

- [ ] **Step 2: Smoke test** — `npx tsx -e "import('./scripts/etl/download.ts').then(m=>m.ensureFile(m.urls.secao(2026,'AC'))).then(console.log)"` imprime `.cache/tse/votacao_secao_2026_AC.zip` sem baixar de novo.
- [ ] **Step 3: Commit** — `feat(etl): download com cache`

### Task 9: Malhas e centroides

**Files:** Create `scripts/etl/build-geo.ts`; gera `public/geo/br-municipios.topo.json`, `public/geo/br-ufs.topo.json`, `public/geo/world.topo.json`, `data/ref/centroides.json`

- [ ] **Step 1: Implementação**

```ts
import fs from 'node:fs';
import { topology } from 'topojson-server';
import { geoCentroid } from 'd3-geo';

const IBGE = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR';
const get = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} → ${r.status}`); return r.json(); };

const UF_SIGLA: Record<string, string> = { '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF' };

async function main() {
  fs.mkdirSync('public/geo', { recursive: true });
  const mun = await get(`${IBGE}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`);
  const centroides: Record<string, [number, number]> = {};
  for (const f of mun.features) {
    const id = Number(f.properties.codarea);
    f.id = id; f.properties = { uf: UF_SIGLA[String(id).slice(0, 2)] };
    const [lon, lat] = geoCentroid(f);
    centroides[id] = [+lon.toFixed(4), +lat.toFixed(4)];
  }
  fs.writeFileSync('public/geo/br-municipios.topo.json', JSON.stringify(topology({ municipios: mun }, 1e5)));
  fs.writeFileSync('data/ref/centroides.json', JSON.stringify(centroides));

  const ufs = await get(`${IBGE}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF`);
  for (const f of ufs.features) { f.id = UF_SIGLA[f.properties.codarea]; f.properties = {}; }
  fs.writeFileSync('public/geo/br-ufs.topo.json', JSON.stringify(topology({ ufs }, 1e5)));

  fs.copyFileSync('node_modules/world-atlas/countries-110m.json', 'public/geo/world.topo.json');
  console.log('geo ok', mun.features.length, 'municípios', ufs.features.length, 'UFs');
}
main();
```

- [ ] **Step 2: Rodar** — `npm run geo` → `geo ok 5570 municípios 27 UFs`; `ls -la public/geo` (municípios < 2 MB).
- [ ] **Step 3: Commit** — `feat(geo): malhas IBGE, mundo e centroides`

### Task 10: Cidades do exterior → país e coordenadas

**Files:** Create `scripts/etl/geocode-exterior.ts`; gera `data/ref/exterior_cidades.json`

- [ ] **Step 1: Implementação**

```ts
import fs from 'node:fs';
import countries from 'i18n-iso-countries';
import pt from 'i18n-iso-countries/langs/pt.json' with { type: 'json' };
import { readZipCsv } from './csv';
import { ensureFile, urls } from './download';
import { titleCase } from './refs';

countries.registerLocale(pt);
const OUT = 'data/ref/exterior_cidades.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const prev: any[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const known = new Map(prev.map((c) => [c.tse, c]));
  const cidades = new Map<number, string>();
  for (const ano of [2022, 2026]) {
    for await (const r of readZipCsv(await ensureFile(urls.secao(ano, 'BR')))) {
      if (r.SG_UF === 'ZZ') cidades.set(Number(r.CD_MUNICIPIO), r.NM_MUNICIPIO);
    }
  }
  const out = [];
  for (const [tse, nomeTse] of [...cidades].sort((a, b) => a[0] - b[0])) {
    if (known.has(tse)) { out.push(known.get(tse)); continue; }
    const q = encodeURIComponent(nomeTse);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=pt-BR&addressdetails=1&featuretype=city`,
      { headers: { 'User-Agent': 'up-eleicoes/0.1 (hotsite eleitoral)' } });
    const [hit] = (await res.json()) as any[];
    const iso2 = hit?.address?.country_code?.toUpperCase();
    out.push({
      tse, nome: titleCase(nomeTse),
      iso3: iso2 ? countries.alpha2ToAlpha3(iso2) : '???', isoNum: iso2 ? countries.alpha2ToNumeric(iso2) : '???',
      pais: iso2 ? countries.getName(iso2, 'pt') : '???',
      lat: hit ? +Number(hit.lat).toFixed(4) : null, lon: hit ? +Number(hit.lon).toFixed(4) : null,
    });
    console.log(tse, nomeTse, '→', iso2, hit?.display_name);
    await sleep(1100); // política de uso do Nominatim: 1 req/s
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(out.length, 'cidades;', out.filter((c) => c.iso3 === '???').length, 'sem país');
}
main();
```

- [ ] **Step 2: Rodar** — `npm run geocode` (~3–4 min).
- [ ] **Step 3: Revisão manual** — abrir `data/ref/exterior_cidades.json`; corrigir toda entrada `???` e conferir homônimos (ex.: "PORTO" deve ser Portugal; "SANTA CRUZ DE LA SIERRA" Bolívia; "CIDADE DO MÉXICO" México; "GEORGETOWN" Guiana; "HAMAMATSU"/"NAGÓIA" Japão). Critério: o país corresponde ao consulado brasileiro daquela cidade.
- [ ] **Step 4: Commit** — `data: cidades do exterior com país e coordenadas`

### Task 11: Orquestrador do ETL

**Files:** Create `scripts/etl/write.ts`, `scripts/etl/index.ts`

- [ ] **Step 1: `write.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
export const OUT = 'public/data';
export function writeJson(rel: string, data: unknown) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}
```

- [ ] **Step 2: `index.ts`**

```ts
import fs from 'node:fs';
import { ANOS, CARGOS_POR_TIPO, TIPO, UNIDADE, type Ano, type Cargo, type CargoAnoFile, type LocaisInfoFile, type MetaFile, type TotalCargo } from '../../src/lib/data-types';
import { Aggregator } from './aggregate';
import { readZipCsv } from './csv';
import { ensureFile, UFS, urls } from './download';
import { loadCentroides, loadExterior, loadLocais, loadTseIbge } from './refs';
import { rollup, type Refs } from './rollup';
import { OUT, writeJson } from './write';

const MAJORITARIOS = new Set<Cargo>(['presidente', 'governador', 'senador', 'prefeito']);

async function runAno(ano: Ano, base: Omit<Refs, 'locais'>): Promise<Partial<Record<Cargo, TotalCargo>>> {
  const tipo = TIPO[ano];
  const cargos = CARGOS_POR_TIPO[tipo];
  const refs: Refs = { ...base, locais: await loadLocais(await ensureFile(urls.locais(ano))) };
  console.log(`[${ano}] ${refs.locais.size} locais com coordenadas`);
  const files = new Map<Cargo, CargoAnoFile>(cargos.map((c) => [c, {
    ano, cargo: c, candidatos: [], ufsComCandidatura: [], ufs: [], municipios: [], exterior: null,
  }]));
  const unidades = new Map<Cargo, number>();
  const infoPorUf = new Map<string, LocaisInfoFile>();

  const process = async (zip: string, cs: Cargo[]) => {
    const agg = new Aggregator();
    for await (const r of readZipCsv(zip)) agg.add(r);
    for (const cargo of cs) {
      // só seções dentro das unidades (Brasil / UF / município) onde a UP disputou
      const secs = agg.sectionsComCandidatura(cargo);
      if (!secs.length) continue;
      const r = rollup(secs, refs);
      const f = files.get(cargo)!;
      f.candidatos = [...new Set([...f.candidatos, ...agg.candidatos(cargo)])].sort();
      f.ufsComCandidatura.push(...r.ufs.map((u) => u.uf));
      f.ufs.push(...r.ufs);
      f.municipios.push(...r.municipios);
      if (cargo === 'presidente') f.exterior = { cidades: r.cidades, paises: r.paises };
      unidades.set(cargo, (unidades.get(cargo) ?? 0) + agg.unidadesComCandidatura(cargo).size);
      for (const [uf, l] of r.locaisPorUf) {
        writeJson(`${ano}/${cargo}/locais/${uf}.json`, l.votos);
        infoPorUf.set(uf, { ...(infoPorUf.get(uf) ?? {}), ...l.info });
      }
    }
  };

  if (tipo === 'geral') await process(await ensureFile(urls.secao(ano, 'BR')), ['presidente']);
  const cargosUf = cargos.filter((c) => UNIDADE[c] !== 'br');
  const ufs = tipo === 'municipal' ? UFS.filter((u) => u !== 'DF') : UFS; // DF não tem eleição municipal
  for (const uf of ufs) {
    console.log(`[${ano}] ${uf}`);
    await process(await ensureFile(urls.secao(ano, uf)), cargosUf);
  }
  for (const [uf, info] of infoPorUf) writeJson(`${ano}/locais/${uf}.json`, info);

  const totais: Partial<Record<Cargo, TotalCargo>> = {};
  for (const [cargo, f] of files) {
    if (!f.ufs.length) continue;
    f.ufs.sort((a, b) => a.uf.localeCompare(b.uf));
    f.ufsComCandidatura.sort();
    writeJson(`${ano}/${cargo}.json`, f);
    const up = f.ufs.reduce((s, u) => s + u.up, 0);
    const upExterior = f.ufs.find((u) => u.uf === 'ZZ')?.up ?? 0;
    totais[cargo] = {
      up, validos: f.ufs.reduce((s, u) => s + u.validos, 0), upBrasil: up - upExterior, upExterior,
      unidadesComCandidatura: unidades.get(cargo) ?? 0,
      municipiosComVoto: f.municipios.filter((m) => m.up > 0).length,
      candidatos: MAJORITARIOS.has(cargo) ? f.candidatos : [],
    };
  }
  return totais;
}

async function main() {
  const arg = process.argv.indexOf('--ano');
  const anos: Ano[] = arg > -1 && process.argv[arg + 1] !== 'all' ? [Number(process.argv[arg + 1]) as Ano] : [...ANOS];
  const base = { tseIbge: loadTseIbge(), centroides: loadCentroides(), exterior: loadExterior() };
  const metaPath = `${OUT}/meta.json`;
  const meta: MetaFile = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { geradoEm: '', fonte: 'TSE — Portal de Dados Abertos (dadosabertos.tse.jus.br)', disponivel: {}, totais: {} };
  for (const ano of anos) {
    fs.rmSync(`${OUT}/${ano}`, { recursive: true, force: true });
    const totais = await runAno(ano, base);
    meta.totais[ano] = totais;
    meta.disponivel[ano] = Object.keys(totais) as Cargo[];
  }
  meta.geradoEm = new Date().toISOString();
  writeJson('meta.json', meta);
  console.log('ETL ok', JSON.stringify(meta.totais, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Rodar 2026** — `npm run etl -- --ano 2026` (baixa ~2–3 GB na 1ª vez). Esperado: termina com `ETL ok`, `public/data/2026/presidente.json` existe e a soma de `ufs[].up` = 122911:

```bash
node -e "const f=require('./public/data/2026/presidente.json');console.log(f.ufs.reduce((s,u)=>s+u.up,0), f.candidatos)"
```

- [ ] **Step 4: Rodar 2022** — `npm run etl -- --ano 2022`; soma Presidente = 53519.
- [ ] **Step 5: Tamanho** — `du -sh public/data` (meta: < 60 MB; nenhum arquivo > 5 MB: `find public/data -size +5M`). Se exceder, reduzir casas decimais de lat/lon em `rollup.ts` para 5.
- [ ] **Step 6: Commit** — `feat(etl): orquestrador e dados gerados 2022/2026`

### Task 12: Validação contra totais oficiais por partido

**Files:** Create `scripts/etl/validate.ts`

- [ ] **Step 1: Implementação**

```ts
import fs from 'node:fs';
import { ANOS, CARGOS_POR_TIPO, TIPO, type Ano, type CargoAnoFile } from '../../src/lib/data-types';
import { cargoFromCode } from './cargos';
import { readZipCsv } from './csv';
import { ensureFile, urls } from './download';

async function main() {
  let falhas = 0;
  const arg = process.argv.indexOf('--ano');
  const anos: Ano[] = arg > -1 ? [Number(process.argv[arg + 1]) as Ano] : ANOS.filter((a) => fs.existsSync(`public/data/${a}`));
  for (const ano of anos) {
    const CARGOS = CARGOS_POR_TIPO[TIPO[ano]];
    const oficial = new Map<string, { validos: number; anul: number }>();
    // só CSVs por UF: o zip também traz um _BRASIL.csv que duplicaria os totais
    for await (const r of readZipCsv(await ensureFile(urls.partido(ano)), (n) => !/BRASIL/i.test(n))) {
      if (r.NR_PARTIDO !== '80' || r.NR_TURNO !== '1') continue;
      const cargo = cargoFromCode(Number(r.CD_CARGO)); if (!cargo) continue;
      const k = `${cargo}|${r.SG_UF}`;
      const t = oficial.get(k) ?? { validos: 0, anul: 0 };
      t.validos += Number(r.QT_VOTOS_NOMINAIS_VALIDOS) + Number(r.QT_VOTOS_LEGENDA_VALIDOS);
      t.anul += ['QT_VOTOS_LEGENDA_ANUL_SUBJUD', 'QT_VOTOS_NOMINAIS_ANUL_SUBJUD', 'QT_VOTOS_LEGENDA_ANULADOS', 'QT_VOTOS_NOMINAIS_ANULADOS']
        .reduce((s, c) => s + Number(r[c] || 0), 0);
      oficial.set(k, t);
    }
    for (const cargo of CARGOS) {
      const p = `public/data/${ano}/${cargo}.json`;
      const nosso = new Map<string, number>();
      if (fs.existsSync(p)) for (const u of (JSON.parse(fs.readFileSync(p, 'utf8')) as CargoAnoFile).ufs) nosso.set(u.uf, u.up);
      const ufs = new Set([...nosso.keys(), ...[...oficial.keys()].filter((k) => k.startsWith(cargo + '|')).map((k) => k.split('|')[1])]);
      for (const uf of ufs) {
        const o = oficial.get(`${cargo}|${uf}`) ?? { validos: 0, anul: 0 };
        const n = nosso.get(uf) ?? 0;
        const ok = n >= o.validos && n <= o.validos + o.anul;
        if (!ok) { falhas++; console.error(`✗ ${ano} ${cargo} ${uf}: nosso=${n} oficial=${o.validos} (+${o.anul} anulados)`); }
      }
      console.log(`✓ ${ano} ${cargo}: ${ufs.size} UFs conferidas`);
    }
  }
  if (falhas) { console.error(`${falhas} divergências`); process.exit(1); }
  console.log('validação ok');
}
main();
```

- [ ] **Step 2: Rodar** — `npm run validate` → `validação ok`. Se houver divergência: investigar (superpowers:systematic-debugging) antes de alterar a regra.
- [ ] **Step 3: Commit** — `feat(etl): validação contra votacao_partido_munzona`

---

## Fase 2 — Lógica do site (pura, testada)

### Task 13: Filtros ↔ URL

**Files:** Create `src/lib/filters.ts`; Test `tests/lib/filters.test.ts`

Modelo: o usuário escolhe a eleição **atual** (`ano`, `cargo`) e, opcionalmente, uma **referência** (`ref`, `refCargo`) para comparar.
- `refCargo` padrão: o mesmo cargo se `ref` for do mesmo tipo; senão o cargo proporcional do tipo de `ref` (`PROPORCIONAL`).
- **Correspondente** = `refCargo === cargo`. Comparação não correspondente força `metrica = 'votos'`.
- `tela`: `'mapa'` (padrão) ou `'linha'` (linha do tempo).

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { parseFilters, toQuery, DEFAULT_FILTERS, isCompare, isCorrespondente } from '@/lib/filters';

const p = (q: string) => parseFilters(new URLSearchParams(q));

describe('filters', () => {
  it('usa padrões quando vazio ou inválido', () => {
    expect(p('')).toEqual(DEFAULT_FILTERS);
    expect(p('ano=1999&cargo=rei')).toEqual(DEFAULT_FILTERS);
  });
  it('cargo inválido para o tipo da eleição cai no primeiro cargo do tipo', () => {
    expect(p('ano=2024&cargo=presidente')).toMatchObject({ ano: 2024, cargo: 'prefeito' });
  });
  it('referência do mesmo tipo usa o mesmo cargo; de outro tipo usa o proporcional', () => {
    expect(p('ano=2026&cargo=senador&ref=2022')).toMatchObject({ ref: 2022, refCargo: 'senador' });
    expect(p('ano=2026&cargo=depfed&ref=2024')).toMatchObject({ ref: 2024, refCargo: 'vereador' });
    expect(p('ano=2026&cargo=depfed&ref=2024&refCargo=prefeito')).toMatchObject({ refCargo: 'prefeito' });
    expect(p('ano=2026&ref=2026').ref).toBeUndefined(); // referência igual ao ano atual é descartada
  });
  it('comparação não correspondente força votos', () => {
    const f = p('ano=2026&cargo=depfed&ref=2024&metrica=pct');
    expect(isCompare(f)).toBe(true);
    expect(isCorrespondente(f)).toBe(false);
    expect(f.metrica).toBe('votos');
    expect(p('ano=2026&cargo=depfed&ref=2022&metrica=pct').metrica).toBe('pct');
  });
  it('escopo exterior zera UF e município', () => {
    expect(p('escopo=exterior&uf=SP&mun=3550308')).toMatchObject({ escopo: 'exterior', uf: undefined, mun: undefined });
  });
  it('ida e volta e omissão de padrões', () => {
    const g = { ...DEFAULT_FILTERS, ano: 2024, cargo: 'vereador', ref: 2020, refCargo: 'vereador', metrica: 'pct', escopo: 'brasil', uf: 'SP', mun: 3550308 } as const;
    expect(p(toQuery(g))).toEqual(g);
    expect(toQuery(DEFAULT_FILTERS)).toBe('');
    expect(toQuery({ ...DEFAULT_FILTERS, ref: 2022, refCargo: 'presidente' })).toBe('ref=2022'); // refCargo padrão omitido
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/lib/filters.test.ts` → FAIL.
- [ ] **Step 3: Implementação**

```ts
import { ANOS, CARGOS_POR_TIPO, PROPORCIONAL, TIPO, type Ano, type Cargo } from './data-types';

export type Metrica = 'votos' | 'pct';
export type Escopo = 'tudo' | 'brasil' | 'exterior';
export type Tela = 'mapa' | 'linha';
export interface Filters {
  tela: Tela; ano: Ano; cargo: Cargo; ref?: Ano; refCargo?: Cargo;
  metrica: Metrica; escopo: Escopo; uf?: string; mun?: number;
}

export const DEFAULT_FILTERS: Filters = {
  tela: 'mapa', ano: 2026, cargo: 'presidente', ref: undefined, refCargo: undefined,
  metrica: 'votos', escopo: 'tudo', uf: undefined, mun: undefined,
};

export const isCompare = (f: Filters) => f.ref !== undefined;
export const isCorrespondente = (f: Filters) => isCompare(f) && f.refCargo === f.cargo;
/** Cargo de referência padrão para comparar `cargo` (de `ano`) com a eleição `ref`. */
export const defaultRefCargo = (ano: Ano, cargo: Cargo, ref: Ano): Cargo =>
  TIPO[ano] === TIPO[ref] ? cargo : PROPORCIONAL[TIPO[ref]];

const pick = <T extends string>(v: string | null, ok: readonly T[], d: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : d);
const pickAno = (v: string | null): Ano | undefined => (ANOS as readonly number[]).includes(Number(v)) ? (Number(v) as Ano) : undefined;

export function parseFilters(q: URLSearchParams): Filters {
  const ano = pickAno(q.get('ano')) ?? DEFAULT_FILTERS.ano;
  const cargosAno = CARGOS_POR_TIPO[TIPO[ano]];
  const cargo = pick(q.get('cargo'), cargosAno, ano === DEFAULT_FILTERS.ano ? DEFAULT_FILTERS.cargo : cargosAno[0]);
  const refRaw = pickAno(q.get('ref'));
  const ref = refRaw !== ano ? refRaw : undefined;
  const refCargo = ref ? pick(q.get('refCargo'), CARGOS_POR_TIPO[TIPO[ref]], defaultRefCargo(ano, cargo, ref)) : undefined;
  const escopo = pick(q.get('escopo'), ['tudo', 'brasil', 'exterior'] as const, DEFAULT_FILTERS.escopo);
  const uf = escopo !== 'exterior' && /^[A-Z]{2}$/.test(q.get('uf') ?? '') ? q.get('uf')! : undefined;
  const mun = uf && /^\d{7}$/.test(q.get('mun') ?? '') ? Number(q.get('mun')) : undefined;
  let metrica = pick(q.get('metrica'), ['votos', 'pct'] as const, DEFAULT_FILTERS.metrica);
  if (ref && refCargo !== cargo) metrica = 'votos';
  return { tela: pick(q.get('tela'), ['mapa', 'linha'] as const, 'mapa'), ano, cargo, ref, refCargo, metrica, escopo, uf, mun };
}

export function toQuery(f: Filters): string {
  const q = new URLSearchParams();
  if (f.tela !== 'mapa') q.set('tela', f.tela);
  if (f.ano !== DEFAULT_FILTERS.ano) q.set('ano', String(f.ano));
  if (f.cargo !== DEFAULT_FILTERS.cargo) q.set('cargo', f.cargo);
  if (f.ref) {
    q.set('ref', String(f.ref));
    if (f.refCargo && f.refCargo !== defaultRefCargo(f.ano, f.cargo, f.ref)) q.set('refCargo', f.refCargo);
  }
  if (f.metrica !== DEFAULT_FILTERS.metrica) q.set('metrica', f.metrica);
  if (f.escopo !== DEFAULT_FILTERS.escopo) q.set('escopo', f.escopo);
  if (f.uf) q.set('uf', f.uf);
  if (f.mun) q.set('mun', String(f.mun));
  return q.toString();
}
```

- [ ] **Step 4:** `npx vitest run tests/lib/filters.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(site): filtros eleição/cargo/referência na URL`

### Task 14: Métricas, comparação e casamento de locais

**Files:** Create `src/lib/metrics.ts`, `src/lib/compare.ts`; Test `tests/lib/compare.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { value, delta } from '@/lib/metrics';
import { joinRows, matchLocais, normalizeName } from '@/lib/compare';

describe('metrics', () => {
  it('valor e delta', () => {
    expect(value({ up: 5, validos: 200 }, 'pct')).toBeCloseTo(2.5);
    expect(value({ up: 5, validos: 0 }, 'pct')).toBe(0);
    expect(delta({ up: 5, validos: 100 }, { up: 15, validos: 100 }, 'votos')).toBe(10);
    expect(delta({ up: 5, validos: 100 }, { up: 15, validos: 100 }, 'pct')).toBeCloseTo(10);
    expect(delta(undefined, { up: 3, validos: 10 }, 'votos')).toBe(3);   // ausente = 0 votos
    expect(delta(undefined, undefined, 'votos')).toBeNull();
  });
});

describe('compare', () => {
  it('junta por chave, mantendo ausentes', () => {
    const r = joinRows([{ id: 1, up: 1, validos: 10 }], [{ id: 1, up: 2, validos: 10 }, { id: 2, up: 3, validos: 9 }], (x) => x.id);
    expect(r.map((x) => [x.key, x.a?.up, x.b?.up])).toEqual([[1, 1, 2], [2, undefined, 3]]);
  });
  it('normaliza nomes', () => {
    expect(normalizeName('E.M.E.F.  Profª  Maria José ')).toBe('emef profa maria jose');
  });
  it('casa locais por chave e, na falta, por nome no mesmo município', () => {
    const a = { '1-1-10': ['ESCOLA A', 0, 0, 0, 1], '1-1-11': ['ESCOLA B', 0, 0, 0, 1] } as const;
    const b = { '1-1-10': ['ESCOLA A', 0, 0, 0, 1], '1-2-99': ['Escola B', 0, 0, 0, 1], '1-2-50': ['ESCOLA C', 0, 0, 0, 1] } as const;
    expect(matchLocais(a as any, b as any)).toEqual(new Map([['1-1-10', '1-1-10'], ['1-1-11', '1-2-99']]));
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

`src/lib/metrics.ts`:
```ts
import type { Tally } from './data-types';
import type { Metrica } from './filters';
export const value = (t: Tally | undefined, m: Metrica): number =>
  !t ? 0 : m === 'votos' ? t.up : t.validos > 0 ? (t.up / t.validos) * 100 : 0;
export const delta = (a: Tally | undefined, b: Tally | undefined, m: Metrica): number | null =>
  !a && !b ? null : value(b, m) - value(a, m);
```

`src/lib/compare.ts`:
```ts
import type { LocaisInfoFile } from './data-types';

export interface Joined<T, K> { key: K; a?: T; b?: T }
export function joinRows<T, K>(a: T[], b: T[], key: (x: T) => K): Joined<T, K>[] {
  const m = new Map<K, Joined<T, K>>();
  for (const x of a) m.set(key(x), { key: key(x), a: x });
  for (const x of b) { const k = key(x); const j = m.get(k) ?? { key: k }; j.b = x; m.set(k, j); }
  return [...m.values()];
}

export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ª/g, 'a').replace(/º/g, 'o')
    .toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Mapa chave2022 → chave2026: mesma chave; senão mesmo nome normalizado no mesmo município (tse). */
export function matchLocais(a: LocaisInfoFile, b: LocaisInfoFile): Map<string, string> {
  const out = new Map<string, string>();
  const usados = new Set<string>();
  for (const k of Object.keys(a)) if (b[k]) { out.set(k, k); usados.add(k); }
  const porNome = new Map<string, string>();
  for (const [k, v] of Object.entries(b)) if (!usados.has(k)) porNome.set(`${v[4]}|${normalizeName(v[0])}`, k);
  for (const [k, v] of Object.entries(a)) {
    if (out.has(k)) continue;
    const kb = porNome.get(`${v[4]}|${normalizeName(v[0])}`);
    if (kb && !usados.has(kb)) { out.set(k, kb); usados.add(kb); }
  }
  return out;
}
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(site): métricas, deltas e casamento de locais`

### Task 15: ViewModel

**Files:** Create `src/lib/view.ts`; Test `tests/lib/view.test.ts`

Responsabilidade: dado `Filters` + o arquivo da eleição **atual** e, se houver, o da **referência**, decidir o **nível** (`uf` | `municipio` | `pais`) e produzir `ViewRow[]` e KPIs. Convenção: `b` = atual, `a` = referência, `delta = valor(b) − valor(a)`. Mapa, gráficos e tabela consomem só isso.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { buildView } from '@/lib/view';
import { DEFAULT_FILTERS, type Filters } from '@/lib/filters';
import type { Ano, Cargo, CargoAnoFile } from '@/lib/data-types';

const file = (ano: Ano, cargo: Cargo, upSP: number, upRJ: number, upLis: number | null): CargoAnoFile => ({
  ano, cargo, candidatos: ['X'], ufsComCandidatura: upLis === null ? ['RJ', 'SP'] : ['RJ', 'SP', 'ZZ'],
  ufs: [{ uf: 'RJ', up: upRJ, validos: 100 }, { uf: 'SP', up: upSP, validos: 100 }, ...(upLis === null ? [] : [{ uf: 'ZZ', up: upLis, validos: 10 }])],
  municipios: [{ ibge: 3550308, tse: 71072, uf: 'SP', nome: 'São Paulo', up: upSP, validos: 100 }, { ibge: 3304557, tse: 60011, uf: 'RJ', nome: 'Rio de Janeiro', up: upRJ, validos: 100 }],
  exterior: upLis === null ? null : { cidades: [{ tse: 29955, nome: 'Lisboa', iso3: 'PRT', pais: 'Portugal', lat: 1, lon: 1, up: upLis, validos: 10 }], paises: [{ iso3: 'PRT', isoNum: '620', pais: 'Portugal', up: upLis, validos: 10 }] },
});
const p22 = file(2022, 'presidente', 10, 5, 1), p26 = file(2026, 'presidente', 20, 2, 3);
const f = (o: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...o });

describe('buildView', () => {
  it('sem comparação: nível UF, KPIs incluem exterior no escopo tudo', () => {
    const v = buildView(f({}), p26);
    expect(v.level).toBe('uf');
    expect(v.rows.map((r) => r.id)).toEqual(['SP', 'RJ']);
    expect(v.kpis.total).toBe(25);
    expect(v.kpis.totalRef).toBeNull();
    expect(v.labelAtual).toBe('2026 · Presidente');
  });
  it('escopo brasil exclui exterior', () => {
    expect(buildView(f({ escopo: 'brasil' }), p26).kpis.total).toBe(22);
  });
  it('UF selecionada → municípios da UF', () => {
    const v = buildView(f({ uf: 'SP' }), p26);
    expect(v.level).toBe('municipio');
    expect(v.rows.map((r) => r.nome)).toEqual(['São Paulo']);
  });
  it('comparação correspondente no exterior → países com delta', () => {
    const v = buildView(f({ escopo: 'exterior', ref: 2022, refCargo: 'presidente' }), p26, p22);
    expect(v.level).toBe('pais');
    expect(v.correspondente).toBe(true);
    expect(v.rows[0]).toMatchObject({ id: 'PRT', a: { up: 1 }, b: { up: 3 }, delta: 2 });
    expect(v.kpis.totalRef).toBe(16);
  });
  it('comparação não correspondente: só votos, sem exterior', () => {
    const ver = file(2024, 'vereador', 7, 0, null);
    const dep = file(2026, 'depfed', 9, 4, null);
    const v = buildView(f({ cargo: 'depfed', ref: 2024, refCargo: 'vereador' }), dep, ver);
    expect(v.correspondente).toBe(false);
    expect(v.rows.find((r) => r.id === 'SP')).toMatchObject({ a: { up: 7 }, b: { up: 9 }, delta: 2 });
    expect(v.labelRef).toBe('2024 · Vereador');
    expect(v.kpis.pctRef).toBeNull();
    const ext = buildView(f({ cargo: 'depfed', ref: 2024, refCargo: 'vereador', escopo: 'exterior' }), dep, ver);
    expect(ext.aviso).toMatch(/exterior/i);
  });
  it('cargo sem candidatura', () => {
    expect(buildView(f({ cargo: 'governador' }), undefined).aviso).toMatch(/não teve candidatura/);
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
import { CARGO_LABEL, type Ano, type Cargo, type CargoAnoFile, type Tally } from './data-types';
import { isCompare, isCorrespondente, type Filters } from './filters';
import { delta, value } from './metrics';
import { joinRows } from './compare';

export type Level = 'uf' | 'municipio' | 'pais';
export interface ViewRow { id: string; nome: string; uf?: string; a?: Tally; b?: Tally; value: number; delta: number | null; isoNum?: string }
export interface ViewModel {
  level: Level; rows: ViewRow[]; aviso?: string;
  compare: boolean; correspondente: boolean;
  labelAtual: string; labelRef?: string;
  kpis: { total: number; totalRef: number | null; pct: number; pctRef: number | null; lugaresComVoto: number };
  candidatos: string[];
}

export const serieLabel = (ano: Ano, cargo: Cargo) => `${ano} · ${CARGO_LABEL[cargo]}`;
const sum = (xs: Tally[]): Tally => xs.reduce((s, x) => ({ up: s.up + x.up, validos: s.validos + x.validos }), { up: 0, validos: 0 });

interface Base { id: string; nome: string; uf?: string; isoNum?: string; t: Tally }
function rowsFor(file: CargoAnoFile | undefined, f: Filters, level: Level): Base[] {
  if (!file) return [];
  switch (level) {
    case 'uf': return file.ufs.filter((u) => u.uf !== 'ZZ').map((u) => ({ id: u.uf, nome: u.uf, t: u }));
    case 'municipio': return file.municipios.filter((m) => m.uf === f.uf).map((m) => ({ id: String(m.ibge), nome: m.nome, uf: m.uf, t: m }));
    case 'pais': return (file.exterior?.paises ?? []).map((p) => ({ id: p.iso3, nome: p.pais, isoNum: p.isoNum, t: p }));
  }
}

function scopeTally(file: CargoAnoFile | undefined, f: Filters): Tally | null {
  if (!file) return null;
  if (f.mun) return sum(file.municipios.filter((m) => m.ibge === f.mun));
  return sum(file.ufs
    .filter((u) => (f.escopo === 'exterior' ? u.uf === 'ZZ' : f.escopo === 'brasil' ? u.uf !== 'ZZ' : true))
    .filter((u) => !f.uf || u.uf === f.uf));
}

export function buildView(f: Filters, atual: CargoAnoFile | undefined, ref?: CargoAnoFile): ViewModel {
  const compare = isCompare(f), correspondente = isCorrespondente(f);
  const level: Level = f.escopo === 'exterior' ? 'pais' : f.uf ? 'municipio' : 'uf';
  const labelAtual = serieLabel(f.ano, f.cargo);
  const labelRef = compare ? serieLabel(f.ref!, f.refCargo!) : undefined;

  let aviso: string | undefined;
  if (f.escopo === 'exterior' && (f.cargo !== 'presidente' || (compare && f.refCargo !== 'presidente')))
    aviso = 'No exterior só se vota para Presidente (2022 e 2026). Escolha Presidente nos dois lados para ver os votos internacionais.';
  else if (!atual && !(compare && ref)) aviso = `A UP não teve candidatura para ${CARGO_LABEL[f.cargo]} em ${f.ano}.`;
  else if (f.uf && ![atual, ref].some((x) => x?.ufsComCandidatura.includes(f.uf!)))
    aviso = `A UP não teve candidatura para este cargo em ${f.uf}.`;

  const joined = aviso ? [] : joinRows(rowsFor(compare ? ref : undefined, f, level), rowsFor(atual, f, level), (r) => r.id);
  const rows: ViewRow[] = joined.map(({ key, a, b }) => {
    const base = (b ?? a)!;
    return {
      id: key, nome: base.nome, uf: base.uf, isoNum: base.isoNum,
      a: a ? { up: a.t.up, validos: a.t.validos } : undefined,
      b: b ? { up: b.t.up, validos: b.t.validos } : undefined,
      value: value(b?.t, f.metrica),
      delta: compare ? delta(a?.t, b?.t, f.metrica) : null,
    };
  }).sort((x, y) => (compare ? Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0) : y.value - x.value));

  const ta = scopeTally(atual, f), tr = compare ? scopeTally(ref, f) : null;
  return {
    level, rows, aviso, compare, correspondente, labelAtual, labelRef,
    kpis: {
      total: ta?.up ?? 0, totalRef: tr ? tr.up : null,
      pct: value(ta ?? undefined, 'pct'), pctRef: tr && correspondente ? value(tr, 'pct') : null,
      lugaresComVoto: rows.filter((r) => (r.b?.up ?? 0) > 0).length,
    },
    candidatos: atual?.candidatos ?? [],
  };
}
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(site): view model compartilhado por mapa, gráficos e tabela`

### Task 16: Cores e formatação

**Files:** Create `src/lib/colors.ts`, `src/lib/format.ts`; Test `tests/lib/format.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { fmtInt, fmtPct, fmtDelta } from '@/lib/format';
import { seqColor, divColor, PALETTE } from '@/lib/colors';

it('formata pt-BR', () => {
  expect(fmtInt(122911)).toBe('122.911');
  expect(fmtPct(2.456)).toBe('2,46%');
  expect(fmtDelta(1200, 'votos')).toBe('+1.200');
  expect(fmtDelta(-0.5, 'pct')).toBe('−0,50 p.p.');
});
it('escalas', () => {
  expect(seqColor(0, 100)).toBe(PALETTE.zero);
  expect(divColor(10, 10)).toBe(PALETTE.cresceu.toLowerCase());
  expect(divColor(-10, 10)).toBe(PALETTE.caiu.toLowerCase());
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

`src/lib/format.ts`:
```ts
import type { Metrica } from './filters';
const int = new Intl.NumberFormat('pt-BR');
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (n: number) => int.format(Math.round(n));
export const fmtPct = (n: number) => `${dec2.format(n)}%`;
export const fmtValue = (n: number, m: Metrica) => (m === 'votos' ? fmtInt(n) : fmtPct(n));
export const fmtDelta = (n: number, m: Metrica) => {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return m === 'votos' ? `${s}${fmtInt(Math.abs(n))}` : `${s}${dec2.format(Math.abs(n))} p.p.`;
};
```

`src/lib/colors.ts`:
```ts
import { scaleSequentialSqrt, scaleDiverging } from 'd3-scale';
import { interpolateRgbBasis, interpolateRgb } from 'd3-interpolate';
import type { Cargo } from './data-types';

export const PALETTE = {
  preto: '#000000', grafite: '#242424', branco: '#FFFFFF', cinzaClaro: '#E8E8E8', areia: '#CCC5BC',
  amarelo: '#FFC107', verde: '#2B3B2B', creme: '#EAD8BF', queimado: '#C66F2F', vermelho: '#D64444',
  roxo: '#545288', mostarda: '#DDCB6E', laranjaClaro: '#F4AA34', laranja: '#F4900C',
  ref: '#545288', atual: '#F4900C', cresceu: '#C66F2F', caiu: '#545288', neutro: '#EAD8BF', zero: '#F3EFEA',
} as const;

/** Cores por cargo (linha do tempo). Proporcionais (Dep. Federal, Vereador) em laranjas: "força do partido". */
export const CARGO_COLOR: Record<Cargo, string> = {
  presidente: PALETTE.roxo, governador: PALETTE.verde, senador: PALETTE.vermelho,
  depfed: PALETTE.laranja, depest: PALETTE.mostarda, prefeito: PALETTE.queimado, vereador: PALETTE.laranjaClaro,
};

const seq = interpolateRgbBasis([PALETTE.creme, PALETTE.laranjaClaro, PALETTE.queimado, PALETTE.verde]);
export const seqColor = (v: number, max: number) => (v <= 0 || max <= 0 ? PALETTE.zero : scaleSequentialSqrt(seq).domain([0, max])(v));
export const divColor = (d: number, maxAbs: number) => {
  if (maxAbs <= 0) return PALETTE.neutro;
  const s = scaleDiverging((t: number) => (t < 0.5 ? interpolateRgb(PALETTE.caiu, PALETTE.neutro)(t * 2) : interpolateRgb(PALETTE.neutro, PALETTE.cresceu)((t - 0.5) * 2)))
    .domain([-maxAbs, 0, maxAbs]).clamp(true);
  return s(d);
};
```

(Nota: d3 devolve `rgb(r, g, b)`; no teste de `divColor` comparar via `d3-color`: ajustar asserção para `expect(divColor(10,10)).toBe(interpolateRgb(PALETTE.neutro, PALETTE.cresceu)(1))` se a forma de string divergir.)

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(site): paleta UP, escalas e formatação pt-BR`

### Task 17: Carregamento de dados

**Files:** Create `src/lib/load.ts`

- [ ] **Step 1: Implementação**

```ts
'use client';
import { useEffect, useState } from 'react';
import type { Ano, Cargo, CargoAnoFile, LocaisInfoFile, LocaisVotosFile, MetaFile } from './data-types';

const cache = new Map<string, Promise<unknown>>();
export function fetchJson<T>(path: string): Promise<T | null> {
  if (!cache.has(path)) cache.set(path, fetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(path) as Promise<T | null>;
}

/** Carrega `path` (ou nada, se null). `loading` é true enquanto o dado corrente não chegou. */
export function useJson<T>(path: string | null): { data: T | null; loading: boolean } {
  const [state, set] = useState<{ path: string | null; data: T | null }>({ path: null, data: null });
  useEffect(() => {
    let on = true;
    if (path) fetchJson<T>(path).then((d) => on && set({ path, data: d }));
    return () => { on = false; };
  }, [path]);
  return { data: state.path === path ? state.data : null, loading: !!path && state.path !== path };
}

export const paths = {
  meta: '/data/meta.json',
  cargoAno: (ano: Ano, cargo: Cargo) => `/data/${ano}/${cargo}.json`,
  locaisInfo: (ano: Ano, uf: string) => `/data/${ano}/locais/${uf}.json`,
  locaisVotos: (ano: Ano, cargo: Cargo, uf: string) => `/data/${ano}/${cargo}/locais/${uf}.json`,
};

/** Arquivo de uma eleição×cargo, só se o meta diz que existe (evita 404). */
export function useSerie(meta: MetaFile | null, ano: Ano | undefined, cargo: Cargo | undefined) {
  const ok = !!meta && !!ano && !!cargo && (meta.disponivel[ano] ?? []).includes(cargo);
  return useJson<CargoAnoFile>(ok ? paths.cargoAno(ano!, cargo!) : null);
}
export type { MetaFile, LocaisInfoFile, LocaisVotosFile };
```

- [ ] **Step 2:** `npx tsc --noEmit` sem erros. **Step 3: Commit** — `feat(site): carregamento de dados com cache`

## Fase 3 — Interface

Diretrizes visuais para todas as tasks desta fase (do spec):
- Fundo da página branco; hero e faixas em areia `#CCC5BC`; texto `#000`/`#242424`.
- Títulos `font-display` (Barlow Condensed 800, caixa alta); texto `font-sans` (Barlow); números `tabular-nums`.
- Amarelo `#FFC107` só como bloco com texto preto (CTA, número "80", destaque de KPI).
- Cantos retos ou raio pequeno (2px), bordas pretas de 2px em controles ativos — estética de cartaz.
- Tema escuro: fundo `#242424`, superfícies `#000`, logo branca.

### Task 18: Layout, fontes, tema e marca

**Files:** Create `src/app/layout.tsx`, `src/app/globals.css`, `src/components/Logo.tsx`, `src/components/JoinCta.tsx`, `src/components/Hero.tsx`, `src/components/Footer.tsx`

- [ ] **Step 1: `globals.css`**

```css
@import 'tailwindcss';

@theme {
  --color-preto: #000000; --color-grafite: #242424; --color-branco: #ffffff; --color-cinza: #e8e8e8;
  --color-areia: #ccc5bc; --color-amarelo: #ffc107; --color-verde: #2b3b2b; --color-creme: #ead8bf;
  --color-queimado: #c66f2f; --color-vermelho: #d64444; --color-roxo: #545288; --color-laranja: #f4900c;
  --font-display: var(--font-barlow-condensed), 'Arial Narrow', sans-serif;
  --font-sans: var(--font-barlow), system-ui, sans-serif;
}

:root { --bg: #ffffff; --fg: #000000; --surface: #ffffff; --band: #ccc5bc; --muted: #4a4a4a; --line: #000000; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { --bg: #242424; --fg: #ffffff; --surface: #000000; --band: #3a3632; --muted: #bdbdbd; --line: #ffffff; color-scheme: dark; }
}
:root[data-theme='dark'] { --bg: #242424; --fg: #ffffff; --surface: #000000; --band: #3a3632; --muted: #bdbdbd; --line: #ffffff; color-scheme: dark; }

body { background: var(--bg); color: var(--fg); font-family: var(--font-sans); }
.num { font-variant-numeric: tabular-nums; }
.maplibregl-popup-content { border-radius: 2px; border: 2px solid #000; font-family: var(--font-sans); }
```

- [ ] **Step 2: `layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-barlow' });
const barlowCond = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], style: ['normal', 'italic'], variable: '--font-barlow-condensed' });

export const metadata: Metadata = {
  title: 'UP nas urnas — 2022 × 2026',
  description: 'Mapa e comparativo dos votos da Unidade Popular (80) nas eleições de 2022 e 2026, no Brasil e no exterior.',
  icons: { icon: '/brand/up-logo-black.svg' },
  openGraph: { title: 'UP nas urnas — 2022 × 2026', description: 'Onde a Unidade Popular cresceu e onde precisa crescer.', locale: 'pt_BR', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCond.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: `Logo.tsx`**

```tsx
export function Logo({ className = 'h-10 w-auto', invert = false }: { className?: string; invert?: boolean }) {
  return (
    <>
      <img src={invert ? '/brand/up-logo-white.svg' : '/brand/up-logo-black.svg'} alt="Unidade Popular" className={`${className} dark:hidden`} />
      <img src="/brand/up-logo-white.svg" alt="" aria-hidden className={`${className} hidden dark:block`} />
    </>
  );
}
```

- [ ] **Step 4: `JoinCta.tsx`**

```tsx
export const FILIE_SE = 'https://unidadepopular.org.br/filie-se';
export function JoinCta({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg'
    ? 'px-6 py-4 text-2xl md:text-3xl'
    : 'px-3 py-1.5 text-base';
  return (
    <a href={FILIE_SE} target="_blank" rel="noopener"
      className={`inline-flex items-center gap-2 bg-amarelo text-preto font-display font-extrabold uppercase italic tracking-tight border-2 border-preto shadow-[4px_4px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] focus-visible:outline-3 focus-visible:outline-offset-2 transition-transform ${cls}`}>
      Votei na UP e quero me organizar! <span aria-hidden>→</span>
    </a>
  );
}
```

- [ ] **Step 5: `Hero.tsx`**

```tsx
import { Logo } from './Logo';
import { JoinCta } from './JoinCta';
export function Hero({ geradoEm }: { geradoEm?: string }) {
  return (
    <header className="bg-[var(--band)]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-16 grid gap-8 md:grid-cols-[1fr_auto] items-end">
        <div>
          <Logo className="h-14 md:h-20 w-auto" />
          <h1 className="mt-6 font-display font-extrabold uppercase leading-[0.9] text-5xl md:text-7xl">
            A Unidade Popular <br /> nas urnas <span className="inline-block bg-amarelo text-preto px-2 italic">80</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg md:text-xl font-light">
            Onde recebemos votos em 2022 e 2026, onde crescemos e onde ainda temos chão pela frente — no Brasil e no exterior.
          </p>
        </div>
        <JoinCta />
      </div>
      {geradoEm && <p className="mx-auto max-w-7xl px-4 pb-4 text-sm text-[var(--muted)]">Dados: TSE · atualizados em {new Date(geradoEm).toLocaleDateString('pt-BR')}</p>}
    </header>
  );
}
```

- [ ] **Step 6: `Footer.tsx`**

```tsx
import { Logo } from './Logo';
import { JoinCta } from './JoinCta';
export function Footer() {
  return (
    <footer className="bg-preto text-branco mt-16">
      <div className="mx-auto max-w-7xl px-4 py-12 flex flex-col md:flex-row gap-8 md:items-center md:justify-between">
        <div>
          <Logo invert className="h-12 w-auto" />
          <p className="mt-3 font-display uppercase text-2xl">Organize-se. Lute. Vença.</p>
          <p className="mt-2 text-sm text-cinza">Fonte: Tribunal Superior Eleitoral — Portal de Dados Abertos.</p>
        </div>
        <JoinCta />
      </div>
    </footer>
  );
}
```

- [ ] **Step 7:** `npx tsc --noEmit`. **Step 8: Commit** — `feat(ui): layout, tema UP, hero, CTA de filiação e rodapé`

### Task 19: Barra de filtros e abas

**Files:** Create `src/components/Segmented.tsx`, `src/components/FilterBar.tsx`

- [ ] **Step 1: `Segmented.tsx`**

```tsx
export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T | undefined; options: { value: T; label: string; disabled?: boolean; hint?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-display uppercase text-xs tracking-widest text-[var(--muted)] mb-1">{label}</legend>
      <div role="radiogroup" className="flex flex-wrap border-2 border-[var(--line)]">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled} title={o.hint}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 font-display font-bold uppercase text-sm md:text-base whitespace-nowrap transition-colors disabled:opacity-35 disabled:cursor-not-allowed
              ${value === o.value ? 'bg-[var(--fg)] text-[var(--bg)]' : 'hover:bg-[var(--band)]'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 2: `FilterBar.tsx`**

Regras de interação (a normalização final é sempre feita por `parseFilters` ao reler a URL):
- Trocar eleição ou cargo zera `refCargo` (volta ao padrão) e mantém `ref` se ainda for diferente do ano.
- "Comparar com" lista as outras eleições com dados; "Nenhuma" remove a referência.
- O seletor "Cargo de referência" aparece sempre que há referência; opções = cargos do tipo da referência com dados.
- % válidos fica desativado em comparação não correspondente, com texto explicativo.

```tsx
'use client';
import { ANOS, CARGOS_POR_TIPO, CARGO_LABEL, TIPO, type Ano, type Cargo, type MetaFile } from '@/lib/data-types';
import { isCompare, isCorrespondente, type Filters } from '@/lib/filters';
import { Segmented } from './Segmented';
import { JoinCta } from './JoinCta';

const tipoLabel = (a: Ano) => (TIPO[a] === 'geral' ? 'geral' : 'municipal');

export function FilterBar({ f, set, meta }: { f: Filters; set: (p: Partial<Filters>) => void; meta: MetaFile | null }) {
  const tem = (ano: Ano, cargo?: Cargo) => !!meta && (cargo ? (meta.disponivel[ano] ?? []).includes(cargo) : (meta.disponivel[ano] ?? []).length > 0);
  const compare = isCompare(f), corresp = isCorrespondente(f);

  return (
    <div className="sticky top-0 z-30 bg-[var(--bg)]/95 backdrop-blur border-b-2 border-[var(--line)]">
      <div className="mx-auto max-w-7xl px-4 pt-3 flex items-center gap-4">
        <div role="tablist" className="flex gap-1">
          {([['mapa', 'Mapa'], ['linha', 'Linha do tempo']] as const).map(([t, l]) => (
            <button key={t} role="tab" aria-selected={f.tela === t} onClick={() => set({ tela: t })}
              className={`px-4 py-2 font-display font-extrabold uppercase text-lg border-2 border-b-0 border-[var(--line)] ${f.tela === t ? 'bg-[var(--fg)] text-[var(--bg)]' : ''}`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto hidden lg:block"><JoinCta size="sm" /></div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-3 items-end border-t-2 border-[var(--line)]">
        {f.tela === 'mapa' && <>
          <Segmented label="Eleição" value={f.ano} onChange={(ano) => set({ ano, refCargo: undefined, ref: f.ref === ano ? undefined : f.ref, uf: f.uf, mun: f.mun })}
            options={ANOS.map((a) => ({ value: a, label: String(a), disabled: !tem(a), hint: `Eleição ${tipoLabel(a)}` }))} />
          <Segmented label="Cargo" value={f.cargo} onChange={(cargo) => set({ cargo, refCargo: undefined })}
            options={CARGOS_POR_TIPO[TIPO[f.ano]].map((c) => ({ value: c, label: CARGO_LABEL[c], disabled: !tem(f.ano, c) }))} />
          <Segmented<Ano | 0> label="Comparar com" value={f.ref ?? 0} onChange={(r) => set({ ref: r === 0 ? undefined : r, refCargo: undefined })}
            options={[{ value: 0, label: 'Nenhuma' }, ...ANOS.filter((a) => a !== f.ano).map((a) => ({ value: a, label: String(a), disabled: !tem(a), hint: `Eleição ${tipoLabel(a)}` }))]} />
          {compare && (
            <Segmented label="Cargo de referência" value={f.refCargo} onChange={(refCargo) => set({ refCargo })}
              options={CARGOS_POR_TIPO[TIPO[f.ref!]].map((c) => ({ value: c, label: CARGO_LABEL[c], disabled: !tem(f.ref!, c) }))} />
          )}
          <Segmented label="Métrica" value={f.metrica} onChange={(metrica) => set({ metrica })}
            options={[{ value: 'votos', label: 'Votos' }, { value: 'pct', label: '% válidos', disabled: compare && !corresp, hint: 'Só em comparações do mesmo cargo' }]} />
        </>}
        <Segmented label="Onde" value={f.escopo} onChange={(escopo) => set({ escopo, uf: undefined, mun: undefined })}
          options={[{ value: 'tudo', label: 'Tudo' }, { value: 'brasil', label: 'Brasil' }, { value: 'exterior', label: 'Exterior' }]} />
        {f.tela === 'mapa' && compare && !corresp && (
          <p className="basis-full text-sm">
            <span className="bg-amarelo text-preto px-1 font-semibold">Comparação entre cargos diferentes</span>{' '}
            ({CARGO_LABEL[f.cargo]} {f.ano} × {CARGO_LABEL[f.refCargo!]} {f.ref}): mostramos só o número de votos, por estado e município.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** `npx tsc --noEmit`. **Step 4: Commit** — `feat(ui): abas e barra de filtros com eleição de referência`

### Task 20: KPIs e Breadcrumb

**Files:** Create `src/components/KpiRow.tsx`, `src/components/Breadcrumb.tsx`

- [ ] **Step 1: `KpiRow.tsx`**

```tsx
import type { ViewModel } from '@/lib/view';
import { fmtDelta, fmtInt, fmtPct } from '@/lib/format';

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-4 border-2 border-[var(--line)] ${highlight ? 'bg-amarelo text-preto' : 'bg-[var(--surface)]'}`}>
      <p className="font-display uppercase text-xs tracking-widest">{label}</p>
      <p className="num font-display font-extrabold text-4xl md:text-5xl leading-none mt-1">{value}</p>
      {sub && <p className="num text-sm mt-1">{sub}</p>}
    </div>
  );
}

const LUGAR = { uf: 'UFs', municipio: 'municípios', pais: 'países' } as const;

export function KpiRow({ v }: { v: ViewModel }) {
  const { total, totalRef, pct, pctRef, lugaresComVoto } = v.kpis;
  const variacao = totalRef ? Math.round(((total - totalRef) / totalRef) * 100) : null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi highlight label={`Votos UP · ${v.labelAtual}`} value={fmtInt(total)}
        sub={totalRef !== null ? `${fmtDelta(total - totalRef, 'votos')} vs. ${v.labelRef}` : undefined} />
      <Kpi label="% dos válidos onde disputamos" value={fmtPct(pct)}
        sub={pctRef !== null ? `${fmtDelta(pct - pctRef, 'pct')} vs. ${v.labelRef}` : undefined} />
      {v.compare
        ? <Kpi label="Variação" value={variacao === null ? '—' : `${variacao >= 0 ? '+' : '−'}${Math.abs(variacao)}%`} sub={totalRef !== null ? `${fmtInt(totalRef)} votos em ${v.labelRef}` : undefined} />
        : <Kpi label={`${LUGAR[v.level]} com voto`} value={fmtInt(lugaresComVoto)} />}
      <Kpi label={v.candidatos.length ? 'Candidatura' : `${LUGAR[v.level]} com voto`}
        value={v.candidatos.length ? String(v.candidatos.length) : fmtInt(lugaresComVoto)}
        sub={v.candidatos.length ? v.candidatos.slice(0, 3).join(' · ') + (v.candidatos.length > 3 ? '…' : '') : undefined} />
    </div>
  );
}
```

- [ ] **Step 2: `Breadcrumb.tsx`**

```tsx
import type { Filters } from '@/lib/filters';
export function Breadcrumb({ f, set, munNome }: { f: Filters; set: (p: Partial<Filters>) => void; munNome?: string }) {
  const items: { label: string; go?: Partial<Filters> }[] =
    f.escopo === 'exterior' ? [{ label: 'Exterior' }] : [{ label: 'Brasil', go: { uf: undefined, mun: undefined } }];
  if (f.uf) items.push({ label: f.uf, go: { mun: undefined } });
  if (f.mun && munNome) items.push({ label: munNome });
  return (
    <nav aria-label="Navegação do mapa" className="font-display uppercase text-sm tracking-wider flex gap-2">
      {items.map((it, i) => (
        <span key={i} className="flex gap-2">
          {i > 0 && <span aria-hidden>›</span>}
          {it.go && i < items.length - 1
            ? <button className="underline underline-offset-4" onClick={() => set(it.go!)}>{it.label}</button>
            : <span className="font-bold">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3:** `npx tsc --noEmit`. **Step 4: Commit** — `feat(ui): KPIs e breadcrumb`

### Task 21: Mapa

**Files:** Create `src/components/MapPanel.tsx`, `src/components/MapLegend.tsx`

Comportamento:
- Estilo MapLibre sem tiles: `{ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': <var --bg> } }] }`.
- Brasil (nível UF): fonte `ufs` (GeoJSON de `br-ufs.topo.json`), `fill-color` por feature via `feature-state`/propriedade `color` calculada no cliente com `seqColor`/`divColor`; clique → `set({ uf })`.
- Nível município: fonte `municipios` filtrada pela UF (`['==', ['get', 'uf'], uf]`), `fitBounds` na UF; clique → `set({ mun })` e carrega locais.
- Locais (com `f.uf` definido): círculos (`circle-radius` ∝ √votos, cor por métrica), aparecem a partir do zoom 8 ou quando `f.mun` está definido; popup com nome do local, votos, % e lista de seções com voto.
- Exterior: fonte `world` (world.topo.json, `countries`), cor por `isoNum`; círculos por cidade (lat/lon de `exterior_cidades`).
- Hover: contorno preto 2px + tooltip (nome, votos, %, delta).

- [ ] **Step 1: `MapLegend.tsx`**

```tsx
import { PALETTE, seqColor, divColor } from '@/lib/colors';
import { fmtDelta, fmtValue } from '@/lib/format';
import type { Metrica } from '@/lib/filters';
export function MapLegend({ max, compare, metrica }: { max: number; compare: boolean; metrica: Metrica }) {
  const steps = Array.from({ length: 7 }, (_, i) => i / 6);
  const colors = steps.map((t) => (compare ? divColor((t * 2 - 1) * max, max) : seqColor(t * max || 0.0001, max)));
  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--line)] p-2 text-xs w-56">
      <div className="flex h-3">{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
      <div className="num flex justify-between mt-1">
        {compare ? <><span>{fmtDelta(-max, metrica)}</span><span>0</span><span>{fmtDelta(max, metrica)}</span></>
                 : <><span>0</span><span>{fmtValue(max, metrica)}</span></>}
      </div>
      {compare && <div className="flex justify-between mt-1 font-display uppercase"><span style={{ color: PALETTE.caiu }}>caiu</span><span style={{ color: PALETTE.cresceu }}>cresceu</span></div>}
    </div>
  );
}
```

- [ ] **Step 2: `MapPanel.tsx`**

```tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import { feature } from 'topojson-client';
import type { Filters } from '@/lib/filters';
import type { ViewModel, ViewRow } from '@/lib/view';
import { divColor, seqColor } from '@/lib/colors';
import { fmtDelta, fmtInt, fmtPct } from '@/lib/format';
import { fetchJson } from '@/lib/load';
import { MapLegend } from './MapLegend';
import type { PointRow } from '@/lib/usePoints';

type FC = GeoJSON.FeatureCollection;
const geo = { ufs: null as FC | null, mun: null as FC | null, world: null as FC | null };
async function loadGeo() {
  if (!geo.ufs) { const t: any = await fetchJson('/geo/br-ufs.topo.json'); geo.ufs = feature(t, t.objects.ufs) as any; }
  if (!geo.mun) { const t: any = await fetchJson('/geo/br-municipios.topo.json'); geo.mun = feature(t, t.objects.municipios) as any; }
  if (!geo.world) { const t: any = await fetchJson('/geo/world.topo.json'); geo.world = feature(t, t.objects.countries) as any; }
  return geo as { ufs: FC; mun: FC; world: FC };
}


function bbox(fc: FC): [[number, number], [number, number]] {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = (c: any) => (typeof c[0] === 'number' ? ((x0 = Math.min(x0, c[0])), (x1 = Math.max(x1, c[0])), (y0 = Math.min(y0, c[1])), (y1 = Math.max(y1, c[1]))) : c.forEach(walk));
  fc.features.forEach((f: any) => walk(f.geometry.coordinates));
  return [[x0, y0], [x1, y1]];
}

export function MapPanel({ v, f, set, points }: { v: ViewModel; f: Filters; set: (p: Partial<Filters>) => void; points: PointRow[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const compare = v.compare;
  const max = useMemo(() => Math.max(0, ...v.rows.map((r) => (compare ? Math.abs(r.delta ?? 0) : r.value))), [v, compare]);
  const color = (r?: ViewRow) => (!r ? '#F3EFEA' : compare ? divColor(r.delta ?? 0, max) : seqColor(r.value, max));

  // init
  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!, attributionControl: false, center: [-52, -15], zoom: 3, minZoom: 1, maxZoom: 15, dragRotate: false,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } }] },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = m;
    m.on('load', async () => {
      const g = await loadGeo();
      const empty: FC = { type: 'FeatureCollection', features: [] };
      for (const id of ['areas', 'points'] as const) m.addSource(id, { type: 'geojson', data: empty, promoteId: 'id' });
      m.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.95 } });
      m.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#000', 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 0.4] } });
      m.addLayer({ id: 'points', type: 'circle', source: 'points', paint: {
        'circle-color': ['get', 'color'], 'circle-stroke-color': '#000', 'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'up']], 0, 2, 10, 8, 40, 22], 'circle-opacity': 0.9 } });
      void g;
      setReady(true);
    });
    return () => m.remove();
  }, []);

  // dados → fontes
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    (async () => {
      const g = await loadGeo();
      const byId = new Map(v.rows.map((r) => [r.id, r]));
      let areas: FC;
      if (f.escopo === 'exterior') {
        const byNum = new Map(v.rows.map((r) => [String(Number(r.isoNum)), r]));
        areas = { type: 'FeatureCollection', features: g.world.features.map((ft: any) => {
          const r = byNum.get(String(Number(ft.id)));
          return { ...ft, properties: { id: ft.id, nome: r?.nome ?? ft.properties.name, color: color(r), row: r ? JSON.stringify(r) : null } };
        }) };
      } else if (f.uf) {
        areas = { type: 'FeatureCollection', features: g.mun.features.filter((ft: any) => ft.properties.uf === f.uf).map((ft: any) => {
          const r = byId.get(String(ft.id));
          return { ...ft, properties: { id: ft.id, uf: f.uf, color: color(r), row: r ? JSON.stringify(r) : null } };
        }) };
      } else {
        areas = { type: 'FeatureCollection', features: g.ufs.features.map((ft: any) => {
          const r = byId.get(String(ft.id));
          return { ...ft, properties: { id: ft.id, color: r ? color(r) : '#F3EFEA', row: r ? JSON.stringify(r) : null } };
        }) };
      }
      (m.getSource('areas') as GeoJSONSource).setData(areas);

      const pmax = Math.max(0, ...points.map((p) => (compare ? Math.abs(p.delta ?? 0) : p.value)));
      const pts: FC = { type: 'FeatureCollection', features: points.filter((p) => Number.isFinite(p.lat)).map((p) => ({
        type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { id: p.id, up: p.up, color: compare ? divColor(p.delta ?? 0, pmax) : seqColor(p.value, pmax), row: JSON.stringify(p) },
      })) };
      (m.getSource('points') as GeoJSONSource).setData(pts);

      if (f.escopo === 'exterior') m.fitBounds([[-170, -55], [180, 75]], { padding: 10, duration: 600 });
      else if (f.mun) { const ft = areas.features.filter((x: any) => x.id === f.mun); if (ft.length) m.fitBounds(bbox({ type: 'FeatureCollection', features: ft }), { padding: 30, duration: 600 }); }
      else if (f.uf && areas.features.length) m.fitBounds(bbox(areas), { padding: 20, duration: 600 });
      else m.fitBounds([[-74, -34], [-34.5, 5.5]], { padding: 10, duration: 600 });
    })();
  }, [v, f.escopo, f.uf, f.mun, points, ready, compare]);

  // interação
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px' });
    let hovered: string | number | undefined;
    const fmtRow = (r: any) => {
      const nome = r.nome;
      const linhas = compare
        ? `<b>${v.labelRef}:</b> ${r.a ? fmtInt(r.a.up) : "—"} (${fmtPct(r.a?.validos ? (r.a.up / r.a.validos) * 100 : 0)})<br><b>${v.labelAtual}:</b> ${r.b ? fmtInt(r.b.up) : "—"} (${fmtPct(r.b?.validos ? (r.b.up / r.b.validos) * 100 : 0)})<br><b>Δ</b> ${fmtDelta(r.delta ?? 0, f.metrica)}`
        : `<b>${fmtInt(r.up ?? (r.a ?? r.b)?.up ?? 0)}</b> votos · ${fmtPct(((r.up ?? (r.a ?? r.b)?.up ?? 0) / Math.max(1, r.validos ?? (r.a ?? r.b)?.validos ?? 1)) * 100)}`;
      const sec = r.secoes ? `<br><span style="font-size:11px">Seções: ${r.secoes}</span>` : '';
      const aprox = r.aprox ? '<br><i style="font-size:11px">localização aproximada</i>' : '';
      return `<div style="font-family:var(--font-display);text-transform:uppercase;font-weight:800">${nome}</div>${linhas}${sec}${aprox}`;
    };
    const move = (layer: string) => (e: any) => {
      const ft = e.features?.[0]; if (!ft) return;
      m.getCanvas().style.cursor = 'pointer';
      if (layer === 'areas-fill') {
        if (hovered !== undefined) m.setFeatureState({ source: 'areas', id: hovered }, { hover: false });
        hovered = ft.id; m.setFeatureState({ source: 'areas', id: hovered! }, { hover: true });
      }
      const row = ft.properties.row ? JSON.parse(ft.properties.row) : null;
      popup.setLngLat(e.lngLat).setHTML(row ? fmtRow(row) : `<b>${ft.properties.nome ?? ft.properties.id}</b><br>sem votos`).addTo(m);
    };
    const leave = () => { m.getCanvas().style.cursor = ''; popup.remove(); if (hovered !== undefined) m.setFeatureState({ source: 'areas', id: hovered }, { hover: false }); hovered = undefined; };
    const click = (e: any) => {
      const ft = e.features?.[0]; if (!ft || f.escopo === 'exterior') return;
      if (!f.uf) set({ uf: String(ft.id) }); else set({ mun: Number(ft.id) });
    };
    const mf = move('areas-fill'), mp = move('points');
    m.on('mousemove', 'areas-fill', mf); m.on('mouseleave', 'areas-fill', leave); m.on('click', 'areas-fill', click);
    m.on('mousemove', 'points', mp); m.on('mouseleave', 'points', leave);
    return () => { m.off('mousemove', 'areas-fill', mf); m.off('mouseleave', 'areas-fill', leave); m.off('click', 'areas-fill', click); m.off('mousemove', 'points', mp); m.off('mouseleave', 'points', leave); popup.remove(); };
  }, [ready, f, set, compare, v.labelRef, v.labelAtual]);

  return (
    <div className="relative border-2 border-[var(--line)] bg-[var(--surface)]">
      <div ref={el} className="h-[60vh] min-h-[420px] w-full" aria-label="Mapa de votos da UP" role="region" />
      <div className="absolute left-2 bottom-2"><MapLegend max={max} compare={compare} metrica={f.metrica} /></div>
      {v.aviso && <div className="absolute inset-0 grid place-items-center bg-[var(--bg)]/80 p-6 text-center font-display uppercase text-xl">{v.aviso}</div>}
    </div>
  );
}
```

- [ ] **Step 3:** `npx tsc --noEmit`. **Step 4: Commit** — `feat(ui): mapa com drill-down UF → município → locais e exterior`

### Task 22: Pontos de locais (hook)

**Files:** Create `src/lib/usePoints.ts`

Pontos só existem com UF selecionada, fora do escopo exterior, e — se houver comparação — apenas na **correspondente** (mesmo cargo). Carrega `locaisInfo`/`locaisVotos` da eleição atual (e da referência), casa locais com `matchLocais` (referência → atual), filtra por município se `f.mun`.

- [ ] **Step 1: Implementação**

```ts
'use client';
import { useMemo } from 'react';
import type { LocaisInfoFile, LocaisVotosFile, Tally } from './data-types';
import { isCompare, isCorrespondente, type Filters } from './filters';
import { useJson, paths } from './load';
import { matchLocais } from './compare';
import { delta, value } from './metrics';

export interface PointRow { id: string; nome: string; lat: number; lon: number; aprox: boolean; a?: Tally; b?: Tally; up: number; validos: number; value: number; delta: number | null; secoes: string }

const votos = (vf: LocaisVotosFile | null) => new Map((vf?.rows ?? []).map(([k, up, validos]) => [k, { up, validos }]));
const secStr = (vf: LocaisVotosFile | null, k: string) => vf?.secoes[k]?.map(([s, up]) => `${s} (${up})`).join(', ') ?? '';

export function usePoints(f: Filters, munTse: number | undefined): PointRow[] {
  const compare = isCompare(f);
  const on = f.escopo !== 'exterior' && !!f.uf && (!compare || isCorrespondente(f));
  const iA = useJson<LocaisInfoFile>(on ? paths.locaisInfo(f.ano, f.uf!) : null);
  const vA = useJson<LocaisVotosFile>(on ? paths.locaisVotos(f.ano, f.cargo, f.uf!) : null);
  const iR = useJson<LocaisInfoFile>(on && compare ? paths.locaisInfo(f.ref!, f.uf!) : null);
  const vR = useJson<LocaisVotosFile>(on && compare ? paths.locaisVotos(f.ref!, f.cargo, f.uf!) : null);

  return useMemo(() => {
    if (!on || !iA.data) return [];
    const inMun = (tse: number) => !munTse || tse === munTse;
    const va = votos(vA.data);
    let inv = new Map<string, string>(); // chave atual → chave referência
    let vr = new Map<string, Tally>();
    if (compare) {
      if (!iR.data) return [];
      inv = new Map([...matchLocais(iR.data, iA.data)].map(([r, a]) => [a, r]));
      vr = votos(vR.data);
    }
    const out: PointRow[] = [];
    for (const [k, [nome, lat, lon, aprox, tse]] of Object.entries(iA.data)) {
      if (!inMun(tse)) continue;
      const b = va.get(k);
      const kr = inv.get(k);
      const a = kr ? vr.get(kr) : undefined;
      if (!b && !a) continue; // local fora das unidades com candidatura
      out.push({
        id: k, nome, lat, lon, aprox: !!aprox, a, b, up: b?.up ?? 0, validos: b?.validos ?? 0,
        value: value(b, f.metrica), delta: compare ? delta(a, b, f.metrica) : null, secoes: secStr(vA.data, k),
      });
    }
    return out;
  }, [on, compare, f.metrica, munTse, iA.data, vA.data, iR.data, vR.data]);
}
```

- [ ] **Step 2:** `npx tsc --noEmit`. **Step 3: Commit** — `feat(ui): pontos dos locais de votação com comparação`

### Task 23: Gráficos

**Files:** Create `src/components/charts/EChart.tsx`, `DivergingBars.tsx`, `Scatter.tsx`, `GroupedBars.tsx`

- [ ] **Step 1: `EChart.tsx`** (wrapper com tree-shaking)

```tsx
'use client';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, ScatterChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
echarts.use([BarChart, ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

export const baseTextStyle = { fontFamily: 'var(--font-barlow), system-ui, sans-serif' };

export function EChart({ option, height = 360, label }: { option: echarts.EChartsCoreOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    chart.current = echarts.init(el.current!, undefined, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); chart.current?.dispose(); };
  }, []);
  useEffect(() => {
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#000';
    chart.current?.setOption({ textStyle: { ...baseTextStyle, color: fg }, ...option }, true);
  }, [option]);
  return <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full" />;
}
```

- [ ] **Step 2: `DivergingBars.tsx`** — com comparação: 15 maiores ganhos e 15 maiores quedas; sem: top 20

```tsx
'use client';
import { useMemo } from 'react';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE, seqColor } from '@/lib/colors';
import { fmtDelta, fmtValue } from '@/lib/format';
import { EChart } from './EChart';

export function DivergingBars({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const { compare } = v;
  const option = useMemo(() => {
    const fmt = (x: number) => (compare ? fmtDelta(x, metrica) : fmtValue(x, metrica));
    let sel;
    if (compare) {
      const rows = v.rows.filter((r) => r.delta !== null).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
      const top = rows.slice(0, 15);
      sel = [...top, ...rows.slice(-15).filter((r) => !top.includes(r))];
    } else sel = [...v.rows].sort((a, b) => b.value - a.value).slice(0, 20);
    const data = sel.reverse();
    const max = Math.max(0, ...data.map((r) => r.value));
    return {
      grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
      xAxis: { type: 'value', axisLabel: { formatter: fmt }, splitLine: { lineStyle: { color: '#8884' } } },
      yAxis: { type: 'category', data: data.map((r) => r.nome), axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 14,
        data: data.map((r) => ({ value: compare ? r.delta : r.value, itemStyle: { color: compare ? ((r.delta ?? 0) >= 0 ? PALETTE.cresceu : PALETTE.caiu) : seqColor(r.value, max) } })),
        label: { show: true, position: 'right', fontSize: 11, formatter: (p: { value: number }) => fmt(p.value) },
      }],
    };
  }, [v, compare, metrica]);
  return <EChart option={option} height={Math.max(320, Math.min(30, v.rows.length) * 22 + 40)} label={compare ? 'Maiores ganhos e quedas' : 'Maiores votações'} />;
}
```

- [ ] **Step 3: `Scatter.tsx`** — referência (x) × atual (y), diagonal de referência; só com comparação

```tsx
'use client';
import { useMemo } from 'react';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE } from '@/lib/colors';
import { value } from '@/lib/metrics';
import { fmtValue } from '@/lib/format';
import { EChart } from './EChart';

export function Scatter({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const option = useMemo(() => {
    const pts = v.rows.map((r) => ({ name: r.nome, raw: [value(r.a, metrica), value(r.b, metrica)] }));
    const max = Math.max(1, ...pts.flatMap((p) => p.raw));
    const log = metrica === 'votos' && max > 1000;
    const fix = (x: number) => (log ? Math.max(1, x) : x);
    return {
      grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
      tooltip: { formatter: (p: { name: string; data: { raw: number[] } }) => p.data.raw ? `<b>${p.name}</b><br>${v.labelRef}: ${fmtValue(p.data.raw[0], metrica)}<br>${v.labelAtual}: ${fmtValue(p.data.raw[1], metrica)}` : '' },
      xAxis: { type: log ? 'log' : 'value', name: v.labelRef, nameLocation: 'middle', nameGap: 28, min: log ? 1 : 0, axisLabel: { formatter: (x: number) => fmtValue(x, metrica) } },
      yAxis: { type: log ? 'log' : 'value', name: v.labelAtual, min: log ? 1 : 0, axisLabel: { formatter: (x: number) => fmtValue(x, metrica) } },
      series: [
        { type: 'scatter', symbolSize: 8,
          data: pts.map((p) => ({ name: p.name, raw: p.raw, value: p.raw.map(fix),
            itemStyle: { color: p.raw[1] >= p.raw[0] ? PALETTE.cresceu : PALETTE.caiu, opacity: 0.85, borderColor: '#000', borderWidth: 0.5 } })) },
        { type: 'line', data: [[fix(0), fix(0)], [max, max]], symbol: 'none', lineStyle: { type: 'dashed', width: 1 }, tooltip: { show: false } },
      ],
    };
  }, [v, metrica]);
  return <EChart option={option} height={380} label="Dispersão: acima da diagonal, a UP cresceu" />;
}
```

- [ ] **Step 4: `GroupedBars.tsx`** — barras referência × atual por UF/município/país (máx. 30)

```tsx
'use client';
import { useMemo } from 'react';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE } from '@/lib/colors';
import { value } from '@/lib/metrics';
import { fmtValue } from '@/lib/format';
import { EChart } from './EChart';

export function GroupedBars({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const option = useMemo(() => {
    const rows = [...v.rows].sort((a, b) => Math.max(value(b.a, metrica), value(b.b, metrica)) - Math.max(value(a.a, metrica), value(a.b, metrica))).slice(0, 30);
    return {
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (x: number) => fmtValue(x, metrica) },
      xAxis: { type: 'category', data: rows.map((r) => r.nome), axisLabel: { rotate: rows.length > 12 ? 45 : 0, interval: 0 } },
      yAxis: { type: 'value', axisLabel: { formatter: (x: number) => fmtValue(x, metrica) }, splitLine: { lineStyle: { color: '#8884' } } },
      series: [
        { name: v.labelRef, type: 'bar', data: rows.map((r) => value(r.a, metrica)), itemStyle: { color: PALETTE.ref } },
        { name: v.labelAtual, type: 'bar', data: rows.map((r) => value(r.b, metrica)), itemStyle: { color: PALETTE.atual } },
      ],
    };
  }, [v, metrica]);
  return <EChart option={option} height={380} label={`Comparativo ${v.labelRef} e ${v.labelAtual}`} />;
}
```

- [ ] **Step 5:** `npx tsc --noEmit`. **Step 6: Commit** — `feat(ui): gráficos de ranking, dispersão e barras agrupadas`

### Task 24: Tabela, notas e Dashboard

**Files:** Create `src/components/DataTable.tsx`, `src/components/Notes.tsx`, `src/components/Dashboard.tsx`, `src/app/page.tsx`

- [ ] **Step 1: `DataTable.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import type { ViewModel, ViewRow } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { fmtDelta, fmtInt, fmtPct } from '@/lib/format';
import { value } from '@/lib/metrics';

type Col = 'nome' | 'a' | 'b' | 'delta';
export function downloadCsv(name: string, head: string[], lines: (string | number)[][]) {
  const body = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv' }));
  a.download = name; a.click();
}

export function DataTable({ v, metrica }: { v: ViewModel; metrica: Metrica }) {
  const { compare } = v;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: compare ? 'delta' : 'b', dir: -1 });
  const rows = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const key = (r: ViewRow) => sort.col === 'nome' ? r.nome : sort.col === 'a' ? value(r.a, metrica) : sort.col === 'b' ? value(r.b, metrica) : (r.delta ?? 0);
    return v.rows.filter((r) => norm(r.nome).includes(norm(q)))
      .sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : 0) * sort.dir; });
  }, [v, q, sort, metrica]);

  const csv = () => compare
    ? downloadCsv(`up-${v.level}.csv`, ['lugar', `votos ${v.labelRef}`, `validos ${v.labelRef}`, `votos ${v.labelAtual}`, `validos ${v.labelAtual}`],
        rows.map((r) => [r.nome, r.a?.up ?? '', r.a?.validos ?? '', r.b?.up ?? '', r.b?.validos ?? '']))
    : downloadCsv(`up-${v.level}.csv`, ['lugar', 'votos', 'validos', 'pct'],
        rows.map((r) => [r.nome, r.b?.up ?? 0, r.b?.validos ?? 0, value(r.b, 'pct').toFixed(4)]));

  const th = (col: Col, label: string) => (
    <th scope="col" className="text-left p-2 font-display uppercase tracking-wider">
      <button onClick={() => setSort((s) => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : -1 }))}>
        {label}{sort.col === col ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
  const cell = (t?: { up: number; validos: number }) => t
    ? <>{fmtInt(t.up)} {v.correspondente || !compare ? <span className="text-[var(--muted)]">({fmtPct(value(t, 'pct'))})</span> : null}</>
    : <span className="text-[var(--muted)]" title="sem candidatura">—</span>;

  return (
    <div className="border-2 border-[var(--line)] bg-[var(--surface)]">
      <div className="flex gap-2 p-2 border-b-2 border-[var(--line)]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar na tabela"
          className="flex-1 min-w-0 px-2 py-1 border-2 border-[var(--line)] bg-transparent" />
        <button onClick={csv} className="px-3 py-1 border-2 border-[var(--line)] font-display uppercase font-bold">Baixar CSV</button>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm num">
          <thead className="sticky top-0 bg-[var(--surface)] border-b-2 border-[var(--line)]">
            <tr>{th('nome', 'Lugar')}{compare ? <>{th('a', v.labelRef!)}{th('b', v.labelAtual)}{th('delta', 'Variação')}</> : th('b', 'Votos')}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)]/20">
                <td className="p-2">{r.nome}</td>
                {compare
                  ? <><td className="p-2">{cell(r.a)}</td><td className="p-2">{cell(r.b)}</td>
                      <td className={`p-2 font-semibold ${(r.delta ?? 0) >= 0 ? 'text-queimado' : 'text-roxo'}`}>{r.delta === null ? '—' : fmtDelta(r.delta, metrica)}</td></>
                  : <td className="p-2">{cell(r.b)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `Notes.tsx`**

```tsx
export function Notes() {
  return (
    <section className="bg-[var(--band)] mt-16">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-3">
        <h2 className="font-display font-extrabold uppercase text-3xl">Como ler estes dados</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Fonte: votação por seção eleitoral do TSE (1º turno), conferida com os totais oficiais por partido.</li>
          <li><b>Votos</b>: em Presidente, Governador, Senador e Prefeito contam os votos nos candidatos da UP. Para deputados e vereadores, somam-se os votos nominais e os de legenda (80).</li>
          <li><b>% válidos</b>: votos da UP ÷ votos válidos (sem brancos e nulos) no mesmo lugar e cargo, só onde a UP disputou.</li>
          <li><b>Comparações do mesmo cargo</b> (2022 × 2026, 2020 × 2024) mostram votos, %, municípios e locais de votação. O TSE renumera seções entre eleições, então a comparação fina é feita por <b>local de votação</b> (casado pelo número do local ou pelo nome da escola). As seções aparecem no detalhe de cada local.</li>
          <li><b>Comparações entre cargos ou tipos de eleição diferentes</b> (ex.: Vereador 2024 × Dep. Federal 2026) mostram só o número de votos, por estado e município.</li>
          <li>Cada eleitor vota em vários cargos. Por isso a Linha do tempo nunca soma cargos: cada barra é um cargo.</li>
          <li>No exterior só há votação para Presidente. Locais sem coordenadas aparecem no centro do município (“localização aproximada”).</li>
          <li>Onde a UP não lançou candidatura, o site mostra “—” (sem candidatura), que é diferente de zero votos.</li>
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `Dashboard.tsx`**

```tsx
'use client';
import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isCorrespondente, parseFilters, toQuery, type Filters } from '@/lib/filters';
import { useJson, useSerie, paths } from '@/lib/load';
import { buildView } from '@/lib/view';
import { usePoints } from '@/lib/usePoints';
import type { MetaFile } from '@/lib/data-types';
import { Hero } from './Hero';
import { FilterBar } from './FilterBar';
import { KpiRow } from './KpiRow';
import { Breadcrumb } from './Breadcrumb';
import { MapPanel } from './MapPanel';
import { DivergingBars } from './charts/DivergingBars';
import { Scatter } from './charts/Scatter';
import { GroupedBars } from './charts/GroupedBars';
import { DataTable } from './DataTable';
import { Timeline } from './Timeline';
import { Notes } from './Notes';
import { Footer } from './Footer';
import { JoinCta } from './JoinCta';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="space-y-3"><h2 className="font-display font-extrabold uppercase text-2xl md:text-3xl">{title}</h2>{children}</section>);
}

export function Dashboard() {
  const sp = useSearchParams();
  const router = useRouter();
  const f = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);
  const set = useCallback((p: Partial<Filters>) => {
    const q = toQuery({ ...f, ...p });
    router.replace(q ? `?${q}` : '?', { scroll: false });
  }, [f, router]);

  const meta = useJson<MetaFile>(paths.meta).data;
  const atual = useSerie(meta, f.ano, f.cargo);
  const ref = useSerie(meta, f.ref, f.refCargo);
  const loading = !meta || atual.loading || ref.loading;
  const v = useMemo(() => buildView(f, atual.data ?? undefined, ref.data ?? undefined), [f, atual.data, ref.data]);
  const munRow = f.mun ? (atual.data ?? ref.data)?.municipios.find((m) => m.ibge === f.mun) : undefined;
  const points = usePoints(f, munRow?.tse);

  return (
    <>
      <Hero geradoEm={meta?.geradoEm} />
      <FilterBar f={f} set={set} meta={meta} />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-10" aria-busy={loading}>
        {f.tela === 'linha' ? (
          meta && <Timeline meta={meta} escopo={f.escopo} onPick={(ano, cargo) => set({ tela: 'mapa', ano, cargo, ref: undefined, refCargo: undefined })} />
        ) : loading ? (
          <div className="h-[60vh] grid place-items-center font-display uppercase text-2xl animate-pulse">Carregando votos…</div>
        ) : (
          <>
            <KpiRow v={v} />
            <Section title={v.compare ? 'Onde crescemos e onde caímos' : 'Mapa dos votos'}>
              <Breadcrumb f={f} set={set} munNome={munRow?.nome} />
              <MapPanel v={v} f={f} set={set} points={points} />
              {f.escopo !== 'exterior' && !f.uf && <p className="text-sm text-[var(--muted)]">Clique em um estado para ver os municípios{!v.compare || isCorrespondente(f) ? ' e os locais de votação' : ''}.</p>}
            </Section>
            {!v.aviso && (
              <div className="grid gap-10 lg:grid-cols-2">
                <Section title={v.compare ? 'Maiores ganhos e quedas' : 'Onde mais votamos'}><DivergingBars v={v} metrica={f.metrica} /></Section>
                {v.compare
                  ? <Section title="Lugar a lugar"><Scatter v={v} metrica={f.metrica} /><p className="text-sm text-[var(--muted)]">Acima da linha tracejada: a UP cresceu.</p></Section>
                  : <Section title="Compare com outra eleição">
                      <p>Use <b>Comparar com</b> na barra de filtros para ver onde a UP cresceu: a mesma disputa em outro ano (ex.: 2022 × 2026) ou, só em número de votos, eleições diferentes (ex.: Vereador 2024 × Dep. Federal 2026).</p>
                      <button className="mt-3 px-3 py-2 border-2 border-[var(--line)] font-display uppercase font-bold" onClick={() => set({ ref: f.ano === 2026 ? 2022 : f.ano === 2024 ? 2020 : f.ano === 2022 ? 2026 : 2024 })}>Comparar com a eleição equivalente</button>
                    </Section>}
                {v.compare && <div className="lg:col-span-2"><Section title={f.escopo === 'exterior' ? 'Por país' : f.uf ? `Municípios de ${f.uf}` : 'Por estado'}><GroupedBars v={v} metrica={f.metrica} /></Section></div>}
              </div>
            )}
            {!v.aviso && <Section title="Todos os dados"><DataTable v={v} metrica={f.metrica} /></Section>}
          </>
        )}
        <div className="flex justify-center py-6"><JoinCta /></div>
      </main>
      <Notes />
      <Footer />
      <div className="fixed bottom-3 right-3 z-40 lg:hidden"><JoinCta size="sm" /></div>
    </>
  );
}
```

- [ ] **Step 4: `page.tsx`**

```tsx
import { Suspense } from 'react';
import { Dashboard } from '@/components/Dashboard';
export default function Page() {
  return <Suspense><Dashboard /></Suspense>;
}
```

- [ ] **Step 5: Commit** — `feat(ui): dashboard da aba Mapa` (o build completo só passa após a Task 25, que cria `Timeline`).

### Task 25: Linha do tempo (comparação global)

**Files:** Create `src/lib/timeline.ts`, `src/components/Timeline.tsx`; Test `tests/lib/timeline.test.ts`

Lê só `meta.totais`. Nunca soma cargos. Destaca o cargo proporcional de cada eleição (Vereador / Dep. Federal) como "força do partido".

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { timelineRows } from '@/lib/timeline';
import type { MetaFile, TotalCargo } from '@/lib/data-types';

const t = (up: number, ext = 0): TotalCargo => ({ up, validos: up * 50, upBrasil: up - ext, upExterior: ext, unidadesComCandidatura: 3, municipiosComVoto: 10, candidatos: [] });
const meta: MetaFile = { geradoEm: '', fonte: '', disponivel: {}, totais: {
  2020: { vereador: t(100), prefeito: t(40) }, 2022: { presidente: t(53519, 319), depfed: t(500) },
  2024: { vereador: t(300) }, 2026: { presidente: t(122911, 1053), depfed: t(900) },
} };

describe('timelineRows', () => {
  it('uma linha por eleição×cargo, com proporcional marcado', () => {
    const rows = timelineRows(meta, 'tudo');
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.ano === 2024 && r.cargo === 'vereador')).toMatchObject({ votos: 300, proporcional: true });
    expect(rows.find((r) => r.ano === 2022 && r.cargo === 'presidente')).toMatchObject({ votos: 53519, proporcional: false });
  });
  it('escopo exterior: só presidente', () => {
    expect(timelineRows(meta, 'exterior').map((r) => [r.ano, r.votos])).toEqual([[2022, 319], [2026, 1053]]);
  });
  it('escopo brasil desconta exterior', () => {
    expect(timelineRows(meta, 'brasil').find((r) => r.ano === 2026 && r.cargo === 'presidente')!.votos).toBe(121858);
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `src/lib/timeline.ts`**

```ts
import { ANOS, CARGOS, PROPORCIONAL, TIPO, type Ano, type Cargo, type MetaFile, type TotalCargo } from './data-types';
import type { Escopo } from './filters';

export interface TimelineRow { ano: Ano; cargo: Cargo; votos: number; proporcional: boolean; total: TotalCargo }

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
```

- [ ] **Step 4:** PASS.
- [ ] **Step 5: `src/components/Timeline.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { ANOS, CARGOS, CARGO_LABEL, TIPO, type Ano, type Cargo, type MetaFile } from '@/lib/data-types';
import type { Escopo } from '@/lib/filters';
import { timelineRows } from '@/lib/timeline';
import { CARGO_COLOR } from '@/lib/colors';
import { fmtInt } from '@/lib/format';
import { EChart } from './charts/EChart';
import { downloadCsv } from './DataTable';
import { Section } from './Dashboard';

export function Timeline({ meta, escopo, onPick }: { meta: MetaFile; escopo: Escopo; onPick: (ano: Ano, cargo: Cargo) => void }) {
  const rows = useMemo(() => timelineRows(meta, escopo), [meta, escopo]);
  const cargos = CARGOS.filter((c) => rows.some((r) => r.cargo === c));
  const anos = ANOS.filter((a) => rows.some((r) => r.ano === a));

  const option = useMemo(() => ({
    grid: { left: 8, right: 8, top: 48, bottom: 8, containLabel: true },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x: number | null) => (x === null ? 'sem candidatura' : fmtInt(x)) },
    xAxis: { type: 'category', data: anos.map((a) => `${a}\n${TIPO[a] === 'geral' ? 'geral' : 'municipal'}`) },
    yAxis: { type: 'value', axisLabel: { formatter: (x: number) => fmtInt(x) }, splitLine: { lineStyle: { color: '#8884' } } },
    series: cargos.map((c) => ({
      name: CARGO_LABEL[c], type: 'bar', barGap: '10%',
      data: anos.map((a) => {
        const r = rows.find((x) => x.ano === a && x.cargo === c);
        return r ? { value: r.votos, itemStyle: { color: CARGO_COLOR[c], borderColor: r.proporcional ? '#000' : 'transparent', borderWidth: r.proporcional ? 2 : 0 } } : null;
      }),
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: { value: number }) => (p.value ? fmtInt(p.value) : '') },
    })),
  }), [rows, cargos, anos]);

  return (
    <div className="space-y-10">
      <Section title="A UP de 2020 a 2026">
        <p className="max-w-3xl">Votos da Unidade Popular em cada eleição, cargo a cargo. Cada eleitor vota em vários cargos, então não somamos: compare as barras do mesmo tipo de cargo. Contorno preto = cargo proporcional (Vereador / Dep. Federal), o melhor termômetro do tamanho do partido.</p>
        <EChart option={option} height={440} label="Votos da UP por eleição e cargo" />
      </Section>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {anos.map((a) => {
          const prop = rows.find((r) => r.ano === a && r.proporcional);
          const maj = rows.filter((r) => r.ano === a && r.total.candidatos.length);
          return (
            <div key={a} className="border-2 border-[var(--line)] p-4 bg-[var(--surface)]">
              <p className="font-display uppercase text-xs tracking-widest">{TIPO[a] === 'geral' ? 'Eleição geral' : 'Eleição municipal'}</p>
              <p className="font-display font-extrabold text-4xl">{a}</p>
              {prop && <p className="num mt-2"><b className="font-display text-2xl">{fmtInt(prop.votos)}</b> votos para {CARGO_LABEL[prop.cargo]}</p>}
              {prop && <p className="num text-sm text-[var(--muted)]">{fmtInt(prop.total.unidadesComCandidatura)} {TIPO[a] === 'geral' ? 'UFs' : 'municípios'} com candidatura · {fmtInt(prop.total.municipiosComVoto)} municípios com voto</p>}
              {maj.map((r) => <p key={r.cargo} className="text-sm mt-1">{CARGO_LABEL[r.cargo]}: {r.total.candidatos.slice(0, 2).join(', ')}{r.total.candidatos.length > 2 ? ` +${r.total.candidatos.length - 2}` : ''}</p>)}
            </div>
          );
        })}
      </div>

      <Section title="Tabela">
        <div className="border-2 border-[var(--line)] bg-[var(--surface)] overflow-auto">
          <table className="w-full text-sm num">
            <thead className="border-b-2 border-[var(--line)]"><tr>
              {['Eleição', 'Cargo', 'Votos', 'Unidades com candidatura', 'Municípios com voto', ''].map((h) => <th key={h} className="text-left p-2 font-display uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.ano}-${r.cargo}`} className="border-b border-[var(--line)]/20">
                  <td className="p-2">{r.ano}</td>
                  <td className="p-2">{CARGO_LABEL[r.cargo]}{r.proporcional ? ' ★' : ''}</td>
                  <td className="p-2 font-semibold">{fmtInt(r.votos)}</td>
                  <td className="p-2">{fmtInt(r.total.unidadesComCandidatura)}</td>
                  <td className="p-2">{fmtInt(r.total.municipiosComVoto)}</td>
                  <td className="p-2"><button className="underline underline-offset-4" onClick={() => onPick(r.ano, r.cargo)}>ver no mapa →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="px-3 py-1 border-2 border-[var(--line)] font-display uppercase font-bold"
          onClick={() => downloadCsv('up-linha-do-tempo.csv', ['ano', 'cargo', 'votos', 'unidades_com_candidatura', 'municipios_com_voto'],
            rows.map((r) => [r.ano, CARGO_LABEL[r.cargo], r.votos, r.total.unidadesComCandidatura, r.total.municipiosComVoto]))}>Baixar CSV</button>
      </Section>
    </div>
  );
}
```

- [ ] **Step 6: Build** — `npm run build` → sucesso, pasta `out/` gerada.
- [ ] **Step 7: Commit** — `feat(ui): linha do tempo com comparação global das eleições`

---

## Fase 4 — Verificação e deploy (eleições gerais)

### Task 26: Testes e tipos

- [ ] `npm test` → todos PASS.
- [ ] `npm run typecheck` → sem erros.
- [ ] `npm run validate` → `validação ok`.

### Task 27: Verificação no navegador (superpowers:verification-before-completion)

- [ ] `npm run dev` e abrir `http://localhost:3000` (desktop 1440px e mobile 390px).
- [ ] Fluxos:
  1. Padrão (2026, Presidente): KPI total = 122.911; mapa colorido por UF; SP mais escuro.
  2. Clique em SP → municípios; clique em São Paulo → pontos de locais com popup e seções.
  3. Comparar com 2022 (Presidente × Presidente): cores divergentes; ranking com ganhos (queimado) e quedas (roxo); dispersão; % válidos habilitado; pontos de locais em SP.
  4. Exterior + Presidente: mapa-múndi; Portugal e Japão destacados; KPI 1.053 (2026).
  5. Dep. Federal 2026 × Senador 2022 (cargo de referência trocado): aviso de comparação só por votos; % desativado; sem pontos de locais.
  6. Dep. Federal + Exterior → aviso "No exterior só se vota para Presidente".
  7. Cargo/UF sem candidatura (ex.: Governador 2022 em AC) → aviso "sem candidatura"; tabela mostra "—".
  8. Aba Linha do tempo: barras de 2022 e 2026 por cargo; Dep. Federal com contorno; "ver no mapa" abre o cargo certo.
  9. Copiar URL com filtros, abrir em nova aba → mesmo estado.
  10. Botão "Votei na UP e quero me organizar!" abre unidadepopular.org.br/filie-se em nova aba (hero, rodapé, flutuante no mobile).
  11. Tema escuro do sistema: logo branca, contraste OK.
- [ ] Ajustes visuais encontrados → commit `fix(ui): ajustes de verificação`.

### Task 28: Deploy

- [ ] Confirmar que `public/data` e `public/geo` estão commitados e que `.cache/` não está.
- [ ] `git push -u origin main` → Vercel (já conectado ao repositório) faz o build.
- [ ] Acompanhar o deploy (Vercel MCP `list_deployments` / `get_deployment`) até `READY`; abrir a URL e repetir os fluxos 1, 3, 4, 8 e 10.

---

## Fase 5 — Eleições municipais 2020 e 2024

O código já é genérico (tipos, filtros, ETL, linha do tempo). Esta fase confirma os dados municipais e os publica.

### Task 29: Conferir os dados municipais do TSE

- [ ] **Step 1: Arquivos existem**

```bash
B=https://cdn.tse.jus.br/estatistica/sead/odsele
for y in 2020 2024; do
  for f in votacao_secao/votacao_secao_${y}_SP.zip votacao_secao/votacao_secao_${y}_AC.zip eleitorado_locais_votacao/eleitorado_local_votacao_${y}.zip votacao_partido_munzona/votacao_partido_munzona_${y}.zip; do
    echo "$y $(curl -sI $B/$f | head -1 | tr -d '\r') $f"; done; done
```
Esperado: `200` em todos. Se `eleitorado_local_votacao_{ano}.zip` não existir, procurar no CKAN (`package_show?id=eleitorado-{ano}`) e ajustar `urls.locais` em `download.ts` para aceitar a URL encontrada.

- [ ] **Step 2: Cargos e votos da UP** — com o script de perfil (o mesmo usado na Fase 1, em `scratchpad/peek.mjs`), rodar sobre `votacao_secao_2024_AC.zip`: esperado `CD_CARGO` 11 (Prefeito) e 13 (Vereador), turnos 1 e 2, e linhas com `NR_VOTAVEL` `80`/`80xxx` em algum município. Se aparecer outro código de cargo, acrescentar em `CODE_TO_CARGO` com teste.
- [ ] **Step 3: Exterior** — confirmar que não há `SG_UF = ZZ` nos arquivos municipais (eleitores no exterior não votam em eleição municipal).

### Task 30: Rodar o ETL municipal e validar

- [ ] `npm run etl -- --ano 2024` e `npm run etl -- --ano 2020` (municípios grandes: SP/MG/RJ podem levar alguns minutos cada).
- [ ] `npm run validate -- --ano 2024` e `npm run validate -- --ano 2020` → `validação ok`.
- [ ] Conferir `public/data/meta.json`: `totais["2024"].vereador.up` > 0 e `unidadesComCandidatura` coerente com o nº de municípios onde a UP lançou chapa.
- [ ] Tamanho: `du -sh public/data` (< 100 MB) e `find public/data -size +5M` vazio.
- [ ] Commit — `data: eleições municipais 2020 e 2024`

### Task 31: Verificar e publicar

- [ ] `npm test && npm run build`.
- [ ] Navegador:
  1. 2024 · Vereador: mapa por UF (só municípios com chapa entram), clique em UF → municípios, clique em município → locais.
  2. 2024 × 2020 (Vereador × Vereador): comparação correspondente completa, com %.
  3. 2026 · Dep. Federal × 2024 · Vereador: só votos, por UF e município; aviso exibido.
  4. 2024 · Prefeito × 2026 · Presidente (trocando o cargo de referência): só votos.
  5. Linha do tempo com as 4 eleições; Vereador e Dep. Federal com contorno.
- [ ] `git push` → acompanhar o deploy no Vercel até `READY` e repetir os fluxos 1, 3 e 5 na URL publicada.
