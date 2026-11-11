# Histórico de avisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fogosapi regista um log de eventos dos avisos IPMA (emitido/agravado/desagravado/prolongado/encurtado/texto_alterado/retirado/terminado) e expõe-no; o avisos.pt mostra-o em `/historico`.

**Architecture:** O reconcile de `HandleWeatherWarnings::sync()` passa a emparelhar por sobreposição de janelas dentro de `(district, type)` e devolve um diff; um `WeatherWarningEventRecorder` converte o diff em `WeatherWarningEvent`s. `GET /v2/warnings/ipma/history` lê-os. No avisos.pt, um proxy Pages Function + página React lazy.

**Tech Stack:** Laravel 12 + mongodb/laravel-mongodb + PHPUnit (fogosapi); React 18 + Vite + Tailwind + CF Pages Functions, `node --test` para utils (avisos.pt).

**Spec:** `docs/superpowers/specs/2026-11-11-historico-avisos-design.md` (avisos.pt)

## Global Constraints

- fogosapi: trabalhar num **worktree a partir de `origin/main`** (o checkout principal está em `feat/madeira-events` com alterações por commitar de outra sessão — não tocar). Branch `feat/historico-avisos`.
- avisos.pt: branch `feat/historico` a partir de `origin/main`. Tabs, sem ponto e vírgula. `bg-surface`, nunca `bg-white`.
- Um issue por repo (GitHub, `gh issue create`), PR com `Closes #n` e instruções de deploy; commits `feat(scope): … (#n)`.
- Datas na API: `Y-m-d\TH:i:s`, hora de Lisboa, sem timezone (como `/v2/warnings/ipma`).
- `kind` ∈ `emitido agravado desagravado prolongado encurtado texto_alterado retirado terminado`.
- Margem de fim: desaparecer do feed com `endTime - now <= 30 min` → `terminado`, não `retirado`.
- API: default últimos 7 dias, máximo 31 dias (→ 422), default exclui `texto_alterado`.
- **Invariantes do `/v2/warnings/ipma`: nunca duas entradas sobrepostas do mesmo `(district, type)`; nunca `endTime < now`.** No avisos.pt também nunca se mostra um aviso com `endTime < now`.
- Republicação que só mexe em `startTime`/`reportDate` → zero eventos. Sync que sai cedo (feed vazio, `isStale`) → zero eventos.

## Review Focus

1. **Linhas duplicadas já em produção** (algoritmo antigo): duas linhas ativas sobrepostas do mesmo `(district,type,level)` → no primeiro sync uma emparelha e a outra é *superseded* **sem evento** (é duplicado, não retirada). Teste em Task 1.
2. **Janelas encostadas** (amarelo 07–09, laranja 09–18): sobreposição é estrita (`a.start < b.end && b.start < a.end`); encostadas não emparelham. Teste em Task 1 (o teste existente `separate_windows_of_the_same_level_are_kept` cobre-o; manter).
3. **Cache do edge/browser serve um aviso já expirado** (até 5 min de cache + página aberta horas): filtro `endTime >= now` no cliente, recalculado com `useNow`. Teste em Task 5.
4. **Mudança de nível parcial** (amarelo 06–24 → amarelo 06–12 + laranja 12–18 + amarelo 18–24): um `agravado` + `encurtado` + `emitido`, nenhum `retirado`. Teste em Task 2.
5. **Gravação de evento falha** (Mongo erro): o sync continua e os avisos ficam corretos. Teste em Task 2.

---

## Part 1 — fogosapi

### Task 1: Reconcile por sobreposição + invariantes de leitura

**Files:**
- Modify: `app/Jobs/HandleWeatherWarnings.php` (`sync()` e helpers)
- Create: `app/Support/WeatherWarningDiff.php`
- Modify: `app/Support/WeatherWarningCollapse.php`
- Test: `tests/Feature/Jobs/HandleWeatherWarningsTest.php`, `tests/Unit/Support/WeatherWarningCollapseTest.php`

**Interfaces:**
- Produces: `sync(?array $items): ?WeatherWarningDiff` (null quando sai cedo). `WeatherWarningDiff` (readonly, público):
  - `array $created` — `WeatherWarning[]` novas sem par;
  - `array $levelChanges` — `[['old' => WeatherWarning (superseded), 'new' => WeatherWarning (criada)]]`;
  - `array $updated` — `[['warning' => WeatherWarning, 'previousEndTime' => ?Carbon, 'previousText' => ?string]]` (só entradas onde `endTime` ou `text` mudou);
  - `array $removed` — `WeatherWarning[]` superseded sem par e sem serem duplicados;
  - `string $reportDate` — max `reportDate` do snapshot.

Algoritmo por grupo `(district, type)`, depois de filtrar expirados/green como hoje:
1. Pares **mesmo nível**: emparelhar janelas recebidas com linhas ativas do mesmo nível pela maior sobreposição (greedy, sobreposição estrita). Par → atualizar no sítio (manter `isOlder` skip).
2. Linhas ativas por emparelhar que se sobrepõem a uma linha **mantida** do mesmo nível → `supersededAt`, sem entrar no diff (duplicados).
3. Restantes: emparelhar recebidas × linhas de **nível diferente** pela maior sobreposição → linha antiga `supersededAt`, linha nova criada → `levelChanges`.
4. Recebidas sem par → criadas (`created`). Linhas sem par → `supersededAt` (`removed`).

- [ ] **Step 1: Testes falhados** em `HandleWeatherWarningsTest`:
  - `a_second_earlier_window_of_the_same_level_does_not_shift_rows`: sync `[orange LSB Precipitação 2026-11-11T05–18]`, depois `[orange 2026-11-10T09–12, orange 2026-11-11T05–18]` → a linha original mantém `_id` e janela 11T05–18; 2 linhas ativas; `diff->created` tem 1 (a de 10T09).
  - `duplicate_active_rows_are_retired_silently`: criar à mão 2 `WeatherWarning` ativas STB/Vento/yellow 10T09–18; sync com 1 janela igual → 1 ativa, `diff->removed === []`.
  - `the_ipma_endpoint_never_serves_overlapping_windows_of_the_same_type`: criar à mão STB/Vento yellow 09–18 (report 07:00) e orange 12–21 (report 08:00) ativas → `/v2/warnings/ipma` devolve 1 entrada, a orange.
  - `the_ipma_endpoint_never_serves_expired_warnings`: linha com `endTime` = now − 1 min → ausente.
  - Em `WeatherWarningCollapseTest`: `overlapping_windows_of_the_same_type_collapse_to_the_newest_report` (empate de `reportDate` → nível mais alto).
- [ ] **Step 2:** `./vendor/bin/phpunit tests/Feature/Jobs/HandleWeatherWarningsTest.php tests/Unit/Support/WeatherWarningCollapseTest.php` → FAIL nos novos.
- [ ] **Step 3:** Implementar o algoritmo acima; `WeatherWarningCollapse::collapse()` passa a colapsar também janelas sobrepostas do mesmo `(district,type)` (vence `reportDate` maior, empate → `LEVELS` red > orange > yellow).
- [ ] **Step 4:** Correr **toda** a suite (`./vendor/bin/phpunit`) → PASS, incluindo os 7 testes existentes do sync (STB Telegram 1× no republish).
- [ ] **Step 5:** Commit `fix(warnings): emparelhar avisos por sobreposição e nunca servir sobrepostos (#n)`.

### Task 2: Registo de eventos

**Files:**
- Create: `app/Models/WeatherWarningEvent.php`, `app/Support/WeatherWarningEventRecorder.php`, `database/migrations/2026_11_11_150000_create_weather_warning_events_indexes.php` (padrão dos outros `*_indexes.php`)
- Modify: `app/Jobs/HandleWeatherWarnings.php` (`handle()`/fim do `sync()` chama o recorder), `app/Models/WeatherWarning.php` (cast `endedAt`)
- Test: `tests/Feature/Jobs/WeatherWarningEventsTest.php`

**Interfaces:**
- Consumes: `WeatherWarningDiff` (Task 1).
- Produces: `WeatherWarningEvent` (coleção `weather_warning_events`, campos da tabela do spec: `kind, district, type, fromLevel, toLevel, startTime, endTime, previousEndTime, text, previousText, reportDate, detectedAt, occurredAt, warningId, previousWarningId`; casts datetime para os tempos). `WeatherWarningEventRecorder::record(WeatherWarningDiff $diff, Carbon $now): void` e `::recordEnded(Carbon $now): void`.

Regras: `levelChanges` → `agravado`/`desagravado` (prioridade yellow<orange<red; se `endTime` mudou, preencher `previousEndTime`). `created` → `emitido`. `updated`: `endTime` maior → `prolongado`, menor → `encurtado`; `text` mudou → `texto_alterado` (eventos separados). `removed`: `endTime - now <= 30 min` → `terminado` (`occurredAt = endTime`) + `endedAt` na linha; senão `retirado`. `recordEnded`: linhas `supersededAt` null, `endedAt` null, `endTime < now` → `terminado` + `endedAt`. `occurredAt = reportDate` do diff (`terminado`: `endTime`). Cada gravação em try/catch → `Log::warning` + `report($e)`, continua. `recordEnded` corre só nos syncs que não saem cedo.

- [ ] **Step 1: Testes falhados**, um por regra, usando o helper `item()` copiado do teste existente e `Carbon::setTestNow('2026-11-10T08:00:00')`:
  - `first_sight_is_emitido`; `level_up_is_one_agravado_event` (yellow→orange no mesmo intervalo: exatamente 1 evento, `fromLevel=yellow`, `toLevel=orange`, nenhum `emitido`/`retirado`); `level_down_is_desagravado`;
  - `republish_moving_start_only_records_nothing` (start 09:00→10:12, mesmo end/text → 0 eventos);
  - `extended_end_is_prolongado` (com `previousEndTime`), `shortened_end_is_encurtado`, `text_change_is_texto_alterado` (com `previousText`);
  - `partial_upgrade` (yellow 10T09–11T00 → yellow 09–12 + orange 12–18 + yellow 18–11T00): kinds = `{agravado, encurtado, emitido}`, sem `retirado`;
  - `dropped_early_is_retirado`; `dropped_within_30_minutes_of_end_is_terminado` (end 08:25, now 08:00);
  - `expired_row_gets_one_terminado` (sync duas vezes depois do fim → 1 evento, `occurredAt == endTime`);
  - `stale_or_empty_feed_records_nothing`;
  - `a_failing_event_write_does_not_break_the_sync` (recorder mock lança → avisos atualizados).
- [ ] **Step 2:** `./vendor/bin/phpunit tests/Feature/Jobs/WeatherWarningEventsTest.php` → FAIL.
- [ ] **Step 3:** Implementar model, recorder, migration (índices `occurredAt` desc e `(district, occurredAt)`), ligar no job.
- [ ] **Step 4:** Suite completa → PASS.
- [ ] **Step 5:** Commit `feat(warnings): registar eventos dos avisos IPMA (#n)`.

### Task 3: Endpoint `GET /v2/warnings/ipma/history` + docs

**Files:**
- Modify: `routes/web.php` (grupo `warnings`: `Route::get('ipma/history', …@history)`), `app/Http/Controllers/WarningsController.php`
- Modify: `docs/api.yaml` (+ path), `CLAUDE.md` (secção do `HandleWeatherWarnings` + endpoint)
- Test: `tests/Feature/Controllers/WarningsHistoryTest.php`

**Interfaces:**
- Produces (contrato para Task 4): `GET /v2/warnings/ipma/history?from=&to=&area=&type=&kind=` → `200` array desc por `occurredAt` de `{ id, kind, area, type, fromLevel, toLevel, startTime, endTime, previousEndTime, text, previousText, reportDate, occurredAt }` (strings `Y-m-d\TH:i:s` ou null). `area`/`type`/`kind` CSV. `422 {"error":"range_too_large"}` se > 31 dias; `422 {"error":"invalid_date"}` se não parseável.

- [ ] **Step 1: Testes falhados:** `defaults_to_last_7_days_without_texto_alterado`; `filters_by_area_type_and_kind_csv`; `kind_texto_alterado_is_returned_when_asked`; `rejects_ranges_over_31_days` (422); `rejects_invalid_dates` (422); `dates_are_lisbon_wall_clock_without_timezone`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar `history(Request $request): JsonResponse`.
- [ ] **Step 4:** Suite completa + `./vendor/bin/php-cs-fixer fix --dry-run --diff` nos ficheiros tocados → PASS/limpo.
- [ ] **Step 5:** Commit `feat(warnings): endpoint de histórico de avisos (#n)`; push; PR com deploy (git pull, `php artisan migrate --force`, `USR2`, `queue:restart`).

## Part 2 — avisos.pt

### Task 4: Utils do histórico + proxy (com testes `node --test`)

**Files:**
- Create: `src/utils/history.js`, `src/utils/history.test.js`, `functions/api/warnings/history.js`
- Modify: `package.json` (`"test": "node --test src/utils/"`)

**Interfaces:**
- Consumes: contrato da Task 3.
- Produces:
  - `HISTORY_KINDS` — `{ emitido: {label:'emitido'}, agravado, desagravado, prolongado, encurtado, retirado, terminado }` (sem `texto_alterado`; ordem = ordem de exibição dos filtros).
  - `HISTORY_PERIODS` — `[{ id:'24h', hours:24 }, { id:'3d', hours:72 }, { id:'7d', hours:168 }, { id:'30d', hours:720 }]`, default `'7d'`.
  - `historyQuery(searchParams, now: Date) → { from: string, to: string, area: string[], type: string[], kind: string[] }` — traduz `?regiao=<slug>&tipo=<slug>&evento=a,b&periodo=7d&de=AAAA-MM-DD&ate=AAAA-MM-DD` (de/ate ganham a periodo; slugs desconhecidos ignorados; intervalo cortado a 31 dias) para parâmetros da API.
  - `groupEventsByDay(events) → [{ day: 'AAAA-MM-DD' (local do visitante), events }]`, desc, usando `parseWarningTime(occurredAt)`.
  - Proxy: `onRequestGet({ env, request })` → `proxyFogos({ path: '/v2/warnings/ipma/history?' + só from,to,area,type,kind, cacheSeconds: 300, label: 'history' })`.

- [ ] **Step 1: Testes falhados** em `history.test.js`: `historyQuery` default (7 dias até now, arrays vazios), `regiao=lisboa` → `area:['LSB']`, slug desconhecido ignorado, `evento=agravado,xpto` → `['agravado']`, `de/ate` > 31 dias cortado; `groupEventsByDay` agrupa e ordena desc.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar utils + proxy (confirmar se `proxyFogos` aceita query no `path`; se não, acrescentar-lhe um `search` opcional).
- [ ] **Step 4:** `npm test && npm run lint` → PASS.
- [ ] **Step 5:** Commit `feat(historico): utils e proxy do histórico de avisos (#n)`.

### Task 5: Nunca mostrar avisos expirados

**Files:**
- Modify: `src/utils/share.js` (ou `format.js`) + `src/hooks/useWarningsData.js` + `functions/_warnings.js` (`getWarnings`)
- Test: `src/utils/active.test.js`

**Interfaces:**
- Produces: `activeWarnings(list, nowMs) → list` filtrando `parseWarningTime(endTime) >= nowMs`, DOM-free (importável pelas functions).

- [ ] **Step 1:** Teste falhado: aviso com fim 1 min antes de `now` excluído; fim 1 min depois incluído; lista não-array → `[]`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar; `useWarningsData` devolve `activeWarnings(warnings, now)` recalculado com `useNow` (mantém `null` enquanto carrega); middleware/OG usam-no a partir de `getWarnings`.
- [ ] **Step 4:** `npm test && npm run lint && npm run build` → PASS.
- [ ] **Step 5:** Commit `fix(avisos): nunca mostrar avisos já terminados (#n)`.

### Task 6: Página `/historico` + navegação + SEO + docs

**Files:**
- Create: `src/pages/historico.jsx`, `src/components/history/HistoryEvent.jsx`, `src/components/history/HistoryFilters.jsx`
- Modify: `src/main.jsx` (rota lazy), `src/components/layout/Nav.jsx` (`{ to: '/historico', label: 'Histórico' }` depois de Cronologia), `src/utils/share.js` (`PAGE_META['/historico']`), `public/sitemap.xml`, `src/pages/distrito.jsx` (link "Ver histórico" → `/historico?regiao=<slug>`), `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: `historyQuery`, `groupEventsByDay`, `HISTORY_KINDS`, `HISTORY_PERIODS` (Task 4); `<TypeIcon>`, `LEVELS`, `formatWhen`, `districtPath`, `usePageTitle`.

`PAGE_META['/historico']`: title `Histórico de avisos meteorológicos — agravamentos e desagravamentos`, description `Cronologia das alterações aos avisos do IPMA em Portugal: avisos emitidos, agravados, desagravados, prolongados, retirados e terminados, por região e tipo.`

Linha: `HH:MM · <Região (link)> · <TypeIcon> Tipo · <chip from> → <chip to> · <kind>`; `prolongado`/`encurtado` mostram `fim antigo → fim novo`; `emitido` mostra a janela. Estados: loading, vazio ("Ainda não há alterações registadas neste período — o histórico começou a ser registado a 2026-11-11."), erro/404 ("O histórico ainda não está disponível."), com `StateLoading`/`StateError`.

- [ ] **Step 1:** Implementar página, filtros (atualizam o URL via `useSearchParams`), link no distrito, nav, meta, sitemap.
- [ ] **Step 2:** `npm run lint && npm run build` → PASS.
- [ ] **Step 3:** Verificar em `npm run dev:cf` com `FOGOS_API_BASE` a apontar para um mock local com eventos de exemplo: `/historico`, `?regiao=lisboa&evento=agravado`, dark mode, largura 375 px; `curl -s localhost:8788/historico | grep '<title>'` mostra o título novo.
- [ ] **Step 4:** Atualizar `CLAUDE.md` (views, functions, data shape do histórico) e README.
- [ ] **Step 5:** Commit `feat(historico): página de histórico de avisos (#n)`; push; PR com deploy (merge → CF Pages; depende do deploy do fogosapi para ter dados).
