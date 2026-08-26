# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Small React 18 SPA (Vite + Tailwind 3 + react-router 6) that renders the currently active weather warnings for Portugal. Deployed as a static site on **Cloudflare Pages** at https://avisos.pt.

A single Cloudflare Pages Function under `functions/api/warnings.js` proxies the [FogosPT API](https://fogos.pt/pt/api) so the API key never touches the browser.

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:3000 — /api/warnings WILL NOT work here
npm run dev:cf   # wrangler pages dev + vite; /api/warnings works, reads .dev.vars
npm run build    # outputs to ./dist
npm run preview  # serve ./dist locally
npm run lint
```

Warnings only load under `npm run dev:cf` (or in deployed CF Pages). Plain `npm run dev` will get a 200 on `/api/warnings` returning `index.html` (SPA fallback), which then fails to parse as JSON — that's expected, not a bug.

## Deploy

Cloudflare Pages builds this repo from git. Build command `npm run build`, output directory `dist`. Pushing to the deploy branch is a production action — confirm before pushing if the user hasn't already asked.

**Required secret**: `FOGOS_API_KEY` set in the CF Pages dashboard (Production **and** Preview). If missing, `/api/warnings` returns `500 {"error":"missing_api_key"}` — the function fails loud on purpose (no silent fallback).

No `public/_redirects` yet. If you add client-side routes beyond `/`, add `public/_redirects` with `/* /index.html 200` for SPA fallback.

## Runtime architecture

Single wired route in `src/main.jsx`: `/` → `src/pages/index.jsx`. Layout scaffolding lives in `src/layouts/index.jsx` + `src/components/layout/{Header,Footer}.jsx`.

### Warnings data flow

1. `src/pages/index.jsx` fetches `/api/warnings` (same origin, no key exposure).
2. `functions/api/warnings.js` (Pages Function) reads `FOGOS_API_KEY` from env, calls `https://api.fogos.pt/v2/warnings/ipma` with `X-API-Key` + `User-Agent: AvisosPT/1.0 (+https://avisos.pt)`, 30s timeout, forwards the response with `cache-control: public, max-age=300`.
3. The page groups warnings by `idAreaAviso` and renders one card per warning.

### FogosPT warning shape

Flat array. Each item:

```js
{ text, awarenessTypeName, idAreaAviso, awarenessLevelID, startTime, endTime }
```

- `awarenessLevelID` ∈ `"yellow" | "orange" | "red"`. **`"green"` never appears** — the endpoint filters it out.
- Timestamps are ISO strings **without timezone** (`2026-08-26T13:49:00`), interpreted as local Portugal time (JS `Date` treats them as local by spec — fine for a PT audience, off-by-hours for others).
- Only warnings with `endTime >= now` are returned. Empty array = no active warnings.

### Warning image URL rules (fragile — read before editing)

Card images still come from `https://bot-api.vost.pt/images/warnings/Twitter_Post_Aviso{levelLabel}_{type}.png` — the FogosPT API doesn't publish images, so we keep using VOST's pre-generated ones.

Two lookup tables in `src/pages/index.jsx`:

1. `LEVEL_LABEL`: `yellow→Amarelo`, `orange→Laranja`, `red→Vermelho` — FogosPT's English level maps to the Portuguese word in the filename.
2. `TYPE_FILENAME_OVERRIDES`: `Precipitação→Chuva`, `Agitação Marítima→AgitacaoMaritima`, `Tempo Quente→TempoQuente`. Applied **before** accent-stripping via `String.normalize('NFD')`.

If VOST adds a new `awarenessTypeName` whose filename isn't just the accent-stripped form, add an override — accent-stripping alone won't cover it (see `Precipitação`/`Chuva`: entirely different word).

### Area code lookup

`src/data/ipmaAreas.js` maps IPMA `idAreaAviso` codes (e.g. `BGC`) to human names (e.g. `Bragança`). The 18 continental districts are confirmed; **island codes are not yet mapped** — unknown codes fall back to the raw code in the UI. Add to `IPMA_AREA_NAMES` when new codes appear in real responses.

## Style

- **Tabs**, **no semicolons** — matches `.editorconfig` + `.prettierrc`. Match this style when editing.
- Tailwind color aliases: `primary` (indigo), `secondary` (rose), `tertiary` (teal), `gray` (slate — was `blueGray` in v2, renamed upstream). Reach for these names.
- Tailwind classes built from lookup objects (e.g. `LEVEL_BORDER`) must contain **full literal class strings** for JIT to detect them — never string-concatenate class names.
- CSS is a single `src/index.css` imported from `src/main.jsx`; Tailwind JIT handles the rest.

## Not implemented yet

The FogosPT integration guide also describes `/v2/weather/stations/ipma` and `/v2/weather/observations` for enriching warnings with nearby station readings. Not built — requires new UI (map or per-card station block). Add via separate PR when the design is decided.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
