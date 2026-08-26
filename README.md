# Avisos.pt

Site que mostra os avisos meteorológicos em vigor em Portugal.

## Stack

Vite + React 18 + Tailwind 3, deploy em **Cloudflare Pages**. Um endpoint proxy corre como Cloudflare Pages Function (`functions/api/warnings.js`) para consumir a [API FogosPT](https://fogos.pt/pt/api) sem expor a chave no browser.

## Configuração

Precisas de uma chave da API FogosPT: pede em <https://fogos.pt/pt/api>.

- **Produção** (Cloudflare Pages dashboard): adicionar como secret **`FOGOS_API_KEY`** em Settings → Environment variables (Production **e** Preview).
- **Local**: copiar `.dev.vars.example` para `.dev.vars` e preencher. `.dev.vars` está gitignored.

## Comandos

```bash
npm install
npm run dev       # vite dev server (o /api/warnings não funciona aqui)
npm run dev:cf    # wrangler + vite (o /api/warnings funciona com .dev.vars)
npm run build     # gera ./dist
npm run preview   # serve ./dist localmente
npm run lint
```

Para trabalhar nos avisos localmente usa `npm run dev:cf` — Vite sozinho não sabe correr `functions/`.

## Deploy

Cloudflare Pages faz build automático em cada push. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. Node ≥ 18.
