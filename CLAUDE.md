# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Small React 18 SPA (Vite + Tailwind 3 + react-router 6) that renders the currently active weather warnings for Portugal. Deployed as a static site on **Cloudflare Pages** at https://avisos.pt.

The root `README.md` is empty — this file is the only overview.

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:3000
npm run build    # outputs to ./dist
npm run preview  # serve ./dist locally
npm run lint     # eslint src
```

No test setup is wired up.

## Deploy

Cloudflare Pages builds this repo from git. Build command is `npm run build`, output directory is `dist/`. There is no per-branch preview logic in the repo — CF Pages handles it. **Pushing to the deploy branch is a production action** — confirm before pushing if the user hasn't already asked for it.

There is no `_redirects` or `_headers` file. If you add client-side routes beyond `/`, you'll need a `public/_redirects` with `/* /index.html 200` so Cloudflare Pages does SPA fallback — otherwise deep-links 404.

## Runtime architecture

Single wired route in `src/main.jsx`: `/` → `src/pages/index.jsx`. Everything else in the app is component scaffolding (`src/layouts/index.jsx` → `Header` + `Footer`).

`src/pages/index.jsx` on mount fetches `https://bot-api.vost.pt/getAlertas.php` (VOST Portugal warning bot API — no auth, no key). The response is an array of districts, each with `local` and `alertas[]`; every alarm has `tipo`, `nivel`, `descricao`, `inicio`, `fim`. One card is rendered per alarm.

### Warning image URL rules (fragile — read before editing)

Images come from `https://bot-api.vost.pt/images/warnings/Twitter_Post_Aviso{level}_{type}.png`, where `{type}` is built by:

1. `TYPE_FILENAME_OVERRIDES` renames applied first (currently `Precipitação→Chuva`, `Agitação Marítima→AgitacaoMaritima`, `Tempo Quente→TempoQuente`).
2. Accents stripped via `String.normalize('NFD')` + combining-mark removal.

If VOST adds a new `tipo` whose filename isn't just the accent-stripped form, you must add an override — accent-stripping alone won't cover it (see `Precipitação`/`Chuva`: entirely different word).

## Style

- **Tabs**, **no semicolons** — matches `.editorconfig` + `.prettierrc`. Match this style when editing.
- Tailwind color aliases in `tailwind.config.js`: `primary` (indigo), `secondary` (rose), `tertiary` (teal), `gray` (slate — was `blueGray` in Tailwind 2, renamed upstream in v3). Reach for these names instead of hardcoding.
- CSS is a single `src/index.css` imported from `src/main.jsx` — Tailwind JIT handles everything.

## Parent workspace note

This project lives inside `~/Projects/Tomahock/` (see the root `CLAUDE.md`). Never run npm commands from that parent — always from `avisos.pt/` (or with an absolute path). Commits are scoped to this repo only.
