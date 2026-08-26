# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Small React 18 SPA (Vite + Tailwind 3 + react-router 6) that renders the currently active weather warnings for Portugal continental. Deployed as a static site on **Cloudflare Pages** at https://avisos.pt.

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

**Required secret**: `FOGOS_API_KEY` set in the CF Pages dashboard for Production **and** Preview. If missing, all `/api/*` endpoints return `500 {"error":"missing_api_key"}` — the proxy fails loud on purpose (no silent fallback).

No `public/_redirects`. If you add client-side routes beyond `/`, add `public/_redirects` with `/* /index.html 200`.

## Runtime architecture

### Server side (`functions/`)

- `functions/_fogos.js` — shared `proxyFogos({ env, path, cacheSeconds, transform?, label })` helper. Handles missing key (500), fetch failures (502), 30s timeout, logs status, sets `cache-control`, optionally transforms the JSON before returning it.
- `functions/api/warnings.js` → `/v2/warnings/ipma`, 5 min cache.
- `functions/api/stations.js` → `/v2/weather/stations/ipma`, 1 h cache (catalog rarely changes).
- `functions/api/observations.js` → `/v2/weather/observations`, 10 min cache. **Trims to the latest hour server-side** — upstream returns 24 h × ~100 stations (~1 MB); we return `{ hour, stations }` for just the most recent hour to keep the wire payload tight.

### Client side

- `src/pages/index.jsx` — single route `/`. Fires all three fetches on mount in parallel via one `AbortController`. Warnings failure blocks the page (error state + retry); stations/observations failures degrade silently — the observation strip just doesn't render.
- `src/components/warnings/`:
  - `DistrictOverview.jsx` — chip grid at top; one chip per continental district colored by that district's worst active warning level (gray if none). Active chips are anchor links to the district's group (`#<code>`).
  - `DistrictGroup.jsx` — heading + observation strip + card grid for one district.
  - `WarningCard.jsx` — native card (colored top bar by level, FA icon by type, no external image).
  - `ObservationStrip.jsx` — compact temp/wind/precip/humidity from the nearest station to that district.
  - `StateEmpty` / `StateLoading` / `StateError` — respective UI states.
- `src/data/`:
  - `ipmaAreas.js` — `IPMA_AREAS`: 18 continental districts with `{name, lat, lng}` centroid. Island codes not yet mapped. Order = N→S (canonical render order for both overview grid and district groups).
  - `levels.js` — `LEVELS`: yellow/orange/red visual metadata + `priority` for worst-of comparison. Includes `green` as the baseline for the overview grid (never appears in FogosPT data).
  - `warningTypes.js` — `awarenessTypeName` → FA icon + friendly label.
- `src/utils/`:
  - `geo.js` — `haversineKm`, `nearestStationWithObs(centroid, stations, obs)`.
  - `format.js` — `-99` sentinel filter, temp/wind/humidity/precip/timestamp formatters, wind direction id → cardinal.

### District → nearest station correlation

FogosPT doesn't tag stations with area codes. We compute nearest station spatially: `areaCentroid(code)` from `ipmaAreas.js` + haversine against every station in the catalog that has observations for the latest hour. `nearestStationWithObs` returns the best match (or null if no station has current data for that area). Centroids are approximate — they only need to pick the right nearest station, not to be cartographically accurate.

### FogosPT warning shape (from `/v2/warnings/ipma`)

Flat array. Each item:

```js
{ text, awarenessTypeName, idAreaAviso, awarenessLevelID, startTime, endTime }
```

- `awarenessLevelID` ∈ `"yellow" | "orange" | "red"`. **`"green"` never appears** — the endpoint filters it out.
- Timestamps are ISO without timezone (`2026-08-26T13:49:00`), interpreted as local Portugal time.
- Only warnings with `endTime >= now` are returned. Empty array = no active warnings.

### FogosPT observation shape (as trimmed by our proxy)

```js
{ hour: '2026-08-26T13:00', stations: { '<idEstacao>': { temperatura, humidade, pressao, precAcumulada, intensidadeVento, intensidadeVentoKM, idDireccVento, radiacao } } }
```

- **`-99` in any numeric field means "no reading"** — always filter through `isValid()` in `utils/format.js` before displaying or aggregating.
- Missing stations for an hour are silently absent from the `stations` map — code must tolerate ausence.
- `idDireccVento`: `0=no wind, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W, 8=NW, 9=N`.

## Style

- **Tabs**, **no semicolons** — matches `.editorconfig` + `.prettierrc`. Match this style when editing.
- Tailwind color aliases: `primary` (indigo), `secondary` (rose), `tertiary` (teal), `gray` (slate). Reach for these names.
- Tailwind classes constructed from lookup objects (e.g. `LEVELS[…].bar`) must contain **full literal class strings** for JIT to detect them — never string-concatenate class names at runtime.
- CSS is a single `src/index.css` imported from `src/main.jsx`; Tailwind JIT handles the rest.
- Font Awesome 6 icons load via CDN in `index.html` (`fas` prefix).

## Not yet implemented

- **Islands (Madeira, Açores)**: `IPMA_AREAS` only maps the 18 continental districts. Warnings for unknown codes still render at the bottom of the page (fallback to raw code as name) but don't get a chip in the overview or a nearest-station match. Add entries when real codes surface.
- **True SVG map**: the overview is a chip grid, not a geographic map. Slot in an SVG-per-district layer when the design/asset is ready — the data model (`worstLevelId(warnings)` + `LEVELS[…].bar`) already gives per-district colors.
- **Filters, history, RSS/PWA/dark mode, push notifications** — all discussed but not built.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
