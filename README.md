# UP na Guerra Eleitoral — 2020 a 2026

Hotsite estático com os votos da **Unidade Popular (UP, nº 80)** nas eleições gerais de 2022 e 2026 e nas municipais de 2020 e 2024. Mostra mapa, gráficos, tabela e linha do tempo por estado, município, local de votação e exterior. As comparações entre eleições podem ser do mesmo cargo (votos, % dos válidos, municípios e locais) ou de cargos diferentes (só votos).

Fonte: [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br) (votação por seção eleitoral), conferida com os totais oficiais por partido.

## Stack

- **Site**: Next.js 16 (App Router, `output: 'export'`, sem servidor), React 19, Tailwind CSS 4, MapLibre GL, ECharts. Os dados são JSON estáticos em `public/data/`, lidos pelo navegador.
- **ETL**: Node 24 + TypeScript (`tsx`). Lê os CSVs do TSE em streaming de dentro dos zips (`yauzl`) e grava `public/data/**`.
- **Testes**: Vitest (`tests/etl`, `tests/lib`).
- **Hospedagem**: Vercel (deploy automático a cada push).

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run build      # export estático em out/
npm start          # serve out/
```

## Atualizar os dados

Os passos abaixo só são necessários quando o TSE publica dados novos ou corrigidos.

1. **Malhas** (raro, só quando mudam os municípios/países): `npm run geo` → `public/geo/` e `data/ref/centroides.json`.
2. **Cidades do exterior** (quando aparecem cidades novas no exterior): `npm run geocode`, depois **revisar à mão** `data/ref/exterior_cidades.json` (país e coordenadas vêm do Nominatim e podem errar). Se uma cidade nova não estiver lá, o ETL para com `Cidade do exterior sem referência`.
3. **ETL**: `npm run etl -- --ano 2026` (ou `--ano all`). Regera `public/data/{ano}/` e atualiza `public/data/meta.json`. Os anos já gerados e não pedidos ficam como estão. Os estados grandes (SP, MG, RJ) levam alguns minutos. Se faltar memória, use `NODE_OPTIONS=--max-old-space-size=8192`.
4. **Validação**: `npm run validate` (todos os anos gerados) ou `npm run validate -- --ano 2026|all`. Confere, por cargo e UF, o total da UP com `votacao_partido_munzona` (ver regras abaixo). A saída deve terminar em `validação ok`.
5. **Imagem de compartilhamento** (se mudar título ou números de capa): `npm run og` → `public/og.png` (usa o Chrome headless; `CHROME=/caminho` para outro navegador).
6. `npm test && npm run build`, commit de `public/data` e push → a Vercel publica.

### Disco e rede

Os downloads ficam em `.cache/tse/` (fora do git), com uma pasta diferente se `TSE_CACHE` estiver definida. São **vários GB**: uns 12 GB com os quatro anos. Por ano são baixados:

- votação por seção, um zip por UF (SP passa de 900 MB em 2022);
- locais de votação (coordenadas);
- `votacao_partido_munzona` (validação);
- `votacao_candidato_munzona`, que é grande nas eleições gerais (~580 MB em 2022, ~455 MB em 2026) e bem menor nas municipais (~50 MB).

Um arquivo só é baixado de novo se o tamanho no servidor mudar.

## Regras de contagem

- **Votos da UP**:
  - Em Presidente, Governador, Senador e Prefeito, são os votos nominais nos candidatos da UP.
  - Em Dep. Federal, Dep. Estadual/Distrital e Vereador, somam-se os nominais (`80xx…`) e os de legenda (`80`).
- **Sub judice conta, anulado não**:
  - Votos em candidatura *sub judice* (destino “Anulado sub judice” em `votacao_candidato_munzona`) contam.
  - Votos “Anulado” não contam, nem os votos em candidaturas canceladas ou indeferidas antes da eleição, que nem aparecem na totalização. Esses votos ainda aparecem na votação por seção.
  - O voto de legenda só conta onde a UP tem ao menos um candidato válido ou sub judice no cargo e na unidade. Quando a chapa inteira é anulada (ex.: GO 2022, deputados), a legenda também é anulada e a unidade sai do mapa.
- **Válidos**: todos os votos do cargo menos brancos (`95`) e nulos (`96`), excluídos também os votos da UP anulados pela regra acima.
- **Só 1º turno.**
- **Unidade de candidatura**: Brasil para Presidente, UF para Governador, Senador e deputados, município para Prefeito e Vereador. Totais, % e mapas consideram só as unidades onde a UP teve candidatura com voto. Fora delas o site mostra “—” (sem candidatura), que é diferente de zero.
- **Validação**: por cargo e UF, `válidos oficiais ≤ nosso ≤ válidos + anulados sub judice`, com válidos = nominais + legenda de `votacao_partido_munzona`, 1º turno, só os CSVs por UF (o `_BRASIL.csv` duplicaria os totais).
