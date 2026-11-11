# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React 18 SPA (Vite + Tailwind 3 + react-router 6) that renders the currently active weather warnings for Portugal continental. Views:

- `/` — chip overview + district groups with cards
- `/cronologia` — hour-by-hour timeline (IPMA-style grid, but local time): overview matrix region × hour, or `?d=<IPMA code>` for one row per warning type + chronological list
- `/distrito/<slug>` — one page per IPMA area (25): worst level, observations, timeline, warning cards, share buttons, links to every other area
- `/distrito/<slug>/aviso/<tipo>-<AAAAMMDD-HHMM>` — one page per warning (shareable permalink; `noindex` because warnings expire — the page says "terminado" once FogosPT drops it)
- `/estacoes` — every IPMA weather station with its latest reading, sortable (`?ordem=`, `?dir=`), region filter (`?regiao=`) and search (`?q=`), plus "mais quente / mais fria / vento / chuva" highlights
- `/estacao/<id>-<nome>` — one station: current tiles, hourly charts (24 h–7 dias), daily min/max + rain (30 dias), district warning banner, nearby stations. Only the leading id is authoritative; other slugs are redirected (client) / canonicalised (server)
- `/historico` — event log of warning changes (emitido / agravado / desagravado / prolongado / encurtado / retirado / terminado), grouped by day, newest first. Filters in the URL: `?periodo=24h|3d|7d|30d` (default 7d) or `?de=&ate=` (YYYY-MM-DD, max 31 days), `?regiao=<slug>`, `?tipo=<slugify(type)>`, `?evento=a,b`. Recorded by FogosPT since 2026-11-11 — no earlier data
- `/criterios` — IPMA warning-emission criteria (static, no API): colour meanings, thresholds per type for Continente/Madeira/Açores (`?regiao=`), Tempo Quente/Frio per district
- `/mapa` — Leaflet map with district polygons colored by warning level + toggleable weather station markers. Period picker (Agora / Hoje / Amanhã / next days, `?dia=<offset>`) filters what the polygons and popups show

Deployed as a static site on **Cloudflare Pages** at https://avisos.pt.

Three Cloudflare Pages Functions under `functions/api/` proxy the [FogosPT API](https://fogos.pt/pt/api) so the API key never touches the browser. Two more serve SEO/sharing: `functions/_middleware.js` (server-side `<head>`) and `functions/og/[[path]].js` (share-card PNGs).

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
- `functions/api/observations.js` → `/v2/weather/observations`, 10 min cache. **Trims to the latest hour server-side** — upstream returns 24 h × ~190 stations (~1 MB); we return `{ hour, stations }` for just the most recent hour.
- `functions/api/warnings/history.js` → FogosPT `/v2/warnings/ipma/history` (added in FogosPT/fogosapi#98), 5 min cache, forwards only `from`/`to`/`area`/`type`/`kind`. Upstream returns `[{ id, kind, area, type, fromLevel, toLevel, startTime, endTime, previousEndTime, text, previousText, reportDate, occurredAt }]` (Lisbon wall-clock, newest `occurredAt` first; `texto_alterado` is stored upstream but never requested). URL ⇄ query and day grouping in `src/utils/history.js`; page `src/pages/historico.jsx` + `src/components/history/*` (rounds "now" to 5 min so visitors share the edge cache).
- **Expired warnings are never shown**: `activeWarnings()` (`src/utils/share.js`) drops `endTime < now` in the `/api/warnings` proxy, in `getWarnings()` (middleware/OG) and on the client via `useActiveWarnings()` (re-checked every minute — cached responses and long-open tabs). FogosPT itself guarantees no two overlapping entries of the same area + type.
- `functions/api/incidents/fma.js` → `/v2/incidents/active?fma=1` (ANEPC incidents caused by adverse weather), 2 min cache, trimmed to the fields the district page uses (upstream embeds weather + all district warnings). Rendered by `components/district/DistrictIncidents.jsx` (continental only, refetch every 2 min); district matching and natureza → icon in `src/utils/incidents.js` (accent/case-insensitive — ANEPC writes "Viana Do Castelo").
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
- `src/components/warnings/*` — cards, groups, overview chips (three sections: continental, Açores, Madeira), observation strip, state components.
- `src/components/map/WarningsMap.jsx` — region-aware Leaflet map: takes `center/zoom/bounds/geojson/height`, filters stations by bbox, colors polygons per feature via `codeForFeature()`.
  - **Warning-type icons** (`WarningIconsLayer`, own toggle in the layers control): one Leaflet `divIcon` per area — a pill of FA icons, one per warning type, filled with that type's worst level (`LEVELS[…].fill`). Anchors (`map/anchors.js`): continental = bbox centre of the district's municipalities; islands = hand-picked `IPMA_AREAS[code].iconAt` (polygon maths fails there — Madeira's north/south/mountain zones don't follow concelhos, and Funchal's MultiPolygon includes the Selvagens at ~30°N). MRM has an `iconAt` too, so **MRM warnings do show on the map as an icon**. Hidden below zoom 6 (pills overlap). Follows the period picker like the polygons.
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

Two files in `public/data/`:

- `pt-continental.geojson` — 278 municipality polygons (`dis_name` = one of the 18 districts).
- `pt-arquipelagos.geojson` — 30 municipality polygons (`dis_name` ∈ `"Açores"`, `"Madeira"`).

Source: [FrancisPais/geojson-portugal-continental](https://github.com/FrancisPais/geojson-portugal-continental) + [FrancisPais/geojson-portugal-arquipelagos](https://github.com/FrancisPais/geojson-portugal-arquipelagos) — "simplificado" variants (polygons already reduced). Combined ~790 KB uncompressed, gzip ≈ 240 KB, only fetched when the visitor hits `/mapa`.

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

AGPL-3.0-or-later (`LICENSE`) with an additional §7(b) attribution term in `NOTICE` — same model as the Fogos.pt projects (fogosapi, fogospt). The site footer (`src/components/layout/Footer.jsx`) carries that attribution plus the data credits (IPMA via the Fogos.pt API, concelho GeoJSON source, OpenStreetMap) and the GitHub link. **Keep the footer credits** when redesigning it, and add any new data source to `NOTICE`, the README "Créditos dos dados" and the footer.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
