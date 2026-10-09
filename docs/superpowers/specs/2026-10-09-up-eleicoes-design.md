# Hotsite "UP nas urnas" (2020–2026) — Design

Data: 2026-10-09
Status: aprovado; ampliado em 2026-10-09 com eleições municipais 2020/2024 e linha do tempo

## Objetivo

Hotsite estático no Vercel que mostra, em mapa e gráficos, os votos recebidos pela
Unidade Popular (UP, número 80) nas eleições de 2020, 2022, 2024 e 2026, permitindo ver onde a
votação cresceu e onde diminuiu — no Brasil (UF, município, local de votação/seção) e no
exterior (país, cidade, seção), com filtro exclusivo para dados internacionais.

## Escopo

- Eleições (1º turno em todas):
  - **Gerais:** 2022 e 2026 (dados de 2026 publicados pelo TSE em 2026-10-06).
  - **Municipais:** 2020 e 2024. Entram numa **fase posterior** (Fase 5 do plano), mas o modelo de
    dados, o ETL e a interface já nascem genéricos para elas.
  - A UP não disputa 2º turno. Se houver retotalização, basta reexecutar o ETL.
- Cargos por tipo de eleição:
  - Geral: Presidente (`80`), Governador (`80`), Senador (`80x`), Dep. Federal (`80xx` + legenda `80`),
    Dep. Estadual/Distrital (`80xxx` + legenda `80`).
  - Municipal: Prefeito (`80`), Vereador (`80xxx` + legenda `80`).
  - Exterior só existe para Presidente (regra eleitoral). Nos demais cargos, o escopo
    "Só Exterior" mostra um aviso em vez de mapa vazio.
- **Unidade de candidatura:** Presidente = Brasil; Governador/Senador/Deputados = UF;
  Prefeito/Vereador = município. Fora das unidades onde a UP disputou, o site mostra
  "sem candidatura" (≠ 0 votos), e os votos válidos dessas unidades não entram no %.
- Métricas: votos absolutos e % dos votos válidos da unidade.
- Escopos: Tudo / Só Brasil / Só Exterior.
- Fora de escopo: outros partidos, dados em tempo real, contas/login.

## Comparações

A comparação é sempre entre dois pares **(eleição, cargo)**: o "atual" e o "de referência".

| Tipo | Quando | O que mostra |
|---|---|---|
| **Correspondente** | mesmo cargo (logo, mesmo tipo de eleição): 2022×2026, 2020×2024 | votos e %, níveis UF → município → local/seção, exterior (Presidente) |
| **Não correspondente** | cargos diferentes ou tipos diferentes (ex.: Vereador 2024 × Dep. Federal 2026) | **somente votos absolutos**; níveis UF e município; sem locais e sem exterior |

- Padrão ao escolher um ano de referência do outro tipo: o cargo proporcional equivalente
  (Vereador ↔ Dep. Federal). O usuário pode trocar o cargo de referência.
- O site explica, ao lado do seletor, que a comparação não correspondente é só por volume de votos.

## Tela "Linha do tempo" (comparação global)

Segunda tela (aba ao lado de "Mapa"), com os votos totais da UP em cada eleição:
- Gráfico de colunas por eleição (2020, 2022, 2024, 2026), uma série por cargo, com cores por cargo.
  O cargo proporcional de cada eleição (Vereador/Dep. Federal) vem destacado como "força do partido".
- Cartões por eleição: total do cargo proporcional, nº de UFs/municípios com candidatura e com voto,
  e candidatos majoritários.
- Tabela eleição × cargo (votos, UFs/municípios com candidatura), com download em CSV.
- Escopo Brasil/Exterior também se aplica (no exterior, só Presidente 2022/2026).
- Fonte dos números: `meta.json` (totais gerados pelo ETL), sem carregar arquivos pesados.

## Fonte de dados

Portal de Dados Abertos do TSE (CDN `cdn.tse.jus.br/estatistica/sead/odsele/`):

| Arquivo | Uso |
|---|---|
| `votacao_secao/votacao_secao_{ano}_BR.zip` | **Presidente**, Brasil + exterior (`SG_UF=ZZ`); 2022 traz 1º e 2º turno |
| `votacao_secao/votacao_secao_{ano}_{UF}.zip` (27 UFs) | Governador (3), Senador (5), Dep. Federal (6), Dep. Estadual (7) / Distrital (8) |
| `eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip` | lat/long e nome dos locais (2022: um CSV; 2026: um CSV por UF + `ZZ`) |
| `relatorio_resultado_totalizacao/Relatorio_Resultado_Totalizacao_{ano}_{UF}.zip` | conferência dos totais |

Fatos verificados nos arquivos (2026-10-09):
- CSV `latin1`, `;`, texto entre aspas e números sem aspas. Colunas usadas: `NR_TURNO`, `SG_UF`,
  `CD_MUNICIPIO`, `NM_MUNICIPIO`, `NR_ZONA`, `NR_SECAO`, `CD_CARGO`, `DS_CARGO`, `NR_VOTAVEL`,
  `NM_VOTAVEL`, `QT_VOTOS`, `NR_LOCAL_VOTACAO`, `NM_LOCAL_VOTACAO`.
- Apenas o 1º turno é usado (`NR_TURNO = 1`).
- Brancos = `95`, nulos = `96`; votos de legenda aparecem com o número do partido (2 dígitos).
  Votos válidos = todos os votáveis exceto 95/96.
- Presidente UP (1º turno): 53.519 votos em 2022 (319 no exterior, 63 cidades);
  122.911 em 2026 (1.053 no exterior, 78 cidades). Nome do candidato vem de `NM_VOTAVEL`.
- `votacao_secao_{ano}_ZZ.zip` vem vazio / inexistente — o exterior está só no arquivo `BR`.
- Locais de votação: lat/long com vírgula decimal; `-1` quando ausente. **No exterior, todas as
  coordenadas são `-1`**, e não há coluna de país.

Complementos versionados no repositório (`data/ref/`):
- `municipios_tse_ibge.csv` — correspondência TSE → IBGE (fonte: github.com/betafcc/Municipios-Brasileiros-TSE).
- Malhas: municípios e UFs do IBGE (API de malhas v3, qualidade mínima) convertidas para
  TopoJSON; países do pacote `world-atlas` (countries-50m).
- `exterior_cidades.json` — cidade do exterior (código TSE) → país (ISO-3166 numérico/alfa-3,
  nome em português) + lat/long da cidade. Gerado uma vez com geocodificação (Nominatim,
  1 req/s) e revisado manualmente.
- Locais no Brasil sem coordenada usam o centroide do município (marcados como aproximados).

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
  meta.json                          # eleições, cargos disponíveis, totais por eleição×cargo (linha do tempo), data
  {ano}/{cargo}.json                 # UFs, municípios e exterior (só unidades com candidatura) + candidatos
  {ano}/locais/{UF}.json             # nome e lat/lon dos locais (independente do cargo)
  {ano}/{cargo}/locais/{UF}.json     # votos por local + seções com voto
```

Deltas e casamento de locais entre anos são calculados no cliente, por funções puras testadas.
"Sem candidatura" = unidade ausente do arquivo (≠ unidade presente com 0 votos).

### 3. Site (Next.js App Router, `output: 'export'`, TypeScript, Tailwind)

Página única com duas abas (**Mapa** e **Linha do tempo**) e estado dos filtros na URL
(`?ano=2026&cargo=depfed&ref=2024&refCargo=vereador&uf=SP`), para links compartilháveis.

Componentes:
- `Header` — logo da UP, título, nota da fonte.
- `FilterBar` (fixa ao rolar):
  - Eleição (2020 / 2022 / 2024 / 2026) e Cargo (opções do tipo da eleição).
  - "Comparar com": nenhuma ou outra eleição. Se for de outro tipo, aparece o seletor de cargo de
    referência, com o equivalente proporcional como padrão.
  - Métrica (Votos / % válidos; % desativado em comparação não correspondente).
  - Escopo (Tudo / Só Brasil / Só Exterior; Exterior só com Presidente).
  - Controles segmentados, não dropdowns, quando houver ≤ 4 opções.
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
- `JoinCta` — botão de chamada **"Votei na UP e quero me organizar!"** → 
  `https://unidadepopular.org.br/filie-se` (nova aba, `rel="noopener"`). Aparece no hero
  (bloco amarelo `#FFC107`, texto preto), ao final da página e como botão compacto fixo
  no cabeçalho ao rolar (no mobile, ao lado da barra de filtros).

Dados carregados sob demanda com `fetch` + cache em memória; `locais/{UF}.json` só ao entrar na UF.

### 4. Identidade visual

Referências: guia de marca do partido (`brand/PARTIDO.png`) e Manual de Identidade UP no
Canva (DAHLFRC4sIE; exportação bloqueada, miniaturas de referência em `brand/canva-*.png`).

- Logo: mesmo desenho da pág. 2 do manual (UP + três punhos), em vetor do Wikimedia Commons
  (domínio público): `public/brand/up-logo-black.svg`, `up-logo-white.svg` e `up-logo-mono.svg`
  (`currentColor`, para uso inline). Preta sobre fundos claros, branca sobre escuros.
- Acento de campanha 2026 (manual, pág. 3 — "Léo Péricles 80"): amarelo `#FFC107`, sempre como
  bloco de fundo com texto preto (nunca texto amarelo sobre branco). Usado no hero, no número
  "80" e nos KPIs.
- Cores principais (UI): `#000000`, `#242424`, `#FFFFFF`, `#E8E8E8`. Fundo-assinatura
  cinza quente `#CCC5BC` usado no hero e em faixas de seção; superfícies de leitura em branco/`#E8E8E8`.
- Cores secundárias (dados e destaques): verde-escuro `#2B3B2B`, creme `#EAD8BF`, laranja-queimado
  `#C66F2F`, vermelho `#D64444`, roxo `#545288`, mostarda `#DDCB6E`, laranja-claro `#F4AA34`,
  laranja `#F4900C`.
- Mapeamento nos gráficos:
  - Anos: 2022 = roxo `#545288`, 2026 = laranja `#F4900C`.
  - Sequencial (votos / %): creme `#EAD8BF` → `#F4AA34` → `#C66F2F` → `#2B3B2B`.
  - Divergente (Comparar): cresceu = laranja-queimado `#C66F2F`, caiu = roxo `#545288`,
    neutro = creme `#EAD8BF` (par laranja × roxo seguro para daltonismo).
  - Vermelho `#D64444` reservado a avisos/realces pontuais, não a escalas.
  - Paletas conferidas para contraste em fundo claro e escuro; tema escuro usa `#242424`/`#000000`.
- Tipografia (Google Fonts via `next/font`, aproximando o material do Canva — o manual usa
  grotesca condensada em negrito/itálico como primária e sans leve como secundária): títulos em
  Barlow Condensed (700–800, itálico em destaques como "80"), textos e números em Barlow
  (300–500, números tabulares).
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
