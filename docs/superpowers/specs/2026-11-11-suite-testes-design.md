# Suite de testes completa — desenho

Data: 2026-11-11 · Issue: tomahock/avisos.pt#34

## Porquê

O avisos.pt está em produção e não tem quase nenhuma rede de segurança: 12 testes `node --test` (utils
do histórico + `activeWarnings`), um `npm run lint` que **só olha para `.js`** (os `.jsx` — todas as
páginas e componentes — nunca são verificados; um import partido em `cronologia.jsx` passou o lint e
só o build o apanhou) e nenhum CI além do build de preview do Cloudflare Pages.

O utilizador quer que a suite apanhe, antes de produção:
1. **componentes partidos** — uma página/componente que rebenta ou deixa de renderizar;
2. **código com erros** — sintaxe, imports, exceções;
3. **utilização errada** — URLs com parâmetros inválidos, slugs inexistentes, API em baixo ou com
   dados estranhos;
4. **regressões** — alterações que partem o que já funcionava.

E que **tudo corra na CI do GitHub**. "Se vires que podem ser feitos mais testes, faz também."

## Objetivos

- Workflow GitHub Actions em cada PR e push para `main`: lint → unit/componentes → build → E2E.
- Lint cobre `.js` e `.jsx` (e `functions/`, `scripts/`), sem avisos ignorados.
- Testes unitários de toda a lógica pura de `src/utils`, `src/data` e helpers de `functions/`.
- Testes de componentes e páginas (render + interação) com dados falsos, incluindo estados de
  carregamento, vazio e erro.
- Testes das Pages Functions: proxies (`/api/*`), middleware (`<head>` por rota, 404 reais), OG.
- E2E num browser real contra o `dist` servido por `wrangler pages dev` e um **FogosPT falso**: todas
  as rotas, navegação, filtros no URL, modo escuro, largura de telemóvel sem scroll horizontal, sem
  erros na consola.
- Um comando local para tudo (`npm run test:all`) e comandos separados por camada.

## Não-objetivos

- Nunca chamar a API real do FogosPT nem precisar de `FOGOS_API_KEY` na CI.
- Sem testes de regressão visual por pixel (screenshots só como artefacto de falha).
- Sem browsers além do Chromium (Firefox/WebKit ficam para depois, se houver razão).
- Sem metas de cobertura numéricas obrigatórias (a cobertura é reportada, não bloqueia).
- Não mudar comportamento do site — exceto bugs reais que os testes revelem (cada um com teste que
  falha primeiro, e listado no PR).

## Anti-objetivos

- **Testes frágeis/flaky** que falham ao acaso (horas reais, rede, animações): o tempo é sempre
  fixado nos testes (fake timers / `Date` fixo / timezone `Europe/Lisbon`), e o E2E não depende de
  timing nem da hora real do dia.
- Testes que só verificam implementação (snapshots gigantes de HTML) em vez de comportamento visível.
- Uma CI lenta ao ponto de ser ignorada — objetivo: < 6 min no total.

## Ferramentas (decisão minha)

- **Vitest** (+ `@vitest/coverage-v8`) — usa a config do Vite; os 2 ficheiros `node --test` migram
  para Vitest (mesmas asserções). Ambiente `node` para utils/functions, `jsdom` para componentes.
  `TZ=Europe/Lisbon` fixado na config.
- **@testing-library/react** + `@testing-library/user-event` + `@testing-library/jest-dom`.
- **Playwright** (Chromium) para E2E, `webServer` = `wrangler pages dev dist` com
  `FOGOS_API_BASE` a apontar para o FogosPT falso e `FOGOS_API_KEY=test`.
- ESLint: `eslint --ext .js,.jsx src functions scripts tests` (ESLint 8 só lê `.js` por omissão —
  é esta a causa do buraco atual). Os erros que aparecerem são corrigidos.

## Camadas e o que cada uma cobre

### 1. Unitários (Vitest, node)
Toda a lógica pura, com os casos-limite que já custaram caro:
- `utils/format.js`: `parseWarningTime` (Lisboa, DST nos dois sentidos, strings com/sem offset),
  `formatWhen`, `isValid` (`-99`), formatadores, `windDir`, `relativeMinutes`.
- `utils/share.js`: slugs (`warningSlug`, `findWarning` — contrato de URL), `districtSeo`/`warningSeo`,
  `formatLisbon`, `warningsVersion`, `sortWarnings`, `activeWarnings`.
- `utils/timeline.js`: janela de horas (48–96 h), `worstAt`, `mapPeriods`, `warningsInPeriod`.
- `utils/stations.js`, `stationMetrics.js`, `geo.js`, `incidents.js` (acentos/maiúsculas), `history.js`.
- `data/`: integridade — 25 áreas IPMA, slugs únicos e estáveis (lista fixa no teste = contrato),
  `LEVELS` com `fill` hex, `codeForFeature` (continente/Açores/Madeira, MRM sem polígono),
  `stationAreas` aponta para códigos válidos.
- Helpers das functions sem runtime CF (`_fogos.js` com `fetch` mockado: chave em falta → 500, falha →
  502, timeout, não-2xx → 502, JSON inválido → 502, cache-control).
- `scripts/build-stations.mjs`: o que for puro (point-in-polygon).

### 2. Componentes e páginas (Vitest, jsdom)
`fetch` mockado por URL, tempo fixo. Para cada página: renderiza com dados normais, sem avisos, API em
erro (mostra `StateError` e "Tentar de novo" volta a pedir), parâmetros de URL inválidos (caem no
default, não rebentam). Componentes com lógica: `TimelineGrid`, `HistoryFilters`/`HistoryEvent`,
`MapPeriodPicker`, `StationChart`/`Sparkline` (dados com buracos/`null`/`-99`), `DistrictStations`,
`DistrictIncidents`, `ShareButtons`, `ThemeToggle`, `Nav`, `NotFound`. O mapa Leaflet fica para o E2E
(jsdom não tem layout).

### 3. Functions (Vitest + E2E)
- Proxies `functions/api/**`: chamados diretamente com `env`/`request` falsos e `fetch` mockado
  (parâmetros filtrados, limites `stations ≤ 40`, `hours`/`days` fora do intervalo, transformações).
- `_middleware.js` e `og/[[path]].js` dependem de `HTMLRewriter`/wasm do runtime Cloudflare — são
  testados **pelo E2E** via pedidos HTTP ao `wrangler pages dev` (sem browser): `<title>`,
  description, canonical, robots, `og:*`, JSON-LD por rota; 404 reais (página, `/api/nope`,
  `/distrito/xpto`, `/estacao/0-x`); canonical de estação com nome antigo; `/og/*.png` devolve
  `image/png` com 1200×630.

### 4. E2E (Playwright, Chromium)
Contra `dist` + FogosPT falso com um conjunto de dados realista (avisos de vários níveis, ilhas,
estações, observações, histórico). Por rota: carrega sem erros na consola, conteúdo-chave visível,
links principais navegam, filtros no URL funcionam e sobrevivem a reload. Estados vazio/erro via
`page.route('/api/**')` (no browser — evita a cache do edge local). Modo escuro (`colorScheme: 'dark'`)
e telemóvel (390 px): sem scroll horizontal nas páginas principais. Artefactos de falha: trace +
screenshot.

### FogosPT falso
Um servidor Node pequeno em `tests/fixtures/` (sem dependências) com fixtures JSON versionadas,
reutilizado pelo E2E e disponível em local (`npm run mock:fogos`). Datas das fixtures relativas ao
"agora" fixado do servidor (para avisos nunca expirarem durante a corrida). Atenção: as functions
usam a Cache API (5 min–1 h) — o E2E não pode depender de mudar o cenário do servidor a meio.

## CI

`.github/workflows/test.yml`, `ubuntu-latest`, Node 20, cache npm e browsers do Playwright:
`npm ci` → `npm run lint` → `npm run test:unit -- --coverage` → `npm run build` → `npm run test:e2e`.
Artefacto de relatório Playwright em falha. Correr em `pull_request` e `push` para `main`.

**Proteção do `main`** (exigir o check verde para fazer merge) é uma definição do repositório — só
com confirmação explícita do utilizador; fica como instrução no PR.

## Bugs encontrados

Bugs reais revelados pelos testes são corrigidos neste trabalho (teste falha primeiro) e listados no
PR; se uma correção mudar comportamento de forma visível ao utilizador, fica para decisão dele.

## Deixado ao builder

Organização exata dos ficheiros de teste, nomes, conteúdo das fixtures, que componentes pequenos
dispensam teste próprio por já estarem cobertos pela página, e testes extra que valham a pena
("se vires que podem ser feitos mais testes, faz também").

## Decisões depois da revisão do desenho (minhas — para rever)

- **Endpoints de série das estações (fogosapi#92) estão em produção** (`/api/stations/<id>/observations`
  e `/daily` respondem 200): o FogosPT falso serve-os e o E2E testa o caminho completo (seletor de
  intervalo + secção diária). O fallback de 24 h é testado ao nível de componente/hook, com o
  `fetch` desses endpoints a falhar.
- **Fontes das imagens OG vêm do jsDelivr em runtime**: o E2E das `/og/*.png` pode ir ao jsDelivr (a
  CI tem rede; é a única chamada externa permitida). Esses testes têm `retries: 2` próprios. Não se
  muda código de produção para isto.
- **Tempo no E2E**: o servidor (wrangler) usa a hora real; o FogosPT falso gera as datas das fixtures
  relativas ao seu arranque (avisos a começar há 2 h e a acabar daqui a 6–72 h, histórico nas últimas
  48 h). O browser **não** congela o relógio (ficaria em desacordo com o servidor). Asserções do E2E
  não dependem do dia/hora (nada de "Hoje"/linhas de meia-noite em posições fixas); o que depende do
  calendário é testado em unitários/componentes com tempo fixo.
- **Bugs cuja correção muda comportamento visível**: se for claramente um erro (rebenta, mostra dados
  errados, link partido) corrige-se com teste. Se for discutível, o teste fica como `it.fails` /
  `test.fail` com comentário a explicar e o caso é listado no PR para decisão — a CI fica verde.
- **Lint**: `--max-warnings 0`. Avisos do `react-hooks/exhaustive-deps` corrigem-se quando é seguro;
  quando acrescentar a dependência mudaria o comportamento (refetch em loop, etc.), fica um
  `eslint-disable-next-line` com o motivo na mesma linha.
