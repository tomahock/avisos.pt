# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React 18 SPA (Vite + Tailwind 3 + react-router 6) that renders the currently active weather warnings for Portugal continental. Two views:

- `/` — chip overview + district groups with cards
- `/mapa` — Leaflet map with district polygons colored by warning level + toggleable weather station markers

Deployed as a static site on **Cloudflare Pages** at https://avisos.pt.

Three Cloudflare Pages Functions under `functions/api/` proxy the [FogosPT API](https://fogos.pt/pt/api) so the API key never touches the browser.

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:3000 — /api/* WILL NOT work here
npm run dev:cf   # wrangler pages dev + vite; /api/* works, reads .dev.vars
npm run build    # outputs to ./dist
npm run preview  # serve ./dist locally
npm run lint
```

`/api/*` endpoints only work under `npm run dev:cf` (or in deployed CF Pages). Plain `npm run dev` gets a 200 on `/api/warnings` returning `index.html` (SPA fallback), which then fails to parse as JSON — expected, not a bug.

## Deploy

Cloudflare Pages builds this repo from git. Framework preset **Vite**, build command `npm run build`, output directory `dist`, Node ≥ 18. Pushing to the deploy branch is a production action — confirm before pushing if the user hasn't already asked.

**Required secret**: `FOGOS_API_KEY` in the CF Pages dashboard for Production **and** Preview. If missing, all `/api/*` endpoints return `500 {"error":"missing_api_key"}` — the proxy fails loud on purpose (no silent fallback).

`public/_redirects` contains `/* /index.html 200` for SPA fallback — necessary for `/mapa` (or any future route) to survive a hard refresh.

## Runtime architecture

### Server side (`functions/`)

- `functions/_fogos.js` — shared `proxyFogos({ env, path, cacheSeconds, transform?, label })` helper. Handles missing key (500), fetch failures (502), 30s timeout, logs status, sets `cache-control`, optionally transforms the JSON before returning it.
- `functions/api/warnings.js` → `/v2/warnings/ipma`, 5 min cache.
- `functions/api/stations.js` → `/v2/weather/stations/ipma`, 1 h cache (catalog rarely changes).
- `functions/api/observations.js` → `/v2/weather/observations`, 10 min cache. **Trims to the latest hour server-side** — upstream returns 24 h × ~100 stations (~1 MB); we return `{ hour, stations }` for just the most recent hour.

### Client side

- `src/main.jsx` — routes `/` (eager) and `/mapa` (lazy). The map bundle (Leaflet + GeoJSONs + map components) only loads when a visitor hits `/mapa`.
- `src/pages/index.jsx` — chip overview + district groups.
- `src/pages/mapa.jsx` — fetches warnings + stations + obs + geojson in parallel, renders `<WarningsMap>`.
- `src/components/warnings/*` — cards, groups, overview chips, observation strip, state components.
- `src/components/map/WarningsMap.jsx` — Leaflet map with `<GeoJSON>` district layer (colored by warning) and toggleable `<CircleMarker>` station layer.
- `src/components/map/MapLegend.jsx` — overlay legend.
- `src/components/layout/{Header,Footer,Nav}.jsx` — Nav has links to `/` and `/mapa`.
- `src/data/`:
  - `ipmaAreas.js` — `IPMA_AREAS` (18 continental districts with centroids) + `IPMA_CODE_BY_NAME` (reverse lookup for the CAOP `dis_name` → IPMA code). Island codes not yet mapped.
  - `levels.js` — `LEVELS` with `priority`, Tailwind class strings, **and `fill` hex** (Leaflet needs raw hex, not class names). `worstLevelId()` picks the worst level for a district.
  - `warningTypes.js` — `awarenessTypeName` → FA icon + friendly label.
- `src/utils/`:
  - `fetchJson.js` — throws on non-2xx.
  - `geo.js` — haversine + nearest-station-with-observations.
  - `format.js` — `-99` sentinel filter, temp/wind/humidity/precip/timestamp formatters, `relativeMinutes`.
  - `pageTitle.js` — `usePageTitle(title)` hook.

### GeoJSON assets

Two files in `public/data/`:

- `pt-continental.geojson` — 278 municipality polygons (`dis_name` = one of the 18 districts).
- `pt-arquipelagos.geojson` — 30 municipality polygons (`dis_name` ∈ `"Açores"`, `"Madeira"`).

Source: [FrancisPais/geojson-portugal-continental](https://github.com/FrancisPais/geojson-portugal-continental) + [FrancisPais/geojson-portugal-arquipelagos](https://github.com/FrancisPais/geojson-portugal-arquipelagos) — "simplificado" variants (polygons already reduced). Combined ~790 KB uncompressed, gzip ≈ 240 KB, only fetched when the visitor hits `/mapa`.

The map colors polygons at municipality granularity but uses `dis_name → IPMA code → worst warning level` — all municipalities of the same district get the same color. If a warning is for a district whose name doesn't exist in the GeoJSON, the polygon stays white/transparent.

### District → nearest station correlation

FogosPT doesn't tag stations with area codes. We compute nearest station spatially: `areaCentroid(code)` from `ipmaAreas.js` + haversine against every station that has observations for the latest hour. Centroids are approximate — they only need to pick the right nearest station, not to be cartographically accurate.

### FogosPT data shapes

Warnings (`/v2/warnings/ipma`) — flat array:

```js
{ text, awarenessTypeName, idAreaAviso, awarenessLevelID, startTime, endTime }
```

- `awarenessLevelID` ∈ `"yellow" | "orange" | "red"`. `"green"` never appears.
- Timestamps ISO without timezone, interpreted as local PT.
- Only warnings with `endTime >= now`.

Observations (as trimmed by our proxy):

```js
{ hour: '2026-08-27T13:00', stations: { '<idEstacao>': { temperatura, humidade, pressao, precAcumulada, intensidadeVento, intensidadeVentoKM, idDireccVento, radiacao } } }
```

- **`-99` in any numeric field means "no reading"** — always filter through `isValid()` in `utils/format.js`.
- Missing stations for an hour are silently absent from `stations` — tolerate absence.
- `idDireccVento`: `0=no wind, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W, 8=NW, 9=N`.

Stations (`/v2/weather/stations/ipma`) — GeoJSON FeatureCollection, coordinates `[lng, lat]` (GeoJSON convention, remember to swap for Leaflet's `[lat, lng]`).

## SEO artifacts

- `index.html` has description, canonical, Open Graph, Twitter card, `WebSite` JSON-LD, preconnect to fonts. **`og:image` points to `/imgs/logo.png` as a fallback** — replace with a proper 1200×630 social image when one exists.
- `public/robots.txt` — allows everything except `/api/`, points to sitemap.
- `public/sitemap.xml` — lists `/` and `/mapa`.
- Per-page `<title>` via `usePageTitle()` in each page component.

## Style

- **Tabs**, **no semicolons** — matches `.editorconfig` + `.prettierrc`. Match this style when editing.
- Tailwind color aliases: `primary` (indigo), `secondary` (rose), `tertiary` (teal), `gray` (slate). All defaults preserved (red/orange/yellow/green available — verified in build).
- Tailwind classes built from lookup objects **must be full literal strings** (see `LEVELS[…].bar`) — never string-concatenate class names.
- Colors for Leaflet come from `LEVELS[…].fill` (hex), NOT the `bar` Tailwind class.
- CSS is a single `src/index.css` imported from `src/main.jsx`. Leaflet CSS is imported directly by `WarningsMap.jsx` so it ships only in the map bundle.
- Font Awesome 6 icons load via CDN in `index.html` (`fas` prefix).

## Not yet implemented

- **Islands (Madeira, Açores) warnings**: FogosPT's IPMA codes for island regions aren't yet known — the map draws them as neutral polygons and any warning that references an unknown code appears at the bottom of the list without a chip/color. Add entries to `IPMA_AREAS` when real codes surface.
- **Real district polygons for islands**: the GeoJSON gives one big blob per archipelago (Açores/Madeira) rather than per IPMA sub-region. Would need a different data source to fix.
- **Filters** (by district/type/level), **PWA/offline**, **dark mode**, **push notifications**, **history/archive**, **RSS**, **proper OG image**.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
