# Suite de testes completa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lint de `.js/.jsx`, unitários, componentes, functions e E2E do avisos.pt a correr na CI do GitHub em cada PR/push para `main`.

**Architecture:** Vitest (projetos `node` e `jsdom`) para unitários/componentes/proxies; Playwright (Chromium) contra `wrangler pages dev dist` + FogosPT falso para E2E (rotas, `<head>`, 404, OG, escuro, telemóvel); um workflow `test.yml`.

**Tech Stack:** Vitest 2 + @vitest/coverage-v8, @testing-library/react/user-event/jest-dom, jsdom, @playwright/test, ESLint 8, GitHub Actions (Node 20).

**Spec:** `docs/superpowers/specs/2026-11-11-suite-testes-design.md` (inclui "Decisões depois da revisão do desenho")

## Global Constraints

- Branch `test/suite-completa`, issue #34; commits `test(scope): … (#34)` / `fix(scope): … (#34)`. Tabs, sem ponto e vírgula.
- Nunca a API real do FogosPT; única chamada externa permitida: jsDelivr nos testes OG (`retries: 2`).
- `TZ=Europe/Lisbon` em todos os testes; tempo fixo (`vi.setSystemTime`) nos unitários/componentes que dependam do relógio.
- E2E não depende do dia/hora; sem `page.clock`.
- Bug claro revelado → teste que falha + correção. Bug discutível → `it.fails`/`test.fail` com comentário, listado no PR.
- Lint `--max-warnings 0`; `eslint-disable-next-line` só com motivo.
- Não alterar comportamento do site fora de bugs.

## Review Focus

1. **Testes flaky por hora real** (meia-noite, DST): qualquer teste que leia `Date.now()` sem tempo fixo → falha a uma hora do dia. Verificar em todas as tasks; Task 2 inclui `parseWarningTime` nos dois dias de mudança de hora.
2. **Cache da Cache API no wrangler local** a misturar cenários do E2E: cenários de erro/vazio só via `page.route` (Task 5).
3. **Slugs são contrato de URL**: lista fixa dos 25 slugs no teste (Task 2) — renomear um tem de partir a CI.
4. **CI verde localmente mas não no Actions** (browsers não instalados, porta ocupada, `wrangler` a pedir login/telemetria): `WRANGLER_SEND_METRICS=false`, `npx playwright install --with-deps chromium`, portas fixas 8788/8799 (Task 6).
5. **Página que rebenta com dados estranhos** (`-99`, `null`, campos em falta, tipo de aviso desconhecido, área desconhecida): testes de componentes com fixture "estranha" (Task 4).

---

### Task 1: Ferramentas + lint de `.jsx`

**Files:** `package.json`, `vitest.config.js`, `tests/setup.js`, `.eslintrc.cjs`, `src/utils/{history,active}.test.js` (→ Vitest), fixes dos 3 erros de lint (`functions/_middleware.js` global `HTMLRewriter`, `TimelineGrid.jsx` import não usado, `estacoes.jsx` `error` não usado).

**Produces:** scripts `lint` (`eslint --ext .js,.jsx,.mjs src functions scripts tests e2e --max-warnings 0`), `test` = `test:unit` (`vitest run`), `test:watch`, `test:e2e` (`playwright test`), `test:all` (lint + unit + build + e2e). Vitest: `environment: 'node'` por omissão, `environmentMatchGlobs` → `jsdom` para `**/*.test.jsx`; `setupFiles: tests/setup.js` (jest-dom, cleanup, `matchMedia`/`ResizeObserver` stubs); `process.env.TZ = 'Europe/Lisbon'` em `vitest.config.js` (antes de tudo); include `src/**/*.test.{js,jsx}`, `functions/**/*.test.js`, `tests/**/*.test.{js,jsx}`; coverage v8 (reporter text-summary + html).

- [ ] Instalar devDeps; migrar os 2 ficheiros (`node:test` → `vitest`), `npm test` → 12 PASS.
- [ ] `npm run lint` → mostra os 3 erros (RED). `estacoes.jsx`: investigar se o erro devia ser mostrado — se a página fica em branco/spinner eterno com a API em erro, é bug: teste de página (Task 4) primeiro, correção aí; aqui só o lint (usar o `error`).
- [ ] Corrigir → `npm run lint` limpo; `npm run build` OK.
- [ ] Commit `test(tooling): Vitest, lint de .jsx e scripts de teste (#34)`.

### Task 2: Unitários de `src/utils` e `src/data`

**Files:** `src/utils/*.test.js`, `src/data/*.test.js`, `functions/_fogos.test.js`.

Casos obrigatórios (nomes livres):
- `format`: `parseWarningTime('2026-03-29T01:30:00')` (salto) e `'2026-10-25T01:30:00'` (recuo) dão instantes consistentes; string com `Z`/offset respeitada; não-string → NaN. `isValid(-99) === false`, `isValid(NaN) === false`. `windDir` 0–9 + fora do intervalo. `formatPrecip(0.0) === '0 mm'`. `relativeMinutes` limites.
- `share`: `warningSlug` = `vento-20261111-1430` a partir de `startTime` sem parse; `findWarning` encontra por slug e ignora nível; `districtSeo`/`warningSeo` com e sem avisos; `formatLisbon` igual em qualquer TZ (correr com `TZ` diferente via `Intl` — usar instantes fixos); `warningsVersion` estável e muda quando muda um aviso; `sortWarnings` (nível, tipo).
- `timeline`: janela 48–96 h, `worstAt` em sobreposição, `groupDays` meia-noite, `mapPeriods` (máx 5, "Agora" primeiro), `warningsInPeriod`.
- `stations`: `stationIdFromSlug('1210881-lisboa-geofisico') === '1210881'` e lixo → null; `reading(-99)`/`null` → null; `stationRows`; `stationArea` fallback; formatadores pt-PT.
- `stationMetrics`: ordem de escolha do `defaultStationMetric` (em vigor > 24 h > depois; mapping de tipos; Agitação ignorada; sem aviso → temperatura).
- `incidents`: "Viana Do Castelo" → `VCT`; natureza → ícone; desconhecidos.
- `geo`: haversine Lisboa–Porto ≈ 274 km ±2; nearest ignora estações sem obs.
- `data`: 25 códigos; **lista literal dos 25 slugs** igual a `IPMA_AREA_CODES.map(slug)`; slugs únicos; `LEVELS.*.fill` hex; `worstLevelId`; `codeForFeature` (Lisboa, Ponta Delgada → `AOC`? confirmar no ficheiro, Porto Moniz → `MCN`, Porto Santo → `MPS`); `STATION_AREAS` só códigos válidos; `typeRank`/`warningTypeMeta` desconhecido → fallback.
- `functions/_fogos.js` (fetch mockado): sem chave → 500 `missing_api_key`; fetch rejeita → 502; não-2xx → 502 `upstream_error`; JSON inválido com transform → 502; `cache-control: public, max-age=N`; envia `X-API-Key` e `User-Agent`; `FOGOS_API_BASE` respeitado.

- [ ] Escrever os testes; correr; qualquer falha = bug real → corrigir (ou `it.fails` se discutível). `npm test` verde.
- [ ] Commit `test(utils): unitários de utils, data e _fogos (#34)`.

### Task 3: Proxies `functions/api/**`

**Files:** `functions/api/**/*.test.js` (ao lado de cada handler).

Chamar `onRequestGet({ env, request })` com `fetch` mockado (`vi.stubGlobal`). Casos: `warnings` filtra expirados; `warnings/history` passa só `from,to,area,type,kind` e corta a 200 chars; `observations` devolve só a última hora `{hour, stations}`; `observations/recent` exige 1–40 ids numéricos (400 senão) e preenche horas sem leitura com `{hour}`; `stations/[id]/observations` e `daily` validam `id` e limites `hours` 1–168 / `days` 1–90 (confirmar comportamento atual: clamp ou 400 — testar o que existe; se aceitar lixo e passar ao upstream, é bug); `incidents/fma` corta campos.

- [ ] Testes → verde (bugs → corrigir com teste primeiro). Commit `test(functions): proxies da API (#34)`.

### Task 4: Componentes e páginas (jsdom)

**Files:** `tests/fixtures/data.js` (fixtures partilhadas com o mock do E2E: avisos, estações, observações, séries, histórico, incidentes; geradas relativamente a um `now` passado como argumento), `tests/helpers/render.jsx` (`renderRoute(path, { fetch })` com `MemoryRouter` + rotas reais de `main.jsx` — extrair `AppRoutes` de `main.jsx` para `src/routes.jsx` para o teste usar as mesmas rotas), `src/**/*.test.jsx`.

**Interfaces:** `makeFixtures(now: Date) → { warnings, stations, observations, observationsRaw, series(id,hours), daily(id,days), history, incidents }`; `mockFetch(routes: Record<string, any | (url)=>Response>)`.

Por página (`/`, `/cronologia`, `/historico`, `/criterios`, `/distrito/lisboa`, `/distrito/xpto`, `/distrito/lisboa/aviso/<id>` + aviso inexistente, `/estacoes`, `/estacao/<id>-x`, `/estacao/0-nada`, rota desconhecida → NotFound): render com dados normais (título + conteúdo-chave), sem avisos (estado vazio), `/api/warnings` 502 (StateError + "Tentar de novo" volta a pedir), parâmetros inválidos (`?d=XXX`, `?ordem=lixo`, `?regiao=lixo`, `?periodo=lixo`, `?dia=99`) não rebentam e caem no default. Fixture "estranha": tipo desconhecido, área desconhecida, `-99`/`null` nas observações, estação sem coordenadas — nada rebenta. Componentes com lógica: `TimelineGrid` (hover → inspector), `HistoryFilters` (cliques atualizam URL), `MapPeriodPicker`, `StationChart`/`Sparkline` (buracos), `ShareButtons` (links certos, `navigator.share` ausente), `ThemeToggle` (cicla e grava `localStorage`, sem `localStorage` não rebenta), `DistrictStations` (troca de métrica). `/mapa` só smoke (Leaflet mockado ou só estados de carregamento/erro).

- [ ] Extrair `src/routes.jsx` (sem mudar comportamento; `npm run build` OK).
- [ ] Testes por página/componente; bugs → teste falha primeiro + correção (ou `it.fails`).
- [ ] `npm test` verde; commit(s) `test(paginas): …` / `fix(…): … (#34)`.

### Task 5: E2E (Playwright)

**Files:** `tests/mock-fogos/server.mjs` (Node puro, porta 8799, serve as fixtures de `makeFixtures(startTime)` em todos os paths que as functions usam: `/v2/warnings/ipma`, `/v2/warnings/ipma/history`, `/v2/weather/stations/ipma`, `/v2/weather/observations`, `/v2/weather/stations/{id}/observations`, `/v2/weather/stations/{id}/daily`, `/v2/incidents/active`; 404 JSON no resto), `playwright.config.js` (`webServer`: mock + `wrangler pages dev dist --port 8788 --binding FOGOS_API_KEY=test --binding FOGOS_API_BASE=http://127.0.0.1:8799`; `projects`: `desktop` 1280, `mobile` 390, `dark` colorScheme dark; `trace: 'retain-on-failure'`), `e2e/*.spec.js`, script `mock:fogos`.

Specs:
- `routes.spec.js`: cada rota carrega, `h1` certo, **zero erros de consola/pageerror**, sem `document.documentElement.scrollWidth > innerWidth` (mobile/dark).
- `navigation.spec.js`: menu leva a cada página; distrito → aviso → voltar; chip do índice → distrito; filtros do histórico/estações/cronologia/critérios no URL sobrevivem a reload.
- `states.spec.js`: `page.route('**/api/warnings')` → 502 e → `[]` em `/`, `/cronologia`, `/mapa`, `/historico` (`/api/warnings/history`): mensagem certa, "Tentar de novo" funciona.
- `seo.spec.js` (`request`, sem browser): `<title>`/description/canonical/robots/`og:image` por rota estática, distrito, aviso, estação; 404 reais (`/xpto`, `/distrito/xpto`, `/estacao/0-x`, `/api/nope` JSON, `/sitemap.xlm`); estação com nome antigo → canonical atual; `robots.txt`, `sitemap.xml` (25 distritos + `/historico`), `manifest.json` válidos.
- `og.spec.js` (`retries: 2`): `/og/site.png`, `/og/distrito/lisboa.png`, `/og/estacao/<id>.png` → `image/png`, PNG 1200×630 (ler IHDR).
- `mapa.spec.js`: três mapas renderizam, polígonos coloridos, seletor de período muda `?dia=`, toggle de estações.
- `theme.spec.js`: alternar tema aplica `.dark` e persiste após reload sem flash (classe presente antes do `load`).

- [ ] `npm run build && npm run test:e2e` verde em local (todos os projetos). Bugs → teste falha + correção / `test.fail`.
- [ ] Commit `test(e2e): Playwright com FogosPT falso (#34)`.

### Task 6: CI + documentação

**Files:** `.github/workflows/test.yml`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `.gitignore` (`coverage/`, `playwright-report/`, `test-results/`).

Workflow: `on: pull_request, push: branches [main]`; `concurrency` por ref (cancela anteriores); job `test` ubuntu-latest, Node 20 `cache: npm`, `npm ci`, `npm run lint`, `npm test -- --coverage`, `npm run build`, cache `~/.cache/ms-playwright` por versão, `npx playwright install --with-deps chromium`, `npm run test:e2e` com `WRANGLER_SEND_METRICS=false CI=true`; upload `playwright-report/` e `test-results/` se falhar; timeout 15 min.

- [ ] Docs: comandos, onde ficam os testes, como acrescentar uma fixture, regra "bug → teste primeiro".
- [ ] Push do branch; workflow verde no Actions (ver logs com `gh run watch`); PR com `Closes #34`, lista de bugs encontrados/`fails`, instrução da proteção do `main`.
