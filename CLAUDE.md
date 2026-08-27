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
- `src/pages/mapa.jsx` — fetches warnings + stations + obs + both GeoJSONs in parallel and renders **three** `<WarningsMap>` instances: continental (big, full-width), Açores (side, filtered feature collection + bbox), Madeira (side).
- `src/components/warnings/*` — cards, groups, overview chips (three sections: continental, Açores, Madeira), observation strip, state components.
- `src/components/map/WarningsMap.jsx` — region-aware Leaflet map: takes `center/zoom/bounds/geojson/height`, filters stations by bbox, colors polygons per feature via `codeForFeature()`.
- `src/components/map/MapLegend.jsx` — overlay legend.
- `src/components/layout/{Header,Footer,Nav}.jsx` — Nav has links to `/` and `/mapa`.
- `src/data/`:
  - `ipmaAreas.js` — `IPMA_AREAS` (25 codes total: 18 continental + AOC/ACE/AOR + MCN/MCS/MRM/MPS) each with `name`/`chip`/`lat`/`lng`/`region`. `CONTINENTAL_CODES`, `ACORES_CODES`, `MADEIRA_CODES` slice by region. `codeFromContinentalName(disName)` resolves the CAOP `dis_name` for continental only.
  - `islandConcelhos.js` — `codeForFeature(feature, continentalResolver)` — for continental features it delegates to `dis_name` lookup; for island features it uses `con_name` → island subregion (per-concelho table). `MRM` (Madeira mountain zone) crosses concelho boundaries and is deliberately not mapped to polygons — MRM warnings still surface in the list/popups but don't get a colored polygon.
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

- **MRM polygon coloring**: Madeira's mountain warning zone crosses concelho boundaries; MRM warnings are surfaced textually but the map doesn't draw an MRM-colored region. A concelho-independent overlay would need a different data source.
- **Filters** (by district/type/level), **PWA/offline**, **dark mode**, **push notifications**, **history/archive**, **RSS**, **proper 1200×630 OG image**.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
