# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React 18 SPA (Vite + Tailwind 3 + react-router 6) that renders the currently active weather warnings for Portugal continental. Views:

- `/` — chip overview + district groups with cards
- `/cronologia` — hour-by-hour timeline (IPMA-style grid, but local time): overview matrix region × hour, or `?d=<IPMA code>` for one row per warning type + chronological list
- `/distrito/<slug>` — one page per IPMA area (25): worst level, observations, timeline, warning cards, civil-protection occurrences (ANEPC on the continent, SRPC, IP-RAM in Madeira), the area's warning history, share buttons, links to every other area
- `/distrito/<slug>/aviso/<tipo>-<AAAAMMDD-HHMM>` — one page per warning (shareable permalink; `noindex` because warnings expire — the page says "terminado" once FogosPT drops it)
- `/estacoes` — every IPMA weather station with its latest reading, sortable (`?ordem=`, `?dir=`; **default = station name A→Z**, pt collation ignoring accents/case — `?ordem=nome` is the same and isn't written; `?dir=` only when it differs from the column's default), region filter (`?regiao=`) and search (`?q=`), plus "mais quente / mais fria / vento / chuva" highlights (ties broken by name, like the list, so a tile and the top row agree). **Phones (< 640 px) get a list, not the table** (`StationList`: name and readings in one box, "Ordenar por" select + direction button, a "Hoje mín.–máx. · chuva" line that drops whatever is already the big value — sorted by Máx. → "Hoje mín. …", by Chuva desde 0h → no rain, nothing left → no line): the old sticky name cells were painted out of step with their rows by some mobile browsers (#46). Wider screens keep the table with a sticky name column; header corner `z-20` (opaque) above the body name cells `z-10`. Columns (each `COLUMNS` entry has `get(row)`, used for display and sorting): Temp., **Máx.** (`?ordem=tmax`), **Mín.** (`tmin`, ascending by default), Vento, **Vento máx.** (`ventoMax`, header `title` explains it's the mean wind), Chuva 1 h, **Chuva desde 0h** (`chuvaHoje`), Humidade, Pressão — the bold ones from `today` (#48), with ≥/≤ and a "N h sem leitura" tooltip when partial. The "Distrito / região" column only shows from 1280 px (`xl`); below it the district is the small grey line under the station name (`data-district`), so the table fits at 1024–1279 px; under 1024 px it scrolls sideways (name column fixed). Highlights: 5 tiles (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`, the 5th full width on phones) — "Mais chuva na última hora" and **"Mais chuva hoje"** (from `today.rain`, "≥" when that station has missing hours, same tie-break by name)
- `/estacao/<id>-<nome>` — one station: current tiles, hourly charts (24 h–7 dias), daily min/max + rain (30 dias), district warning banner, nearby stations. Only the leading id is authoritative; other slugs are redirected (client) / canonicalised (server)
- `/historico` — event log of warning changes (emitido / agravado / desagravado / prolongado / encurtado / retirado / terminado), grouped by day, newest first. Filters in the URL: `?periodo=24h|3d|7d|30d` (default 7d) or `?de=&ate=` (YYYY-MM-DD, max 31 days), `?regiao=<slug>`, `?tipo=<slugify(type)>`, `?evento=a,b`. Recorded by FogosPT since 2026-11-11 — no earlier data
- `/criterios` — IPMA warning-emission criteria (static, no API): colour meanings, thresholds per type for Continente/Madeira/Açores (`?regiao=`), Tempo Quente/Frio per district
- `/mapa` — Leaflet map with district polygons colored by warning level + toggleable weather station markers. Period picker (Agora / Hoje / Amanhã / next days, `?dia=<offset>`) filters what the polygons and popups show

Deployed as a static site on **Cloudflare Pages** at https://avisos.pt.

Pages Functions under `functions/api/` proxy the [FogosPT API](https://fogos.pt/pt/api) so the API key never touches the browser. Two more serve SEO/sharing: `functions/_middleware.js` (server-side `<head>`) and `functions/og/[[path]].js` (share-card PNGs).

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:3000 — /api/* WILL NOT work here
npm run dev:cf   # wrangler pages dev + vite; /api/* works, reads .dev.vars
npm run build    # outputs to ./dist
npm run preview  # serve ./dist locally
npm run lint     # .js/.jsx/.mjs in src, functions, scripts, tests, e2e — --max-warnings 0
npm test         # Vitest: unit + components + functions (TZ=Europe/Lisbon)
npm run test:e2e # Playwright — needs `npm run build` first
npm run test:all # lint + test + build + e2e (what CI runs)
npm run mock:fogos # fake FogosPT on :8799 (FOGOS_API_BASE=http://127.0.0.1:8799)
```

## Tests (CI: `.github/workflows/test.yml`, every PR and push to `main`)

- CI installs Chromium with `scripts/ci-install-chromium.sh`: browser from Playwright's CDN, then `playwright install-deps` (apt) with 3 tries × 180 s and growing pauses; if the Ubuntu mirrors stay down it carries on with the runner's own libraries and says so in a workflow warning (#40). Job timeout 25 min.

- **Unit** (`src/**/*.test.js`, `tests/functions/*.test.js`, Vitest `node`): every util/data module, `_fogos.js` and each `/api/*` handler called directly with a stubbed `fetch`. `src/data/data.test.js` pins **URL contracts** (the 25 district slugs) and data integrity (every GeoJSON concelho → an area, every station → a valid area).
- **Pages/components** (`tests/pages/*.test.jsx`, `*.test.jsx`, Vitest `jsdom`): `renderRoute(path)` (`tests/helpers/render.jsx`) renders the real route table (`src/routes.jsx`, shared with `main.jsx`); `mockApi()` (`tests/helpers/api.js`) stubs `fetch` so `/api/*` goes through the **real Pages Functions**, which call a fake FogosPT serving `tests/fixtures/data.js` (`makeFixtures(now)` — times relative to `now`, includes odd data: a station reporting only `-99`, one without geometry, a missing hour). `overrides` simulate a failing (`502`) or empty endpoint.
- **E2E** (`e2e/*.spec.js`, Playwright Chromium): `wrangler pages dev dist` (real middleware, functions, OG) + `tests/mock-fogos/server.mjs` (same fixtures). Projects `desktop`, `mobile` (Pixel 7) and `dark` — the last two only run tests tagged `@responsive`. Error/empty states use `page.route` in the browser (the functions' Cache API would serve stale data otherwise); each run starts wrangler with a fresh `--persist-to .wrangler/e2e`. `og.spec.js` is the only test allowed to reach the internet (fonts from jsDelivr) and retries.
- Rules: time is fixed (`vi.setSystemTime`) whenever an assertion depends on it; E2E never asserts on the time of day. A bug found by a test is fixed with that test failing first; a debatable one stays as `it.fails`/`test.fail` with a comment.

`/api/*` endpoints only work under `npm run dev:cf` (or in deployed CF Pages). Plain `npm run dev` gets a 200 on `/api/warnings` returning `index.html` (SPA fallback), which then fails to parse as JSON — expected, not a bug.

## Deploy

Cloudflare Pages builds this repo from git. Framework preset **Vite**, build command `npm run build`, output directory `dist`, Node ≥ 18.

`wrangler.toml` (name, `pages_build_output_dir`, `compatibility_date`) is the **source of truth** for those settings — the dashboard can't edit them while it exists. The compat date must stay ≥ 2022-11-30: `workers-og` needs the `ReadableStream` constructor, and on an older date every `/og/*` request fails with error 1101. Bumping the date changes runtime behaviour for all functions — check a preview deploy first. Pushing to the deploy branch is a production action — confirm before pushing if the user hasn't already asked.

**Required secret**: `FOGOS_API_KEY` in the CF Pages dashboard for Production **and** Preview. If missing, all `/api/*` endpoints return `500 {"error":"missing_api_key"}` — the proxy fails loud on purpose (no silent fallback).

`public/_redirects` contains `/* /index.html 200` for SPA fallback — necessary for `/mapa` (or any future route) to survive a hard refresh.

## Runtime architecture

### Server side (`functions/`)

- `functions/_fogos.js` — shared `proxyFogos({ env, path, cacheSeconds, transform?, label })` helper. Handles missing key (500), fetch failures (502), 30s timeout, logs status, sets `cache-control`, optionally transforms the JSON before returning it.
- `functions/api/warnings.js` → `/v2/warnings/ipma`, 5 min cache.
- `functions/api/stations.js` → `/v2/weather/stations/ipma`, 1 h cache (catalog rarely changes).
- `functions/api/observations.js` → `/v2/weather/observations`, 10 min cache. **Trims to the latest hour server-side** — upstream returns 24 h × ~190 stations (~1 MB); we return `{ hour, stations }` for just the most recent hour, **plus `today`** (#48): per station `{ tmax, tmin, tMissing, windMax, wMissing, rain, rMissing }` since 00:00 local, computed from the same 24 h by `todayAggregates()` (`src/utils/stationToday.js`). Local midnight per station region — Europe/Lisbon (continent, Madeira) or Atlantic/Azores, DST-aware (`todaySlots()` walks back hour by hour while the local date holds, so 23/25-hour days work); the region comes from the station catalog (`getStations()` Cache API, or a direct fetch when `caches` is missing, e.g. tests), else `STATION_AREAS`, else Lisbon. Temperature/wind count the 00:00 reading; **rain starts at 01:00** (`precAcumulada` at H is the hour ending at H). `*Missing` = hours of today without a reading → the value is a bound (≥ max/total, ≤ min); rain is null at 00:xx; stations without any reading today are absent. **IPMA publishes no real-time gust** (only in the daily summaries, ~2 days late): `windMax` is the highest hourly MEAN wind — never call it "rajada". `useWarningsData()` exposes it as `today`.
- `functions/api/warnings/history.js` → FogosPT `/v2/warnings/ipma/history` (added in FogosPT/fogosapi#98), 5 min cache, forwards only `from`/`to`/`area`/`type`/`kind`. Upstream returns `[{ id, kind, area, type, fromLevel, toLevel, startTime, endTime, previousEndTime, text, previousText, reportDate, occurredAt }]` (Lisbon wall-clock, newest `occurredAt` first; `texto_alterado` is stored upstream but never requested). URL ⇄ query and day grouping in `src/utils/history.js`; page `src/pages/historico.jsx` + `src/components/history/*` (rounds "now" to 5 min with `historyNow()` so visitors share the edge cache).
  - Shared by `/historico` and the district pages: `useHistoryEvents(search)` (fetch), `HistoryPeriodTabs` (24 h / 3 / 7 / 30 dias, `HISTORY_PERIODS` incl. the `phrase` for empty states), `HistoryDayList` (day headings via `historyDayLabel()` + `HistoryEvent`, `showArea` off on a district page), `HISTORY_RECORDING_SINCE`.
  - `components/district/DistrictHistory.jsx` — section **"Histórico de avisos"** on every `/distrito/<slug>` (after the occurrences sections): `areaHistorySearch(slug, period, historyNow())` = the same query as `/historico?regiao=<slug>&periodo=`, default 7 dias, period in local state (the district URL is a contract — no new params), 10 events then "Mostrar as N alterações", empty "Sem alterações aos avisos de <área> nos últimos 7 dias", inline error with retry (rest of the page unaffected), "Ver histórico completo" → `/historico?regiao=<slug>`. Works for every area incl. Açores/Madeira (#42).
- **Expired warnings are never shown**: `activeWarnings()` (`src/utils/share.js`) drops `endTime < now` in the `/api/warnings` proxy, in `getWarnings()` (middleware/OG) and on the client via `useActiveWarnings()` (re-checked every minute — cached responses and long-open tabs). FogosPT itself guarantees no two overlapping entries of the same area + type.
- `functions/api/incidents/fma.js` → `/v2/incidents/active?fma=1` (ANEPC incidents caused by adverse weather), 2 min cache, trimmed to the fields the district page uses (upstream embeds weather + all district warnings). Rendered by `components/district/DistrictIncidents.jsx` (continental only, refetch every 2 min); district matching and natureza → icon in `src/utils/incidents.js` (accent/case-insensitive — ANEPC writes "Viana Do Castelo").
- `functions/api/madeira/event.js` → FogosPT `/v2/madeira/events/current` (SRPC, IP-RAM — Madeira's regional civil protection; added in FogosPT/fogosapi#97), 2 min cache (upstream caches 60 s). Returns `{ event: null | {…} }`, trimmed to what the panel renders: `id, title, zone, status, active, start, end, untilNow, updatedAt, kpi{occurrences, activeOccurrences, operationals, groundAssets, municipalities, peak|null}, summary, recommendations[], municipalities[{name, occurrences}], roadRestrictions[{road, closed, text, time}], communiques[{title, time, link (http(s) only), official}], notes` — upstream's `natures/hourly/parishes/entities/topOccurrences` and the communiqué texts are dropped.
- `functions/api/madeira/occurrences.js` → FogosPT `/v2/madeira/occurrences?limit=2000` (no `from` = last 24 h, newest first), 2 min cache, trimmed to `{ id, copies, start, natureCode, nature, firefighters, vehicles, parishCode, parish, municipalityCode, municipality, lat, lng }`. **No status, no exact location**: `lat`/`lng` are the parish centroid (CAOP/DGT, added by FogosPT/fogosapi#101; `null` until it's deployed or when not geocoded). `copies` = times SRPC registered the same occurrence — counts use it.
  - **SRPC times are real UTC instants (`…Z`)**, unlike IPMA's Lisbon wall-clock: `new Date()` them (`instant()`/`formatInstant()` in `src/utils/madeira.js`), never `parseWarningTime()`. Displayed in the visitor's timezone like everything else.
- `functions/api/observations/recent.js` → same upstream, keeps 24 h for `?stations=<ids>` (≤ 40) — district-page sparklines and the station-page fallback.
- `functions/api/stations/[id]/observations.js` → FogosPT `/v2/weather/stations/{id}/observations?hours=` (1–168, 10 min) and `[id]/daily.js` → `/v2/weather/stations/{id}/daily?days=` (1–90, 1 h). **These upstream endpoints were added in FogosPT/fogosapi#92**; until it's deployed the station page falls back to the 24 h slice and hides the range picker / daily section. They return `null` (not `-99`) for missing readings; `reading()` handles both.

- `functions/_warnings.js` — `getWarnings` (5 min), `getStations` (1 h), `getLatestObservations` (10 min): server-side FogosPT data (Cache API) for the two functions below. `_fogos.js` exports `fetchFogosJson()` for it; `FOGOS_API_BASE` env overrides the upstream host (local mock only).
- `functions/_middleware.js` — **the SPA is client-rendered but share bots don't run JS**, so every HTML response gets its `<title>`, description, canonical, robots, `og:*`, `twitter:*` and BreadcrumbList JSON-LD rewritten per route with `HTMLRewriter`. Unknown routes → 404 + noindex (the SPA's `path="*"` route renders `components/layout/NotFound.jsx`). Pages serves a *missing* file or `/api/*` route as the SPA's index.html with 200 — the middleware turns that into a real 404 (HTML page, or `{"error":"not_found"}` under `/api/`). Unknown `/distrito/*` and `/estacao/*` → 404; `/estacao/<id>-<old-name>` gets the canonical of the current name. Any failure falls back to the static head — never blocks the page. Skips `/api/`, `/og/` and anything with a file extension.
- `functions/og/[[path]].js` — 1200×630 PNG cards via `workers-og` (satori + resvg wasm, ~720 KB compressed in the functions bundle): `/og/site.png`, `/og/distrito/<slug>.png`, `/og/aviso/<slug>/<id>.png`, `/og/estacao/<id>.png` (current reading; band = district's worst warning). Fonts: Fira Sans latin subset fetched from jsDelivr (no arrows — use `–`). Satori: every multi-child `<div>` needs `display:flex`. The middleware appends `?v=<hash of the warnings>` so social networks refetch when warnings change. Cached 10 min.

### Shared server/client code

- `src/utils/stations.js` — stations (also imported by functions): `stationPath`/`stationIdFromSlug`, `stationArea` (lookup in the generated `src/data/stationAreas.js`, nearest-centroid fallback), `stationRows(catalog, obs)`, `reading()` (−99 → null), `obsDate()` (UTC hour keys → Date), `fmtTemp/fmtMm/fmtKmh/fmtPct/fmtHpa` (pt-PT decimals), `stationSeo`.
- `src/data/stationAreas.js` + the station block in `public/sitemap.xml` are **generated** by `node scripts/build-stations.mjs` (point-in-polygon of each station against the two GeoJSONs). Re-run it when IPMA adds/moves stations. Madeira mountain stations land in MCN/MCS (MRM has no polygon).

- `src/utils/share.js` — imported by the browser **and** the functions: `SITE_URL`, `PAGE_META`/`DEFAULT_META` (static route titles/descriptions), `districtPath`, `warningSlug`/`warningPath`/`findWarning`, `districtSeo`/`warningSeo` (title + description), `formatLisbon` (always Europe/Lisbon, built from numeric parts so server and browser ICU agree), `warningsVersion`, `sortWarnings`. Keep it DOM/React-free.
- Area slugs live in `ipmaAreas.js` (`slug`, `codeFromSlug`) and are a **URL contract** — never rename.
- Warning ids = `slugify(type)-YYYYMMDD-HHMM` straight from the `startTime` string (no Date parsing). A level change on the same window keeps the URL.

### Client side

- `src/main.jsx` — routes `/` (eager), `/cronologia`, `/mapa`, `/criterios`, `/distrito/:slug`, `/distrito/:slug/aviso/:id` (lazy). The map bundle (Leaflet + GeoJSONs + map components) only loads when a visitor hits `/mapa`.
- `src/pages/index.jsx` — chip overview + district groups.
- `src/pages/mapa.jsx` — fetches warnings + stations + obs + both GeoJSONs in parallel and renders **three** `<WarningsMap>` instances: continental (big, full-width), Açores (side, filtered feature collection + bbox), Madeira (side).
- `src/pages/cronologia.jsx` — area picker + `<TimelineGrid>`. Selected area lives in the URL (`?d=LSB`) so it's linkable.
- `src/components/timeline/TimelineGrid.jsx` — fixed label column + horizontally scrolling track (`CELL` = 24 px/hour). Per-hour worst level is collapsed into contiguous runs drawn as bars; hover/tap a column → inspector strip at the top. Midnight lines + "agora" marker are overlays.
- `src/utils/timeline.js` — hour window (current hour → last `endTime`, clamped 48–96 h; no past since upstream drops ended warnings), `worstAt`, day grouping/labels, "começa/termina em".
- `src/pages/distrito.jsx`, `src/pages/aviso.jsx` + `src/components/district/*` (Breadcrumb, DistrictTimeline, OtherAreas) + `src/components/share/ShareButtons.jsx` (native share / WhatsApp / Facebook / X / copy) + `src/hooks/{useWarningsData,useNow}.js`.
- `src/pages/estacao.jsx`, `src/pages/estacoes.jsx`, `src/components/stations/*` — `StationChart` (hand-rolled SVG small multiples: `line` / `bar` / `range`, one hue, shared crosshair via lifted `hoverIdx`, sized by `useWidth`), `Sparkline`, `DistrictStations` (section on district pages: Temperatura / Chuva / Vento / Humidade switcher; the default comes from `defaultStationMetric()` in `src/utils/stationMetrics.js` — warning in force > starting within 24 h > later, then level, then IPMA order; Precipitação/Trovoada → chuva, Vento → vento, Tempo Quente/Frio/Neve → temperatura, Nevoeiro → humidade, Agitação Marítima ignored; no warning → temperatura. Rain shows the 24 h total with bar sparklines). `src/hooks/useStationSeries.js` loads the hourly series with the 24 h fallback and the daily summaries.
- **Madeira (SRPC, IP-RAM)** — `src/utils/madeira.js` (DOM-free): CAOP municipality code → area (`3106/3109/3110` → MCN, `3201` → MPS, other `31xx` → MCS; name fallback via `madeiraAreaForConcelho()` in `islandConcelhos.js`), `areaOccurrences()` (**MRM = the whole main island**, MCN + MCS: the mountain zone crosses concelhos and SRPC only gives concelho/freguesia), `parishGroups()` (one group per `parishCode` with coordinates, count = sum of `copies`), `occurrenceWindow()` (map period → window), `activeEvent()`, `eventAreaOccurrences()`. `src/hooks/useMadeiraSrpc.js` fetches the event and/or the occurrences (`event`/`occurrences` flags), refetch every 2 min, each part fails on its own and keeps its last good copy — **every consumer gates it with `srpcFresh(loadedAt, failed, now)` and a ticking clock** (hidden 15 min after the last good refresh, amber "não foi possível atualizar" before that): district section, event panel, home banner and the `/mapa` layer (which polls on its own, independent of the warnings retry).
  - `components/district/MadeiraOccurrences.jsx` — section **"Ocorrências SRPC-RAM"** (`#ocorrencias-srpc`) on the four Madeira area pages, after the (continental-only) `DistrictIncidents`: `MadeiraEventPanel.jsx` when an event is active (title, start/last update, KPIs incl. this area's total from the event's per-concelho counts, roads cortadas/condicionadas, recommendations, communiqués — 3 + "ver todos"), then the area's occurrences of the last 24 h (kind chips via `incidentKind()` — same ANEPC natures — list collapsed to 8, "×N" for copies, a note with how many occurrences of the Region have no concelho). Both parts hidden when never loaded or the last good copy is > 15 min old; stale banner otherwise.
  - Home: `components/warnings/MadeiraEventBanner.jsx` — one line under the Madeira chips (and under the empty state) when an event is active, linking to the area with most event occurrences.
  - `/mapa`: `components/map/MadeiraOccurrencesLayer.jsx` — overlay **"Ocorrências SRPC-RAM"** (checked) on the Madeira map only, passed through `WarningsMap`'s `overlays` prop; one violet count bubble (`[data-madeira-parish]`) per parish at the centroid, popup = parish, concelho, "localização aproximada (freguesia)", newest 6 occurrences (scrolls). Occurrences are past events, so the period picker maps to: **Agora = last 24 h, today's tab = since local midnight, later days = none** (note under the map says why, and how many have no location). Popup content uses `<div>`s — leaflet.css gives popup `<p>` 1.3em margins that beat Tailwind's `m-0`.
- **IPMA thresholds on station charts (#44)** — `src/utils/criteriaThresholds.js` interprets `criterios.js` (still the only source, still strings): `parseThreshold()` (`"a a b"` in either order, `>`/`&gt;`, `<`/`&lt;`, `≥`, `≤`), `levelStart()` = where a level starts — the weakest end of IPMA's range (lower bound when higher is worse; **higher bound for cold**, whatever the written order: Lisboa `"3 a 1"` → ≤ 3, MRM `"-2 a -1"` → ≤ −1, `"-4 a -2"` → ≤ −2), `>`/`<` strict (always the red level); values between two written integer ranges (20.5 mm) count as the lower level. `stationThresholds(code)` → `rain1h`, `rain6h`, `windGust` (`reference: true` — stations only report the MEAN wind), `windMean` (Açores only), `heat`, `cold` (note "≥ 48 h"); the "Nas terras altas" wind row isn't used. Island temperature rows are mapped by code (`MCN` → "Costa Norte", `AOC` → "Grupo Ocidental", …). `criteriaThresholds.test.js` **pins every interpreted value for the 25 areas** (hand-written) — update it when IPMA revises `criterios.js`.
  - `src/utils/chartThresholds.js` — shared by `StationChart` and `Sparkline`: `chartSets()` (temperatura: heat+cold; range: heat vs daily max, cold vs daily min; chuva: mm/1h on the bars + mm/6h on the 6 h sum; vento: gust as reference + Açores mean), `thresholdDomain()` = **scale rule: a criterion enters the Y domain only if the data still fill ≥ 50 % of it** (from-zero charts: data ≥ 50 % of yellow; temperatures: relative to the data span, not 0 °C), otherwise the caption says "<critério>: limiar amarelo X, fora da escala"; the budget holds for the **combined** domain (criteria tried smallest stretch first, each against the domain already stretched — heat and cold can't both squash a chart) and, in `StationChart`, on the **tick-rounded axis** (`thresholdDomain(lo, hi, sets, nice)`); the "fora da escala" caption only names a yellow that is really off the final axis; `thresholdLines()` draws, per criterion, the levels the data reach plus the next one, **any that fall inside the scale even if that criterion's yellow didn't fit** (heat wave at 38–40 °C → orange 38, red 40); `reachedText()` (tooltip "≥ limiar laranja", never from the gust reference); `latestLevel()` (district chip). `src/utils/rolling.js` → `rollingSum(values, 6)` (null when any hour of the window is missing).
  - `StationChart` props `thresholds`, `overlay` (`{ values, label, format }` — the dashed 6 h rain line, `data-overlay`) and `note`; lines `line[data-threshold=<level>]` (+ `data-reference`, dotted, for gusts) with labels at the right edge (overlapping labels skipped); tooltip adds "6 h: …" and "≥ limiar …". `Sparkline` prop `thresholds` (thin lines, no labels; listed in its `aria-label`/`<title>`). `DistrictStations`: chip `≥ amarelo` (`data-level-chip`) next to the secondary line when the latest reading reaches a level — only heat/cold, mm/1h and the Açores mean wind.
  - Colours `--chart-warn-yellow|orange|red` and `--chart-overlay` in `index.css` (darker yellow on light backgrounds; `LEVELS.yellow.fill` is too pale there).
  - Switch "Mostrar limiares" (`ThresholdsToggle.jsx` above the station charts, `useShowThresholds()`): on by default, `localStorage.limiares = '0'` when off, synced between components by a window event; also hides the district lines/chips.
  - Fixtures near the thresholds: `RAIN_STATION_ID` (Lisboa, 11 mm now, 6 h sum 46 mm), `WIND_STATION_ID` (Ponta Delgada, mean 68 km/h), `HOT_STATION_ID` (Beja, ~36 °C).
- `src/components/warnings/*` — cards, groups, overview chips (three sections: continental, Açores, Madeira), observation strip, state components.
- `src/components/map/WarningsMap.jsx` — region-aware Leaflet map: takes `center/zoom/bounds/geojson/height`, filters stations by bbox, colors polygons per feature via `codeForFeature()`.
  - **Warning-type icons** (`WarningIconsLayer`, own toggle in the layers control): one Leaflet `divIcon` per area — a pill of FA icons, one per warning type, filled with that type's worst level (`LEVELS[…].fill`). Anchors (`map/anchors.js`): continental = bbox centre of the district's municipalities; islands = hand-picked `IPMA_AREAS[code].iconAt` (polygon maths fails there — Madeira's north/south/mountain zones don't follow concelhos, and Funchal's MultiPolygon includes the Selvagens at ~30°N). MRM has an `iconAt` too, so **MRM warnings do show on the map as an icon**. Hidden below zoom 6 (pills overlap). Follows the period picker like the polygons.
  - **Sea bands** (`SeaBandLayer`, toggle "Agitação marítima (mar)", all three maps): for areas with an **Agitação Marítima** warning in the selected period, the strip of sea within `SEA_BAND_KM` (20 km) of their coast, filled with the worst sea-state level at 0.75 opacity + 1 px stroke so yellow/orange don't turn brown over the blue sea (`seaWarningsByCode()` + `seaBandStyle()` in `src/utils/seaBands.js`; `bandsForRegion()` splits the collection per map). Drawn in its own Leaflet pane `sea-bands` (z-index 390, below the overlay pane) so the land polygons stay on top; tooltip + popup like the district popups (`<area> — mar`). Geometry from `public/data/sea-bands.geojson`, fetched by `pages/mapa.jsx` without blocking the map; the legend explains it.
- `src/components/map/MapLegend.jsx` — overlay legend.
- `src/components/map/MapPeriodPicker.jsx` — period tabs for `/mapa`; each tab shows worst level + region count for its window. Periods come from `mapPeriods()` in `utils/timeline.js` ("Agora" = active this instant, then visitor-local calendar days up to the last `endTime`, max 5); filtering via `warningsInPeriod()`. Unknown/stale `?dia=` falls back to "Agora".
- `src/components/layout/{Header,Footer,Nav}.jsx` — Nav has links to `/`, `/cronologia`, `/historico`, `/mapa`, `/estacoes` and `/criterios`. District pages link to `/historico?regiao=<slug>`.
- `src/data/`:
  - `ipmaAreas.js` — `IPMA_AREAS` (25 codes total: 18 continental + AOC/ACE/AOR + MCN/MCS/MRM/MPS) each with `name`/`chip`/`lat`/`lng`/`region`. `CONTINENTAL_CODES`, `ACORES_CODES`, `MADEIRA_CODES` slice by region. `codeFromContinentalName(disName)` resolves the CAOP `dis_name` for continental only.
  - `islandConcelhos.js` — `codeForFeature(feature, continentalResolver)` — for continental features it delegates to `dis_name` lookup; for island features it uses `con_name` → island subregion (per-concelho table). `MRM` (Madeira mountain zone) crosses concelho boundaries and is deliberately not mapped to polygons — MRM warnings still surface in the list/popups but don't get a colored polygon.
  - `levels.js` — `LEVELS` with `priority`, Tailwind class strings, **and `fill` hex** (Leaflet needs raw hex, not class names). `worstLevelId()` picks the worst level for a district.
  - `criterios.js` — IPMA criteria transcribed by hand from ipma.pt (`CRITERIA_SOURCE_URL`, consulted `CRITERIA_CONSULTED_AT`). Values stay as IPMA's strings (`"70 a 90"`, `"3 a 1"`) — don't numberify. **IPMA has no API for this**: when they revise the table, update this file and the date.
  - `warningTypes.js` — `awarenessTypeName` → FA icon (or `emoji`, e.g. 🌊 Agitação Marítima — FA 6 has no wave) + friendly label. Always render through `<TypeIcon type=…>` (`components/warnings/TypeIcon.jsx`); the map's divIcon HTML handles `emoji` itself.
- `src/utils/`:
  - `fetchJson.js` — throws on non-2xx.
  - `geo.js` — haversine + nearest-station-with-observations.
  - `format.js` — `parseWarningTime`/`formatWhen` (Lisbon → instant → visitor-local), `-99` sentinel filter, temp/wind/humidity/precip/timestamp formatters, `relativeMinutes`.
  - `pageTitle.js` — `usePageTitle(title, { description, robots })`: syncs title/description/canonical/og on client-side navigation (first paint comes from the middleware).

### GeoJSON assets

Three files in `public/data/`:

- `pt-continental.geojson` — 278 municipality polygons (`dis_name` = one of the 18 districts).
- `pt-arquipelagos.geojson` — 30 municipality polygons (`dis_name` ∈ `"Açores"`, `"Madeira"`).
- `sea-bands.geojson` — **generated** by `node scripts/build-sea-bands.mjs`: one feature per `SEA_AREAS` code (`src/data/seaAreas.js`: VCT BRG PTO AVR CBR LRA LSB STB BJA FAR, AOC ACE AOR, MCN MCS MPS — the areas IPMA issues Agitação Marítima for; inland districts and MRM get none), `properties.code`, top-level `bandKm`. Method: land = union of every concelho + Spain (`scripts/data/spain-near-pt.geojson`, Natural Earth 1:10m clipped near PT, grown 1.5 km to close the Minho/Guadiana gaps between the two sources), and the mainland is **morphologically closed** (`CLOSE_KM` = 1.5: grow, shrink back, fill holes) so estuary mouths and lagoon inlets narrower than 3 km are sealed and the inner Tejo estuary counts as land — the band starts at the open coast (the Sado, Ria de Aveiro, Ria Formosa and river mouths are already inside the concelho limits); islands are not closed (Faial–Pico would merge); Voronoi of the land-outline vertices labelled by area (Spanish coast = blocker) merged per area; band = (area buffered by `SEA_BAND_KM`) − land ∩ its cells → continuous along the coast, no overlaps, no Spanish land. Then simplified (~100 m), 4 decimals, rebuilt valid; the Selvagens (Funchal) are dropped. ~62 KB, gzip ≈ 18 KB. Deterministic. **Changing the width = edit `SEA_BAND_KM` and re-run the script** (`src/data/seaBands.test.js` checks codes, validity, off-land, no overlaps, no gaps between continental neighbours, and sample points inside the Tejo/Sado/rias/river mouths that must have no band). `@turf/turf` is a devDependency used only by the script and that test — never import it from `src/` app code.

Source: [FrancisPais/geojson-portugal-continental](https://github.com/FrancisPais/geojson-portugal-continental) + [FrancisPais/geojson-portugal-arquipelagos](https://github.com/FrancisPais/geojson-portugal-arquipelagos) — "simplificado" variants (polygons already reduced). Combined ~790 KB uncompressed, gzip ≈ 240 KB, only fetched when the visitor hits `/mapa` (as is `sea-bands.geojson`).

Polygon coloring:
- **Continental**: `feature.properties.dis_name` → IPMA code → worst warning. All municipalities of the same district share the color.
- **Açores**: `feature.properties.con_name` → island group code (AOC/ACE/AOR) via `islandConcelhos.js`. Concelhos on the same island group share the color.
- **Madeira**: same mechanism → MCN (Costa Norte: Porto Moniz, São Vicente, Santana), MCS (Costa Sul: everything else on the main island), MPS (Porto Santo). MRM (Regiões Montanhosas) doesn't map to concelho boundaries — MRM warnings surface in the list but not on the map.

### District → nearest station correlation

FogosPT doesn't tag stations with area codes. We compute nearest station spatially: `areaCentroid(code)` from `ipmaAreas.js` + haversine against every station that has observations for the latest hour. Centroids are approximate — they only need to pick the right nearest station, not to be cartographically accurate.

### FogosPT data shapes

Warnings (`/v2/warnings/ipma`) — flat array:

```js
{ text, awarenessTypeName, idAreaAviso, awarenessLevelID, startTime, endTime }
```

- `awarenessLevelID` ∈ `"yellow" | "orange" | "red"`. `"green"` never appears.
- Timestamps ISO without timezone, as Lisbon wall-clock time. **Never `new Date(iso)` them** (that reads them in the visitor's timezone) — use `parseWarningTime()` from `utils/format.js`, which resolves them against `Europe/Lisbon` (DST-aware). Display goes through `formatWhen()`, which shows the visitor's local time — same convention on every page.
- Only warnings with `endTime >= now`.

Observations (as trimmed by our proxy):

```js
{ hour: '2026-08-27T13:00', stations: { '<idEstacao>': { temperatura, humidade, pressao, precAcumulada, intensidadeVento, intensidadeVentoKM, idDireccVento, radiacao } } }
```

- **`-99` in any numeric field means "no reading"** — always filter through `isValid()` in `utils/format.js`.
- Missing stations for an hour are silently absent from `stations` — tolerate absence.
- `idDireccVento`: `0=no wind, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W, 8=NW, 9=N`. Displayed with Portuguese letters (SO / O / NO) via `windDir()` in `format.js`.

Stations (`/v2/weather/stations/ipma`) — GeoJSON FeatureCollection, coordinates `[lng, lat]` (GeoJSON convention, remember to swap for Leaflet's `[lat, lng]`).

## SEO artifacts

- `index.html` has description, canonical, Open Graph, Twitter card, `WebSite` JSON-LD, preconnect to fonts. These are the **fallback** values — `functions/_middleware.js` rewrites them per route in production (and `og:image` to a generated `/og/*.png`). Plain `npm run dev` shows the fallbacks.
- `public/manifest.json` — installable app ("Avisos.pt", pt-PT, theme `#dc2626`). Icons in `public/imgs/`: `icon-192/512.png` (transparent, `any`), `icon-maskable-512.png` and `apple-touch-icon.png` (opaque white, logo inside the 80% safe zone) — all generated from `logo.png` with its transparent margin cropped. Regenerate them if the logo changes.
- `public/robots.txt` — allows everything except `/api/`, points to sitemap.
- `public/sitemap.xml` — lists `/`, `/cronologia`, `/historico`, `/mapa`, `/estacoes`, `/criterios`, the 25 `/distrito/<slug>` pages and the ~230 `/estacao/<slug>` pages (generated block; warning pages are ephemeral and not listed).
- Per-page `<title>` via `usePageTitle()` in each page component.

## Style

- **Tabs**, **no semicolons** — matches `.editorconfig` + `.prettierrc`. Match this style when editing.
- Tailwind color aliases: `primary` (indigo), `secondary` (rose), `tertiary` (teal), `gray` (slate), `surface` (card background). All defaults preserved (red/orange/yellow/green available — verified in build).
- **Dark mode** (`darkMode: 'class'`, `.dark` on `<html>`): `gray`, `primary`, `secondary` and `surface` are **CSS variables** (`src/index.css`) whose values swap under `.dark` — so most components need no `dark:` classes. Consequences:
  - Use `bg-surface` for cards/panels, never `bg-white`.
  - Text on a `bg-gray-900` pill/button is `text-gray-50` (both flip together), not `text-white`.
  - Ink that must NOT flip (e.g. on the yellow level chip) uses the untouched Tailwind `slate-*`, not `gray-*`.
  - Other hues (green/red/amber tints) need explicit `dark:` variants.
  - SVG charts read `var(--chart-line|grid|ink)` via `style` (presentation attributes don't take `var()`); marker rings use `[data-ring]`.
  - Leaflet: tile pane is inverted/hue-rotated, popups/controls themed in `index.css`; divIcon HTML uses `rgb(var(--surface))`.
  - Theme choice (`system`/`light`/`dark`) in `localStorage.theme`, applied pre-paint by the inline script in `index.html`, toggled by `components/layout/ThemeToggle.jsx`.
- Tailwind classes built from lookup objects **must be full literal strings** (see `LEVELS[…].bar`) — never string-concatenate class names.
- Colors for Leaflet come from `LEVELS[…].fill` (hex), NOT the `bar` Tailwind class.
- CSS is a single `src/index.css` imported from `src/main.jsx`. Leaflet CSS is imported directly by `WarningsMap.jsx` so it ships only in the map bundle.
- Font Awesome 6 icons load via CDN in `index.html` (`fas` prefix).

## Not yet implemented

- **MRM polygon coloring**: Madeira's mountain warning zone crosses concelho boundaries; MRM warnings show as a map icon and in the list, but there's no MRM-coloured region. A concelho-independent overlay would need a different data source.
- **Filters** (by district/type/level), **PWA/offline**, **dark mode**, **push notifications**, **RSS**. The history only covers changes since 2026-11-11 (no backfill).

## License & attribution

AGPL-3.0-or-later (`LICENSE`) with an additional §7(b) attribution term in `NOTICE` — same model as the Fogos.pt projects (fogosapi, fogospt). The site footer (`src/components/layout/Footer.jsx`) carries that attribution plus the data credits (IPMA, ANEPC and SRPC, IP-RAM via the Fogos.pt API, parish centroids from CAOP/DGT via Fogos.pt, concelho GeoJSON source, Natural Earth for the sea bands' Spanish coast, OpenStreetMap) and the GitHub link. **Keep the footer credits** when redesigning it, and add any new data source to `NOTICE`, the README "Créditos dos dados" and the footer.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
