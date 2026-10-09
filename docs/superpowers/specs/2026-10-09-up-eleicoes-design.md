# Hotsite "UP nas Eleições 2022 × 2026" — Design

Data: 2026-10-09
Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Hotsite estático no Vercel que mostra, em mapa e gráficos, os votos recebidos pela
Unidade Popular (UP, número 80) nas eleições gerais de 2022 e 2026, permitindo ver onde a
votação cresceu e onde diminuiu — no Brasil (UF, município, local de votação/seção) e no
exterior (país, cidade, seção), com filtro exclusivo para dados internacionais.

## Escopo

- Anos: 2022 (1º turno) e 2026 (1º turno; dados publicados pelo TSE em 2026-10-06).
  A UP não disputa 2º turno; se houver retotalização, basta reexecutar o ETL.
- Cargos (seletor): Presidente, Governador, Senador, Deputado Federal, Deputado Estadual/Distrital.
  - Presidente: votos no número `80`.
  - Governador/Senador: votos no(s) candidato(s) da UP (número `80` / `80x`).
  - Deputados: votos nominais (`80xxx` / `80xxxx`) + votos de legenda (`80`).
  - Exterior só existe para Presidente (regra eleitoral); nos demais cargos o escopo
    "Só Exterior" mostra aviso em vez de mapa vazio.
- Métricas (alternáveis): votos absolutos e % dos votos válidos da unidade.
- Escopos: Tudo / Só Brasil / Só Exterior.
- Fora de escopo: outros partidos, eleições municipais, dados em tempo real, contas/login.

## Fonte de dados

Portal de Dados Abertos do TSE (CDN `cdn.tse.jus.br/estatistica/sead/odsele/`):

| Arquivo | Uso |
|---|---|
| `votacao_secao/votacao_secao_{ano}_{UF}.zip` (27 UFs + `BR` + `ZZ`) | votos por seção, todos os cargos |
| `eleitorado_local_votacao/eleitorado_local_votacao_{ano}.zip` | lat/long e nome dos locais de votação |
| `relatorio_resultado_totalizacao/Relatorio_Resultado_Totalizacao_{ano}_{UF}.zip` | conferência dos totais |

Complementos versionados no repositório:
- Tabela de correspondência código de município TSE → IBGE.
- Malhas: UFs e municípios do IBGE (TopoJSON simplificado); países (Natural Earth 1:50m).
- Tabela cidade do exterior (código TSE) → país (ISO-3166 alfa-3), gerada a partir dos
  dados do TSE e revisada manualmente quando faltar o país.

Os CSVs do TSE são `latin1`, separados por `;`, com aspas. O layout exato de colunas e
quais cargos estão em cada arquivo (`BR` vs UF) será confirmado na primeira tarefa da
implementação, inspecionando os arquivos reais.

## Arquitetura

Abordagem escolhida: **ETL offline + site estático** (alternativas descartadas: funções
consultando a API de divulgação do TSE — não chega a seção e é frágil; banco Postgres —
infraestrutura desproporcional).

```
TSE (CSVs zip) ──► scripts/etl ──► public/data/**/*.json ──► Next.js (export estático) ──► Vercel
                        │
                        └─► scripts/etl/validate (confere com Relatório de Totalização)
```

### 1. ETL (`scripts/etl/`, Node 24 + TypeScript, executado com `tsx`)

Unidades, cada uma com uma responsabilidade:

- `download.ts` — baixa zips para `.cache/tse/` (fora do git), com retomada e checagem de tamanho.
- `parse.ts` — lê o CSV dentro do zip em streaming (`yauzl` + `csv-parse`), decodifica latin1,
  emite linhas tipadas `{ano, uf, codMunTse, zona, secao, local, cargo, numVotavel, votos}`.
- `aggregate.ts` — função pura: dada a sequência de linhas, acumula por seção
  `votosUP` e `votosValidos` (exclui brancos `95`, nulos `96` e anulados/apuração em separado `97`/`98`)
  e sobe os totais para local → município → UF/país.
- `geo.ts` — associa local de votação a lat/long; município a código IBGE; cidade do exterior a país.
- `write.ts` — grava JSON compacto (arrays de tuplas + cabeçalho de colunas, números inteiros).
- `validate.ts` — compara total da UP por UF/cargo com o Relatório de Totalização; falha (exit 1)
  se divergir.
- `index.ts` — orquestra: `npm run etl -- --ano 2026` ou `--ano all`.

### 2. Formato dos dados publicados

```
public/data/
  meta.json                         # anos, cargos disponíveis por ano/UF, data de geração, fonte
  {ano}/{cargo}/ufs.json            # por UF: votosUP, validos
  {ano}/{cargo}/municipios.json     # por município IBGE: votosUP, validos
  {ano}/{cargo}/exterior.json       # por país e por cidade: votosUP, validos, lat/long da cidade
  {ano}/{cargo}/locais/{UF}.json    # por local: lat, lon, nome, votosUP, validos, seções[]
  compare/{cargo}/municipios.json   # delta abs e delta p.p. por município (pré-calculado)
  compare/{cargo}/locais/{UF}.json  # delta por local de votação casado entre anos
```

"Sem candidatura" é representado como `null`, distinto de `0` votos.

### 3. Site (Next.js App Router, `output: 'export'`, TypeScript, Tailwind)

Página única com estado dos filtros refletido na URL (`?ano=compare&cargo=presidente&metrica=pct&escopo=exterior&uf=SP`),
para links compartilháveis.

Componentes:
- `Header` — logo da UP, título, nota da fonte.
- `FilterBar` (fixa ao rolar) — Ano (2022 / 2026 / Comparar), Cargo, Métrica (Votos / % válidos),
  Escopo (Tudo / Só Brasil / Só Exterior). Controles segmentados, não dropdowns, quando ≤ 4 opções.
- `KpiRow` — total de votos UP, % válidos, variação vs. outro ano, nº de municípios com voto.
- `MapPanel` (MapLibre GL, sem token):
  - Brasil: coroplético por UF → clique/zoom → municípios da UF → zoom alto → círculos nos
    locais de votação (área ∝ votos), tooltip com seções.
  - Exterior: mapa-múndi coroplético por país + círculos por cidade.
  - Modo Comparar: escala divergente (crescimento × queda), centro neutro em 0.
  - Breadcrumb "Brasil › SP › Campinas" para voltar níveis.
- `ChartsPanel` (ECharts):
  - Barras divergentes: 15 maiores ganhos e 15 maiores perdas (no nível corrente).
  - Dispersão 2022 × 2026 por município (ou cidade no exterior), diagonal de referência.
  - Barras agrupadas por UF (ou por país no escopo Exterior).
- `DataTable` — busca, ordenação, exportar CSV do recorte atual.
- `Notes` — metodologia e limites (abaixo).

Dados carregados sob demanda com `fetch` + cache em memória; `locais/{UF}.json` só ao entrar na UF.

### 4. Identidade visual

- Logo: `public/brand/up-logo.svg` e `up-wordmark.svg` (Wikimedia Commons, domínio público),
  arte monocromática usada em branco sobre faixa vermelha no cabeçalho.
- Cor principal: vermelho UP (definir tom a partir de material oficial; provisório `#D7191C`),
  com neutros quentes; tipografia sans de alto contraste (ex.: Inter/“Space Grotesk” via `next/font`).
- Escalas: sequencial em tons de vermelho para votos; divergente vermelho (cresceu) ↔ cinza-azulado
  (caiu) no modo Comparar. Paletas validadas para daltonismo e contraste; tema claro e escuro.
- Layout responsivo: em telas estreitas, mapa no topo, filtros em barra fixa inferior,
  gráficos empilhados.
- Microinterações discretas (transição de cor no mapa ao trocar filtros, tooltips) — sem animações
  que atrasem a leitura.

### 5. Metodologia e limites (exibidos no site)

- O TSE renumera/agrega seções entre eleições: a comparação ano a ano é feita por
  **local de votação** (casado por município + zona + número do local, com fallback por nome
  normalizado) e por município; no nível de seção, cada ano é exibido separadamente.
- Locais sem par no outro ano aparecem como "novo"/"extinto", sem delta.
- Cargos em que a UP não teve candidatura numa UF/ano aparecem como "sem candidatura".
- Dados de 2026 refletem a publicação do TSE na data de geração indicada em `meta.json`.

## Tratamento de erros

- ETL: falha explícita em download incompleto, coluna ausente ou divergência na validação;
  registra linhas sem geolocalização em `.cache/report.json` (o site as conta, mas não plota).
- Site: estados de carregamento e de erro por painel; mensagem quando um recorte não tem dados.

## Testes

- Vitest: `parse` e `aggregate` com CSVs de fixture (incluindo linhas de exterior, legenda,
  brancos/nulos, latin1); casamento de locais entre anos; cálculo de deltas.
- `validate.ts` contra os relatórios oficiais como teste de integração do ETL.
- Verificação manual no navegador (desktop e mobile) dos fluxos: drill-down Brasil, escopo
  Exterior, modo Comparar, link compartilhável.

## Deploy

Vercel, projeto estático (Next.js export). JSONs gerados versionados no git; cada arquivo
mantido abaixo de ~2 MB (divisão por UF). Atualização: `npm run etl` → commit → deploy.
