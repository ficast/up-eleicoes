# UP nas Eleições 2022 × 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hotsite estático (Vercel) com mapa e gráficos dos votos da Unidade Popular (nº 80) em 2022 e 2026, por UF, município, local/seção e exterior, com modo de comparação.

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
  compare.ts        junção 2022×2026, casamento de locais
  view.ts           filtros + dados → ViewModel (linhas, KPIs, nível)
  colors.ts         paleta e escalas
  format.ts         formatação pt-BR
  load.ts           fetch com cache + hooks
src/components/
  Logo.tsx, Hero.tsx, JoinCta.tsx, FilterBar.tsx, Segmented.tsx, KpiRow.tsx,
  MapPanel.tsx, MapLegend.tsx, Breadcrumb.tsx,
  charts/EChart.tsx, charts/DivergingBars.tsx, charts/Scatter.tsx, charts/GroupedBars.tsx,
  DataTable.tsx, Notes.tsx, Footer.tsx, Dashboard.tsx
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
export const CARGOS = ['presidente', 'governador', 'senador', 'depfed', 'depest'] as const;
export type Cargo = (typeof CARGOS)[number];
export const ANOS = [2022, 2026] as const;
export type Ano = (typeof ANOS)[number];

export const CARGO_LABEL: Record<Cargo, string> = {
  presidente: 'Presidente', governador: 'Governador', senador: 'Senador',
  depfed: 'Dep. Federal', depest: 'Dep. Estadual/Distrital',
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
  ufsComCandidatura: string[];   // UFs onde a UP disputou (Presidente: todas + ZZ)
  ufs: UfRow[];                  // só UFs com candidatura
  municipios: MunicipioRow[];    // só municípios de UFs com candidatura
  exterior: { cidades: CidadeExteriorRow[]; paises: PaisRow[] } | null; // só Presidente
}

/** public/data/{ano}/locais/{UF}.json — nomes e coordenadas */
export interface LocaisInfoFile { [key: string]: [nome: string, lat: number, lon: number, aprox: 0 | 1, tse: number] }

/** public/data/{ano}/{cargo}/locais/{UF}.json — votos por local; key = `${tse}-${zona}-${local}` */
export interface LocaisVotosFile {
  rows: [key: string, up: number, validos: number][];
  secoes: Record<string, [secao: number, up: number, validos: number][]>; // só seções com up > 0
}

/** public/data/meta.json */
export interface MetaFile { geradoEm: string; fonte: string; disponivel: Record<string, Cargo[]> }

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
    expect(cargoFromCode(11)).toBeNull();
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

const CODE_TO_CARGO: Record<number, Cargo> = { 1: 'presidente', 3: 'governador', 5: 'senador', 6: 'depfed', 7: 'depest', 8: 'depest' };
export const cargoFromCode = (cd: number): Cargo | null => CODE_TO_CARGO[cd] ?? null;

const NOMINAL: Record<Cargo, RegExp> = {
  presidente: /^80$/, governador: /^80$/, senador: /^80\d$/, depfed: /^80\d{2}$/, depest: /^80\d{3}$/,
};
export const isUpLegenda = (cargo: Cargo, nr: string) => (cargo === 'depfed' || cargo === 'depest') && nr === '80';
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
    a.add(row({ CD_CARGO: '13', QT_VOTOS: '100' })); // cargo ignorado
    const s = a.sections();
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ cargo: 'depfed', uf: 'SP', tse: 71072, zona: 1, secao: 10, local: 1015, up: 5, validos: 15 });
    expect(a.candidatos('depfed')).toEqual(['FULANA']);    // legenda não entra como candidato
    expect(a.ufsComCandidatura('depfed')).toEqual(['SP']);
  });
  it('separa cargos na mesma seção', () => {
    const a = new Aggregator();
    a.add(row({ CD_CARGO: '3', NR_VOTAVEL: '80', NM_VOTAVEL: 'CICLANO', QT_VOTOS: '7' }));
    a.add(row({ CD_CARGO: '6', NR_VOTAVEL: '1310', QT_VOTOS: '1' }));
    expect(a.sections().map((s) => s.cargo).sort()).toEqual(['depfed', 'governador']);
    expect(a.ufsComCandidatura('depfed')).toEqual([]);
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
import type { Cargo } from '../../src/lib/data-types';
import { cargoFromCode, isUpLegenda, isUpVote, isValid } from './cargos';

export interface SecAcc {
  cargo: Cargo; uf: string; tse: number; munNome: string; zona: number; secao: number;
  local: number; localNome: string; up: number; validos: number;
}

export class Aggregator {
  private secs = new Map<string, SecAcc>();
  private cand = new Map<Cargo, Set<string>>();
  private ufsCand = new Map<Cargo, Set<string>>();

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
      if (!this.ufsCand.has(cargo)) this.ufsCand.set(cargo, new Set());
      this.ufsCand.get(cargo)!.add(r.SG_UF);
      if (!isUpLegenda(cargo, r.NR_VOTAVEL)) {
        if (!this.cand.has(cargo)) this.cand.set(cargo, new Set());
        this.cand.get(cargo)!.add(r.NM_VOTAVEL.trim());
      }
    }
  }

  sections(): SecAcc[] { return [...this.secs.values()]; }
  candidatos(cargo: Cargo): string[] { return [...(this.cand.get(cargo) ?? [])].sort(); }
  ufsComCandidatura(cargo: Cargo): string[] { return [...(this.ufsCand.get(cargo) ?? [])].sort(); }
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
import { CARGOS, type Ano, type Cargo, type CargoAnoFile, type MetaFile, type LocaisInfoFile } from '../../src/lib/data-types';
import { Aggregator } from './aggregate';
import { readZipCsv } from './csv';
import { ensureFile, UFS, urls } from './download';
import { loadCentroides, loadExterior, loadLocais, loadTseIbge } from './refs';
import { rollup, type Refs } from './rollup';
import { OUT, writeJson } from './write';

const STATE_CARGOS: Cargo[] = ['governador', 'senador', 'depfed', 'depest'];

async function runAno(ano: Ano, base: Omit<Refs, 'locais'>): Promise<Cargo[]> {
  const refs: Refs = { ...base, locais: await loadLocais(await ensureFile(urls.locais(ano))) };
  console.log(`[${ano}] ${refs.locais.size} locais com coordenadas`);
  const files = new Map<Cargo, CargoAnoFile>(CARGOS.map((c) => [c, {
    ano, cargo: c, candidatos: [], ufsComCandidatura: [], ufs: [], municipios: [], exterior: null,
  }]));
  const infoPorUf = new Map<string, LocaisInfoFile>();

  const process = async (zip: string, cargos: Cargo[]) => {
    const agg = new Aggregator();
    for await (const r of readZipCsv(zip)) agg.add(r);
    for (const cargo of cargos) {
      const ufsCand = agg.ufsComCandidatura(cargo);
      if (!ufsCand.length) continue;
      // Presidente: todas as seções; demais cargos: só UFs onde a UP disputou
      const secs = agg.sections().filter((s) => s.cargo === cargo && (cargo === 'presidente' || ufsCand.includes(s.uf)));
      const r = rollup(secs, refs);
      const f = files.get(cargo)!;
      f.candidatos = [...new Set([...f.candidatos, ...agg.candidatos(cargo)])].sort();
      f.ufsComCandidatura.push(...(cargo === 'presidente' ? r.ufs.map((u) => u.uf) : ufsCand));
      f.ufs.push(...r.ufs);
      f.municipios.push(...r.municipios);
      if (cargo === 'presidente') f.exterior = { cidades: r.cidades, paises: r.paises };
      for (const [uf, l] of r.locaisPorUf) {
        writeJson(`${ano}/${cargo}/locais/${uf}.json`, l.votos);
        infoPorUf.set(uf, { ...(infoPorUf.get(uf) ?? {}), ...l.info });
      }
    }
  };

  await process(await ensureFile(urls.secao(ano, 'BR')), ['presidente']);
  for (const uf of UFS) {
    console.log(`[${ano}] ${uf}`);
    await process(await ensureFile(urls.secao(ano, uf)), STATE_CARGOS);
  }
  for (const [uf, info] of infoPorUf) writeJson(`${ano}/locais/${uf}.json`, info);
  const disponiveis: Cargo[] = [];
  for (const [cargo, f] of files) {
    if (!f.ufs.length) continue;
    f.ufs.sort((a, b) => a.uf.localeCompare(b.uf));
    f.ufsComCandidatura.sort();
    writeJson(`${ano}/${cargo}.json`, f);
    disponiveis.push(cargo);
  }
  return disponiveis;
}

async function main() {
  const arg = process.argv.indexOf('--ano');
  const anos: Ano[] = arg > -1 && process.argv[arg + 1] !== 'all' ? [Number(process.argv[arg + 1]) as Ano] : [2022, 2026];
  const base = { tseIbge: loadTseIbge(), centroides: loadCentroides(), exterior: loadExterior() };
  const metaPath = `${OUT}/meta.json`;
  const meta: MetaFile = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { geradoEm: '', fonte: 'TSE — Portal de Dados Abertos (dadosabertos.tse.jus.br)', disponivel: {} };
  for (const ano of anos) {
    fs.rmSync(`${OUT}/${ano}`, { recursive: true, force: true });
    meta.disponivel[ano] = await runAno(ano, base);
  }
  meta.geradoEm = new Date().toISOString();
  writeJson('meta.json', meta);
  console.log('ETL ok', meta);
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
import { CARGOS, type CargoAnoFile } from '../../src/lib/data-types';
import { cargoFromCode } from './cargos';
import { readZipCsv } from './csv';
import { ensureFile, urls } from './download';

async function main() {
  let falhas = 0;
  for (const ano of [2022, 2026]) {
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

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { parseFilters, toQuery, DEFAULT_FILTERS } from '@/lib/filters';

describe('filters', () => {
  it('usa padrões quando vazio ou inválido', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(new URLSearchParams('ano=1999&cargo=rei'))).toEqual(DEFAULT_FILTERS);
  });
  it('ida e volta', () => {
    const f = { ano: 'compare', cargo: 'depfed', metrica: 'pct', escopo: 'brasil', uf: 'SP', mun: 3550308 } as const;
    expect(parseFilters(new URLSearchParams(toQuery(f)))).toEqual(f);
  });
  it('escopo exterior zera UF e município', () => {
    expect(parseFilters(new URLSearchParams('escopo=exterior&uf=SP&mun=1'))).toMatchObject({ escopo: 'exterior', uf: undefined, mun: undefined });
  });
  it('omite padrões na query', () => {
    expect(toQuery(DEFAULT_FILTERS)).toBe('');
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
import { CARGOS, type Cargo } from './data-types';

export type AnoSel = '2022' | '2026' | 'compare';
export type Metrica = 'votos' | 'pct';
export type Escopo = 'tudo' | 'brasil' | 'exterior';
export interface Filters { ano: AnoSel; cargo: Cargo; metrica: Metrica; escopo: Escopo; uf?: string; mun?: number }

export const DEFAULT_FILTERS: Filters = { ano: '2026', cargo: 'presidente', metrica: 'votos', escopo: 'tudo', uf: undefined, mun: undefined };
const pick = <T extends string>(v: string | null, ok: readonly T[], d: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : d);

export function parseFilters(q: URLSearchParams): Filters {
  const escopo = pick(q.get('escopo'), ['tudo', 'brasil', 'exterior'] as const, DEFAULT_FILTERS.escopo);
  const uf = escopo !== 'exterior' && /^[A-Z]{2}$/.test(q.get('uf') ?? '') ? q.get('uf')! : undefined;
  const mun = uf && /^\d{7}$/.test(q.get('mun') ?? '') ? Number(q.get('mun')) : undefined;
  return {
    ano: pick(q.get('ano'), ['2022', '2026', 'compare'] as const, DEFAULT_FILTERS.ano),
    cargo: pick(q.get('cargo'), CARGOS, DEFAULT_FILTERS.cargo),
    metrica: pick(q.get('metrica'), ['votos', 'pct'] as const, DEFAULT_FILTERS.metrica),
    escopo, uf, mun,
  };
}

export function toQuery(f: Filters): string {
  const q = new URLSearchParams();
  (['ano', 'cargo', 'metrica', 'escopo'] as const).forEach((k) => { if (f[k] !== DEFAULT_FILTERS[k]) q.set(k, String(f[k])); });
  if (f.uf) q.set('uf', f.uf);
  if (f.mun) q.set('mun', String(f.mun));
  return q.toString();
}
```

- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(site): estado dos filtros na URL`

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

Responsabilidade: dado `Filters` + dados carregados, decidir o **nível** (`uf` | `municipio` | `local` | `pais` | `cidade`) e produzir `ViewRow[]` e KPIs. Mapa, gráficos e tabela consomem só isso.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { buildView, type Loaded } from '@/lib/view';
import { DEFAULT_FILTERS } from '@/lib/filters';
import type { CargoAnoFile } from '@/lib/data-types';

const file = (ano: 2022 | 2026, upSP: number, upRJ: number, upLis: number): CargoAnoFile => ({
  ano, cargo: 'presidente', candidatos: ['X'], ufsComCandidatura: ['RJ', 'SP', 'ZZ'],
  ufs: [{ uf: 'RJ', up: upRJ, validos: 100 }, { uf: 'SP', up: upSP, validos: 100 }, { uf: 'ZZ', up: upLis, validos: 10 }],
  municipios: [{ ibge: 3550308, tse: 71072, uf: 'SP', nome: 'São Paulo', up: upSP, validos: 100 }, { ibge: 3304557, tse: 60011, uf: 'RJ', nome: 'Rio de Janeiro', up: upRJ, validos: 100 }],
  exterior: { cidades: [{ tse: 29955, nome: 'Lisboa', iso3: 'PRT', pais: 'Portugal', lat: 1, lon: 1, up: upLis, validos: 10 }], paises: [{ iso3: 'PRT', isoNum: '620', pais: 'Portugal', up: upLis, validos: 10 }] },
});
const loaded: Loaded = { 2022: file(2022, 10, 5, 1), 2026: file(2026, 20, 2, 3) };

describe('buildView', () => {
  it('Brasil inteiro → nível UF, KPIs incluem exterior no escopo tudo', () => {
    const v = buildView(DEFAULT_FILTERS, loaded);
    expect(v.level).toBe('uf');
    expect(v.rows.map((r) => r.id)).toEqual(['SP', 'RJ']);
    expect(v.kpis.total).toBe(25);           // 20 + 2 + 3 (2026)
    expect(v.kpis.totalOutro).toBe(16);      // 2022
  });
  it('escopo brasil exclui exterior', () => {
    expect(buildView({ ...DEFAULT_FILTERS, escopo: 'brasil' }, loaded).kpis.total).toBe(22);
  });
  it('UF selecionada → municípios da UF', () => {
    const v = buildView({ ...DEFAULT_FILTERS, uf: 'SP' }, loaded);
    expect(v.level).toBe('municipio');
    expect(v.rows.map((r) => r.nome)).toEqual(['São Paulo']);
  });
  it('exterior → países; comparar calcula delta', () => {
    const v = buildView({ ...DEFAULT_FILTERS, escopo: 'exterior', ano: 'compare' }, loaded);
    expect(v.level).toBe('pais');
    expect(v.rows[0]).toMatchObject({ id: 'PRT', a: { up: 1 }, b: { up: 3 }, delta: 2 });
  });
  it('cargo sem candidatura no exterior', () => {
    const f = { ...file(2026, 1, 1, 0), cargo: 'depfed' as const, exterior: null, ufsComCandidatura: ['SP'] };
    const v = buildView({ ...DEFAULT_FILTERS, cargo: 'depfed', escopo: 'exterior' }, { 2026: f });
    expect(v.aviso).toMatch(/exterior/i);
    expect(v.rows).toEqual([]);
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementação**

```ts
import type { Ano, CargoAnoFile, Tally } from './data-types';
import type { Filters } from './filters';
import { delta, value } from './metrics';
import { joinRows } from './compare';

export type Level = 'uf' | 'municipio' | 'local' | 'pais' | 'cidade';
export interface ViewRow { id: string; nome: string; uf?: string; a?: Tally; b?: Tally; value: number; delta: number | null; lat?: number; lon?: number; isoNum?: string; secoes?: { ano: Ano; secao: number; up: number; validos: number }[] }
export interface ViewModel {
  level: Level; rows: ViewRow[]; aviso?: string;
  anoA: Ano; anoB?: Ano;                 // A = ano exibido (ou 2022 no compare), B = 2026 no compare
  kpis: { total: number; totalOutro: number | null; pct: number; pctOutro: number | null; lugaresComVoto: number };
  candidatos: string[];
}
export type Loaded = Partial<Record<Ano, CargoAnoFile>>;

const sum = (xs: Tally[]): Tally => xs.reduce((s, x) => ({ up: s.up + x.up, validos: s.validos + x.validos }), { up: 0, validos: 0 });

function rowsFor(f: CargoAnoFile | undefined, filters: Filters, level: Level) {
  if (!f) return [];
  switch (level) {
    case 'uf': return f.ufs.filter((u) => u.uf !== 'ZZ').map((u) => ({ id: u.uf, nome: u.uf, t: u }));
    case 'municipio': return f.municipios.filter((m) => m.uf === filters.uf).map((m) => ({ id: String(m.ibge), nome: m.nome, uf: m.uf, t: m }));
    case 'pais': return (f.exterior?.paises ?? []).map((p) => ({ id: p.iso3, nome: p.pais, isoNum: p.isoNum, t: p }));
    case 'cidade': return (f.exterior?.cidades ?? []).map((c) => ({ id: String(c.tse), nome: `${c.nome} (${c.pais})`, lat: c.lat ?? undefined, lon: c.lon ?? undefined, t: c }));
    default: return [];
  }
}

function scopeTally(f: CargoAnoFile | undefined, filters: Filters): Tally | null {
  if (!f) return null;
  const ufs = f.ufs.filter((u) => (filters.escopo === 'exterior' ? u.uf === 'ZZ' : filters.escopo === 'brasil' ? u.uf !== 'ZZ' : true))
    .filter((u) => !filters.uf || u.uf === filters.uf);
  if (filters.mun) return sum(f.municipios.filter((m) => m.ibge === filters.mun));
  return sum(ufs);
}

export function buildView(filters: Filters, loaded: Loaded, cidadeLevel = false): ViewModel {
  const compare = filters.ano === 'compare';
  const anoA: Ano = compare ? 2022 : (Number(filters.ano) as Ano);
  const anoB: Ano | undefined = compare ? 2026 : undefined;
  const fa = loaded[anoA], fb = anoB ? loaded[anoB] : undefined;
  const level: Level = filters.escopo === 'exterior' ? (cidadeLevel ? 'cidade' : 'pais') : filters.uf ? 'municipio' : 'uf';

  let aviso: string | undefined;
  if (filters.escopo === 'exterior' && filters.cargo !== 'presidente')
    aviso = 'No exterior só se vota para Presidente. Escolha o cargo Presidente para ver os votos internacionais.';
  else if (!fa && !fb) aviso = 'A UP não teve candidatura para este cargo neste ano.';
  else if (filters.uf && ![fa, fb].some((f) => f?.ufsComCandidatura.includes(filters.uf!)))
    aviso = `A UP não teve candidatura para este cargo em ${filters.uf}.`;

  const joined = aviso ? [] : joinRows(rowsFor(fa, filters, level), rowsFor(fb, filters, level), (r) => r.id);
  const rows: ViewRow[] = joined.map(({ key, a, b }) => {
    const base = (b ?? a)!;
    const ta = a?.t, tb = b?.t;
    return {
      id: key, nome: base.nome, uf: (base as any).uf, lat: (base as any).lat, lon: (base as any).lon, isoNum: (base as any).isoNum,
      a: ta ? { up: ta.up, validos: ta.validos } : undefined, b: tb ? { up: tb.up, validos: tb.validos } : undefined,
      value: value(compare ? tb : ta, filters.metrica),
      delta: compare ? delta(ta, tb, filters.metrica) : null,
    };
  }).sort((x, y) => (compare ? Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0) : y.value - x.value));

  const ta = scopeTally(fa, filters), tb = anoB ? scopeTally(fb, filters) : null;
  const atual = compare ? tb : ta, outro = compare ? ta : scopeTally(loaded[anoA === 2026 ? 2022 : 2026], filters);
  return {
    level, rows, aviso, anoA, anoB,
    kpis: {
      total: atual?.up ?? 0, totalOutro: outro?.up ?? null,
      pct: value(atual ?? undefined, 'pct'), pctOutro: outro ? value(outro, 'pct') : null,
      lugaresComVoto: rows.filter((r) => ((compare ? r.b : r.a)?.up ?? 0) > 0).length,
    },
    candidatos: [...new Set([...(fa?.candidatos ?? []), ...(fb?.candidatos ?? [])])],
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

export const PALETTE = {
  preto: '#000000', grafite: '#242424', branco: '#FFFFFF', cinzaClaro: '#E8E8E8', areia: '#CCC5BC',
  amarelo: '#FFC107', verde: '#2B3B2B', creme: '#EAD8BF', queimado: '#C66F2F', vermelho: '#D64444',
  roxo: '#545288', mostarda: '#DDCB6E', laranjaClaro: '#F4AA34', laranja: '#F4900C',
  ano2022: '#545288', ano2026: '#F4900C', cresceu: '#C66F2F', caiu: '#545288', neutro: '#EAD8BF', zero: '#F3EFEA',
} as const;

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

const cache = new Map<string, Promise<any>>();
export function fetchJson<T>(path: string): Promise<T | null> {
  if (!cache.has(path)) cache.set(path, fetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(path)!;
}

export function useJson<T>(path: string | null): { data: T | null; loading: boolean } {
  const [state, set] = useState<{ path: string | null; data: T | null }>({ path: null, data: null });
  useEffect(() => { let on = true; if (path) fetchJson<T>(path).then((d) => on && set({ path, data: d })); return () => { on = false; }; }, [path]);
  return { data: state.path === path ? state.data : null, loading: !!path && state.path !== path };
}

export const paths = {
  meta: '/data/meta.json',
  cargoAno: (ano: Ano, cargo: Cargo) => `/data/${ano}/${cargo}.json`,
  locaisInfo: (ano: Ano, uf: string) => `/data/${ano}/locais/${uf}.json`,
  locaisVotos: (ano: Ano, cargo: Cargo, uf: string) => `/data/${ano}/${cargo}/locais/${uf}.json`,
};

export function useCargoAnos(cargo: Cargo) {
  const a = useJson<CargoAnoFile>(paths.cargoAno(2022, cargo));
  const b = useJson<CargoAnoFile>(paths.cargoAno(2026, cargo));
  return { loaded: { ...(a.data ? { 2022: a.data } : {}), ...(b.data ? { 2026: b.data } : {}) }, loading: a.loading || b.loading };
}
export type { MetaFile, LocaisInfoFile, LocaisVotosFile };
```

- [ ] **Step 2:** `npx tsc --noEmit` sem erros. **Step 3: Commit** — `feat(site): carregamento de dados com cache`

---

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

### Task 19: Barra de filtros

**Files:** Create `src/components/Segmented.tsx`, `src/components/FilterBar.tsx`

- [ ] **Step 1: `Segmented.tsx`**

```tsx
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-display uppercase text-xs tracking-widest text-[var(--muted)] mb-1">{label}</legend>
      <div role="radiogroup" className="flex flex-wrap border-2 border-[var(--line)]">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 font-display font-bold uppercase text-sm md:text-base whitespace-nowrap transition-colors disabled:opacity-35
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

```tsx
'use client';
import { CARGOS, CARGO_LABEL, type Cargo } from '@/lib/data-types';
import type { Filters } from '@/lib/filters';
import { Segmented } from './Segmented';
import { JoinCta } from './JoinCta';

export function FilterBar({ f, set, disponiveis }: { f: Filters; set: (p: Partial<Filters>) => void; disponiveis: Set<Cargo> }) {
  return (
    <div className="sticky top-0 z-30 bg-[var(--bg)]/95 backdrop-blur border-b-2 border-[var(--line)]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-3 items-end">
        <Segmented label="Ano" value={f.ano} onChange={(ano) => set({ ano })}
          options={[{ value: '2022', label: '2022' }, { value: '2026', label: '2026' }, { value: 'compare', label: '2022 × 2026' }]} />
        <Segmented label="Cargo" value={f.cargo} onChange={(cargo) => set({ cargo })}
          options={CARGOS.map((c) => ({ value: c, label: CARGO_LABEL[c], disabled: !disponiveis.has(c) }))} />
        <Segmented label="Métrica" value={f.metrica} onChange={(metrica) => set({ metrica })}
          options={[{ value: 'votos', label: 'Votos' }, { value: 'pct', label: '% válidos' }]} />
        <Segmented label="Onde" value={f.escopo} onChange={(escopo) => set({ escopo, uf: undefined, mun: undefined })}
          options={[{ value: 'tudo', label: 'Tudo' }, { value: 'brasil', label: 'Brasil' }, { value: 'exterior', label: 'Exterior' }]} />
        <div className="ml-auto hidden lg:block"><JoinCta size="sm" /></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** `npx tsc --noEmit`. **Step 4: Commit** — `feat(ui): barra de filtros segmentada`

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

export function KpiRow({ v, compare }: { v: ViewModel; compare: boolean }) {
  const { total, totalOutro, pct, pctOutro, lugaresComVoto } = v.kpis;
  const anoAtual = compare ? 2026 : v.anoA, anoOutro = anoAtual === 2026 ? 2022 : 2026;
  const lugar = { uf: 'UFs', municipio: 'municípios', local: 'locais', pais: 'países', cidade: 'cidades' }[v.level];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi highlight label={`Votos UP · ${anoAtual}`} value={fmtInt(total)} sub={totalOutro !== null ? `${fmtDelta(total - totalOutro, 'votos')} vs. ${anoOutro}` : undefined} />
      <Kpi label="% dos válidos" value={fmtPct(pct)} sub={pctOutro !== null ? `${fmtDelta(pct - pctOutro, 'pct')} vs. ${anoOutro}` : undefined} />
      <Kpi label="Variação" value={totalOutro ? `${total >= totalOutro ? '+' : '−'}${Math.abs(Math.round(((total - totalOutro) / totalOutro) * 100))}%` : '—'} sub={totalOutro !== null ? `${fmtInt(totalOutro)} votos em ${anoOutro}` : undefined} />
      <Kpi label={`${lugar} com voto`} value={fmtInt(lugaresComVoto)} sub={v.candidatos.length ? v.candidatos.join(' · ') : undefined} />
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
          {it.go && i < items.length - 1 ? <button className="underline underline-offset-4" onClick={() => set(it.go!)}>{it.label}</button> : <span className="font-bold">{it.label}</span>}
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
import { fmtDelta, fmtInt, fmtPct, fmtValue } from '@/lib/format';
import { fetchJson } from '@/lib/load';
import { MapLegend } from './MapLegend';

type FC = GeoJSON.FeatureCollection;
const geo = { ufs: null as FC | null, mun: null as FC | null, world: null as FC | null };
async function loadGeo() {
  if (!geo.ufs) { const t: any = await fetchJson('/geo/br-ufs.topo.json'); geo.ufs = feature(t, t.objects.ufs) as any; }
  if (!geo.mun) { const t: any = await fetchJson('/geo/br-municipios.topo.json'); geo.mun = feature(t, t.objects.municipios) as any; }
  if (!geo.world) { const t: any = await fetchJson('/geo/world.topo.json'); geo.world = feature(t, t.objects.countries) as any; }
  return geo as { ufs: FC; mun: FC; world: FC };
}

export interface PointRow { id: string; nome: string; lat: number; lon: number; aprox: boolean; value: number; delta: number | null; up: number; validos: number; secoes: string }

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
  const compare = f.ano === 'compare';
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
        ? `<b>2022:</b> ${fmtInt(r.a?.up ?? 0)} (${fmtPct(r.a?.validos ? (r.a.up / r.a.validos) * 100 : 0)})<br><b>2026:</b> ${fmtInt(r.b?.up ?? 0)} (${fmtPct(r.b?.validos ? (r.b.up / r.b.validos) * 100 : 0)})<br><b>Δ</b> ${fmtDelta(r.delta ?? 0, f.metrica)}`
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
  }, [ready, f, set, compare]);

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

- [ ] **Step 1: Implementação** — carrega `locaisInfo` e `locaisVotos` para a UF selecionada (ambos os anos no modo comparar), casa locais com `matchLocais`, filtra por município se `f.mun`, e devolve `PointRow[]`.

```ts
'use client';
import { useMemo } from 'react';
import type { Ano } from './data-types';
import type { Filters } from './filters';
import { useJson, paths } from './load';
import type { LocaisInfoFile, LocaisVotosFile } from './data-types';
import { matchLocais } from './compare';
import { delta, value } from './metrics';
import type { PointRow } from '@/components/MapPanel';

export function usePoints(f: Filters, munTse: number | undefined): PointRow[] {
  const on = f.escopo !== 'exterior' && !!f.uf;
  const anos: Ano[] = f.ano === 'compare' ? [2022, 2026] : [Number(f.ano) as Ano];
  const i0 = useJson<LocaisInfoFile>(on ? paths.locaisInfo(anos[0], f.uf!) : null);
  const v0 = useJson<LocaisVotosFile>(on ? paths.locaisVotos(anos[0], f.cargo, f.uf!) : null);
  const i1 = useJson<LocaisInfoFile>(on && anos[1] ? paths.locaisInfo(anos[1], f.uf!) : null);
  const v1 = useJson<LocaisVotosFile>(on && anos[1] ? paths.locaisVotos(anos[1], f.cargo, f.uf!) : null);

  return useMemo(() => {
    if (!on || !i0.data) return [];
    const secStr = (vf: LocaisVotosFile | null, k: string) => vf?.secoes[k]?.map(([s, up]) => `${s} (${up})`).join(', ') ?? '';
    const votos = (vf: LocaisVotosFile | null) => new Map((vf?.rows ?? []).map(([k, up, validos]) => [k, { up, validos }]));
    const inMun = (tse: number) => !munTse || tse === munTse;
    if (f.ano !== 'compare') {
      const vm = votos(v0.data);
      return Object.entries(i0.data).filter(([, x]) => inMun(x[4])).map(([k, [nome, lat, lon, aprox]]) => {
        const t = vm.get(k) ?? { up: 0, validos: 0 };
        return { id: k, nome, lat, lon, aprox: !!aprox, value: value(t, f.metrica), delta: null, up: t.up, validos: t.validos, secoes: secStr(v0.data, k) };
      }).filter((p) => p.validos > 0);
    }
    if (!i1.data) return [];
    const match = matchLocais(i0.data, i1.data);
    const va = votos(v0.data), vb = votos(v1.data);
    const out: PointRow[] = [];
    for (const [ka, kb] of match) {
      const [nome, lat, lon, aprox, tse] = i1.data[kb];
      if (!inMun(tse)) continue;
      const a = va.get(ka), b = vb.get(kb);
      if (!a && !b) continue;
      out.push({ id: kb, nome, lat, lon, aprox: !!aprox, value: value(b, f.metrica), delta: delta(a, b, f.metrica), up: b?.up ?? 0, validos: b?.validos ?? 0, secoes: secStr(v1.data, kb) });
    }
    return out;
  }, [on, f.ano, f.metrica, munTse, i0.data, v0.data, i1.data, v1.data]);
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
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
echarts.use([BarChart, ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, SVGRenderer]);

export const baseTextStyle = { fontFamily: 'var(--font-barlow), system-ui, sans-serif', color: 'currentColor' };

export function EChart({ option, height = 360, label }: { option: echarts.EChartsCoreOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    chart.current = echarts.init(el.current!, undefined, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); chart.current?.dispose(); };
  }, []);
  useEffect(() => { chart.current?.setOption({ textStyle: baseTextStyle, ...option }, true); }, [option]);
  return <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full" />;
}
```

- [ ] **Step 2: `DivergingBars.tsx`** — 15 maiores ganhos e 15 maiores quedas (modo comparar) ou top 20 (ano único)

```tsx
'use client';
import { useMemo } from 'react';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { PALETTE, seqColor } from '@/lib/colors';
import { fmtDelta, fmtValue } from '@/lib/format';
import { EChart } from './EChart';

export function DivergingBars({ v, compare, metrica }: { v: ViewModel; compare: boolean; metrica: Metrica }) {
  const option = useMemo(() => {
    const rows = compare
      ? [...v.rows].filter((r) => r.delta !== null).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
      : [...v.rows].sort((a, b) => b.value - a.value).slice(0, 20);
    const sel = compare ? [...rows.slice(0, 15), ...rows.slice(-15).filter((r) => !rows.slice(0, 15).includes(r))] : rows;
    const data = sel.reverse();
    const max = Math.max(0, ...data.map((r) => r.value));
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x: number) => (compare ? fmtDelta(x, metrica) : fmtValue(x, metrica)) },
      xAxis: { type: 'value', axisLabel: { formatter: (x: number) => (compare ? fmtDelta(x, metrica) : fmtValue(x, metrica)) }, splitLine: { lineStyle: { color: '#0002' } } },
      yAxis: { type: 'category', data: data.map((r) => r.nome), axisTick: { show: false }, axisLine: { lineStyle: { color: 'currentColor' } } },
      series: [{
        type: 'bar', barMaxWidth: 14,
        data: data.map((r) => ({ value: compare ? r.delta : r.value, itemStyle: { color: compare ? ((r.delta ?? 0) >= 0 ? PALETTE.cresceu : PALETTE.caiu) : seqColor(r.value, max) } })),
        label: { show: true, position: 'right', fontSize: 11, formatter: (p: any) => (compare ? fmtDelta(p.value, metrica) : fmtValue(p.value, metrica)) },
      }],
    };
  }, [v, compare, metrica]);
  return <EChart option={option} height={Math.max(320, Math.min(30, v.rows.length) * 22 + 40)} label={compare ? 'Maiores ganhos e quedas' : 'Maiores votações'} />;
}
```

- [ ] **Step 3: `Scatter.tsx`** — 2022 (x) × 2026 (y), diagonal de referência; só no modo comparar

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
    const pts = v.rows.map((r) => ({ name: r.nome, value: [value(r.a, metrica), value(r.b, metrica)], up: r.b?.up ?? 0 }));
    const max = Math.max(1, ...pts.flatMap((p) => p.value));
    const log = metrica === 'votos' && max > 1000;
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: { formatter: (p: any) => `<b>${p.name}</b><br>2022: ${fmtValue(p.value[0], metrica)}<br>2026: ${fmtValue(p.value[1], metrica)}` },
      xAxis: { type: log ? 'log' : 'value', name: '2022', min: log ? 1 : 0, nameLocation: 'end', axisLabel: { formatter: (x: number) => fmtValue(x, metrica) } },
      yAxis: { type: log ? 'log' : 'value', name: '2026', min: log ? 1 : 0, axisLabel: { formatter: (x: number) => fmtValue(x, metrica) } },
      series: [
        { type: 'scatter', symbolSize: 8,
          data: pts.map((p) => ({ ...p, value: log ? p.value.map((x) => Math.max(1, x)) : p.value,
            itemStyle: { color: p.value[1] >= p.value[0] ? PALETTE.cresceu : PALETTE.caiu, opacity: 0.8, borderColor: '#000', borderWidth: 0.5 } })) },
        { type: 'line', data: [[log ? 1 : 0, log ? 1 : 0], [max, max]], symbol: 'none', lineStyle: { type: 'dashed', color: 'currentColor', width: 1 }, tooltip: { show: false } },
      ],
    };
  }, [v, metrica]);
  return <EChart option={option} height={380} label="Dispersão 2022 × 2026: acima da diagonal cresceu" />;
}
```

- [ ] **Step 4: `GroupedBars.tsx`** — barras 2022 × 2026 por UF/país (todas as linhas do nível atual, máx. 30)

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
    const rows = [...v.rows].sort((a, b) => value(b.b ?? b.a, metrica) - value(a.b ?? a.a, metrica)).slice(0, 30);
    return {
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: 'currentColor' } },
      tooltip: { trigger: 'axis', valueFormatter: (x: number) => fmtValue(x, metrica) },
      xAxis: { type: 'category', data: rows.map((r) => r.nome), axisLabel: { rotate: rows.length > 12 ? 45 : 0, interval: 0 } },
      yAxis: { type: 'value', axisLabel: { formatter: (x: number) => fmtValue(x, metrica) }, splitLine: { lineStyle: { color: '#0002' } } },
      series: [
        { name: '2022', type: 'bar', data: rows.map((r) => value(r.a, metrica)), itemStyle: { color: PALETTE.ano2022 } },
        { name: '2026', type: 'bar', data: rows.map((r) => value(r.b, metrica)), itemStyle: { color: PALETTE.ano2026 } },
      ],
    };
  }, [v, metrica]);
  return <EChart option={option} height={380} label="Comparativo 2022 e 2026" />;
}
```

- [ ] **Step 5:** `npx tsc --noEmit`. **Step 6: Commit** — `feat(ui): gráficos de ranking, dispersão e barras agrupadas`

### Task 24: Tabela, notas e Dashboard

**Files:** Create `src/components/DataTable.tsx`, `src/components/Notes.tsx`, `src/components/Dashboard.tsx`, `src/app/page.tsx`

- [ ] **Step 1: `DataTable.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import type { ViewModel } from '@/lib/view';
import type { Metrica } from '@/lib/filters';
import { fmtDelta, fmtInt, fmtPct } from '@/lib/format';
import { value } from '@/lib/metrics';

type Col = 'nome' | 'a' | 'b' | 'delta';
export function DataTable({ v, compare, metrica }: { v: ViewModel; compare: boolean; metrica: Metrica }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: compare ? 'delta' : 'a', dir: -1 });
  const rows = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const key = (r: (typeof v.rows)[number]) => sort.col === 'nome' ? r.nome : sort.col === 'a' ? value(r.a, metrica) : sort.col === 'b' ? value(r.b, metrica) : (r.delta ?? 0);
    return v.rows.filter((r) => norm(r.nome).includes(norm(q)))
      .sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : 0) * sort.dir; });
  }, [v, q, sort, metrica]);

  const csv = () => {
    const head = compare ? ['nome', 'votos_2022', 'validos_2022', 'votos_2026', 'validos_2026'] : ['nome', 'votos', 'validos', 'pct'];
    const lines = rows.map((r) => compare
      ? [r.nome, r.a?.up ?? 0, r.a?.validos ?? 0, r.b?.up ?? 0, r.b?.validos ?? 0]
      : [r.nome, r.a?.up ?? 0, r.a?.validos ?? 0, value(r.a, 'pct').toFixed(4)]);
    const blob = new Blob(['﻿' + [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `up-${v.level}.csv`; a.click();
  };

  const th = (col: Col, label: string) => (
    <th scope="col" className="text-left p-2 font-display uppercase tracking-wider">
      <button onClick={() => setSort((s) => ({ col, dir: s.col === col ? (-s.dir as 1 | -1) : -1 }))}>
        {label}{sort.col === col ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
  const cell = (t?: { up: number; validos: number }) => t ? <>{fmtInt(t.up)} <span className="text-[var(--muted)]">({fmtPct(value(t, 'pct'))})</span></> : '—';

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
            <tr>{th('nome', 'Lugar')}{compare ? <>{th('a', '2022')}{th('b', '2026')}{th('delta', 'Variação')}</> : th('a', 'Votos')}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)]/20">
                <td className="p-2">{r.nome}</td>
                {compare ? <><td className="p-2">{cell(r.a)}</td><td className="p-2">{cell(r.b)}</td>
                  <td className={`p-2 font-semibold ${(r.delta ?? 0) >= 0 ? 'text-queimado' : 'text-roxo'}`}>{r.delta === null ? '—' : fmtDelta(r.delta, metrica)}</td></>
                  : <td className="p-2">{cell(r.a)}</td>}
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
          <li><b>Votos</b>: Presidente, Governador e Senador contam os votos nos candidatos da UP; para deputados, somam-se os votos nominais e os de legenda (80).</li>
          <li><b>% válidos</b>: votos da UP ÷ votos válidos (exclui brancos e nulos) no mesmo lugar e cargo.</li>
          <li>O TSE renumera seções entre eleições. Por isso a comparação 2022 × 2026 é feita por <b>local de votação</b> (casado por zona e número do local ou, na falta, pelo nome da escola) e por município. Seções aparecem no detalhe de cada local.</li>
          <li>No exterior só há votação para Presidente. Locais sem coordenadas aparecem no centro do município (“localização aproximada”).</li>
          <li>Onde a UP não lançou candidatura para um cargo, o site indica “sem candidatura” — não é o mesmo que zero votos.</li>
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
import { parseFilters, toQuery, type Filters } from '@/lib/filters';
import { useCargoAnos, useJson, paths } from '@/lib/load';
import { buildView } from '@/lib/view';
import { usePoints } from '@/lib/usePoints';
import type { Cargo, MetaFile } from '@/lib/data-types';
import { Hero } from './Hero';
import { FilterBar } from './FilterBar';
import { KpiRow } from './KpiRow';
import { Breadcrumb } from './Breadcrumb';
import { MapPanel } from './MapPanel';
import { DivergingBars } from './charts/DivergingBars';
import { Scatter } from './charts/Scatter';
import { GroupedBars } from './charts/GroupedBars';
import { DataTable } from './DataTable';
import { Notes } from './Notes';
import { Footer } from './Footer';
import { JoinCta } from './JoinCta';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  const disponiveis = useMemo(() => new Set<Cargo>(Object.values(meta?.disponivel ?? {}).flat() as Cargo[]), [meta]);
  const { loaded, loading } = useCargoAnos(f.cargo);
  const compare = f.ano === 'compare';
  const v = useMemo(() => buildView(f, loaded), [f, loaded]);
  const munRow = f.mun ? (loaded[2026] ?? loaded[2022])?.municipios.find((m) => m.ibge === f.mun) : undefined;
  const points = usePoints(f, munRow?.tse);

  return (
    <>
      <Hero geradoEm={meta?.geradoEm} />
      <FilterBar f={f} set={set} disponiveis={disponiveis} />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-10" aria-busy={loading}>
        <KpiRow v={v} compare={compare} />
        <Section title={compare ? 'Onde crescemos e onde caímos' : 'Mapa dos votos'}>
          <Breadcrumb f={f} set={set} munNome={munRow?.nome} />
          <MapPanel v={v} f={f} set={set} points={points} />
          {f.escopo !== 'exterior' && !f.uf && <p className="text-sm text-[var(--muted)]">Clique em um estado para ver os municípios e os locais de votação.</p>}
        </Section>
        {!v.aviso && (
          <div className="grid gap-10 lg:grid-cols-2">
            <Section title={compare ? 'Maiores ganhos e quedas' : 'Onde mais votamos'}><DivergingBars v={v} compare={compare} metrica={f.metrica} /></Section>
            {compare
              ? <Section title="2022 × 2026, lugar a lugar"><Scatter v={v} metrica={f.metrica} /><p className="text-sm text-[var(--muted)]">Acima da linha tracejada: a UP cresceu.</p></Section>
              : <Section title="Comparativo com o outro ano"><GroupedBars v={buildView({ ...f, ano: 'compare' }, loaded)} metrica={f.metrica} /></Section>}
            {compare && <div className="lg:col-span-2"><Section title={f.escopo === 'exterior' ? 'Por país' : f.uf ? `Municípios de ${f.uf}` : 'Por estado'}><GroupedBars v={v} metrica={f.metrica} /></Section></div>}
          </div>
        )}
        {!v.aviso && <Section title="Todos os dados"><DataTable v={v} compare={compare} metrica={f.metrica} /></Section>}
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

- [ ] **Step 5: Build** — `npm run build` → sucesso, pasta `out/` gerada.
- [ ] **Step 6: Commit** — `feat(ui): dashboard completo`

---

## Fase 4 — Verificação e deploy

### Task 25: Testes e tipos

- [ ] `npm test` → todos PASS.
- [ ] `npm run typecheck` → sem erros.
- [ ] `npm run validate` → `validação ok`.

### Task 26: Verificação no navegador (superpowers:verification-before-completion)

- [ ] `npm run dev` e abrir `http://localhost:3000` (desktop 1440px e mobile 390px).
- [ ] Fluxos:
  1. Padrão (2026, Presidente): KPI total = 122.911; mapa colorido por UF; SP mais escuro.
  2. Clique em SP → municípios; zoom em São Paulo → pontos de locais com popup e seções.
  3. 2022 × 2026: cores divergentes; ranking com ganhos (queimado) e quedas (roxo); dispersão.
  4. Exterior: mapa-múndi; Portugal e Japão destacados; tabela com países; KPI 1.053 (2026).
  5. Dep. Federal + Exterior → aviso "No exterior só se vota para Presidente".
  6. UF sem candidatura (ex.: Governador 2022 em AC) → aviso "sem candidatura".
  7. Copiar URL com filtros, abrir em nova aba → mesmo estado.
  8. Botão "Votei na UP e quero me organizar!" abre unidadepopular.org.br/filie-se em nova aba (hero, rodapé, flutuante no mobile).
  9. Tema escuro do sistema: logo branca, contraste OK.
- [ ] Ajustes visuais encontrados → commit `fix(ui): ajustes de verificação`.

### Task 27: Deploy

- [ ] Confirmar que `public/data` e `public/geo` estão commitados e que `.cache/` não está.
- [ ] `git push -u origin main` → Vercel (já conectado ao repositório) faz o build. Framework: Next.js; comando `next build`; saída gerenciada pelo Vercel.
- [ ] Acompanhar o deploy (vercel MCP `list_deployments` / `get_deployment`) até `READY`; abrir a URL e repetir os fluxos 1, 3, 4 e 8.
