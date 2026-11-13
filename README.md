# Avisos.pt

Site com os avisos meteorológicos do IPMA em vigor em Portugal — **<https://avisos.pt>**.

- **Avisos** por distrito/região, com página e link próprios para cada distrito e cada aviso; nos distritos raianos, também os avisos da AEMET do outro lado da fronteira
- **Ocorrências de proteção civil** por tempo adverso: da ANEPC nos distritos do continente e, na Madeira, do SRPC, IP-RAM (ocorrências das últimas 24 h e o evento em curso: números, estradas cortadas, comunicados, recomendações)
- **Cronologia** hora a hora dos avisos
- **Histórico** das alterações aos avisos: emitidos, agravados, desagravados, prolongados, retirados e terminados (desde 11/11/2026)
- **Mapa** com os avisos de agora e dos próximos dias (também os de Espanha, da AEMET), ícones por tipo, o mar junto à costa pintado nos avisos de agitação marítima, estações meteorológicas e, na Madeira, as ocorrências por freguesia
- **Estações meteorológicas** do IPMA: leitura atual, gráficos hora a hora e diários, rankings
- **Critérios** de emissão de avisos do IPMA

Código aberto — **contribuições são bem-vindas**. Ver [Contribuir](#contribuir).

## Stack

Vite + React 18 + Tailwind 3, publicado em **Cloudflare Pages**. As Pages Functions em `functions/` fazem de proxy para a [API do Fogos.pt](https://fogos.pt/pt/api) (a chave nunca chega ao browser), geram as meta tags de cada página no servidor e as imagens de partilha. Mais detalhes de arquitetura em [`CLAUDE.md`](CLAUDE.md).

## Configuração

Precisas de uma chave da API do Fogos.pt: pede em <https://fogos.pt/pt/api>.

- **Produção** (dashboard do Cloudflare Pages): secret **`FOGOS_API_KEY`** em Settings → Variables and Secrets (Production **e** Preview).
- **Local**: copiar `.dev.vars.example` para `.dev.vars` e preencher. `.dev.vars` está no `.gitignore`.

## Comandos

```bash
npm install
npm run dev       # só o Vite — /api/* não funciona aqui
npm run dev:cf    # wrangler + Vite — /api/*, meta tags e imagens funcionam (lê .dev.vars)
npm run build     # gera ./dist
npm run preview   # serve ./dist
npm run lint
npm test          # testes unitários, de componentes e das functions (Vitest)
npm run test:e2e  # testes no browser (Playwright) — depois de npm run build
npm run test:all  # tudo o que corre na CI
node scripts/build-stations.mjs   # regenera estação → distrito e o sitemap das estações
node scripts/build-sea-bands.mjs  # regenera as faixas de mar (largura em src/data/seaAreas.js)
node scripts/build-spain-zones.mjs # regenera as zonas da AEMET e a vizinhança dos distritos (ver o script)
```

## Deploy

O Cloudflare Pages faz o build a cada push para `main` (`npm run build`, saída `dist`, Node ≥ 18). As definições do projeto estão em [`wrangler.toml`](wrangler.toml).

## Contribuir

Ideias, correções e melhorias são muito bem-vindas — não é preciso programar para ajudar: reportar um erro ou um dado estranho também conta.

- Vê os [issues abertos](https://github.com/tomahock/avisos.pt/issues) ou abre um novo
- Lê o [`CONTRIBUTING.md`](CONTRIBUTING.md) para preparar o ambiente e abrir um Pull Request

## Créditos dos dados

- **Avisos meteorológicos e observações das estações**: [IPMA — Instituto Português do Mar e da Atmosfera](https://www.ipma.pt), através da [API do Fogos.pt](https://fogos.pt/pt/api) ([código](https://github.com/FogosPT/fogosapi))
- **Ocorrências de proteção civil** (fenómenos meteorológicos adversos): [ANEPC](https://www.prociv.gov.pt), através da [API do Fogos.pt](https://fogos.pt/pt/api)
- **Ocorrências e eventos de proteção civil na Madeira**: [SRPC, IP-RAM](https://www.procivmadeira.pt), através da [API do Fogos.pt](https://fogos.pt/pt/api); localização aproximada pelo centroide da freguesia (CAOP, [DGT](https://www.dgterritorio.gov.pt), calculado pelo Fogos.pt)
- **Avisos meteorológicos de Espanha** (mapa e distritos junto à fronteira) e respetivas zonas: [AEMET (Agencia Estatal de Meteorología)](https://www.aemet.es), através da [API do Fogos.pt](https://fogos.pt/pt/api) — Fonte: AEMET
- **Limites dos concelhos**: [FrancisPais/geojson-portugal-continental](https://github.com/FrancisPais/geojson-portugal-continental) e [FrancisPais/geojson-portugal-arquipelagos](https://github.com/FrancisPais/geojson-portugal-arquipelagos)
- **Costa de Espanha** (para delimitar as faixas de agitação marítima no mapa): [Natural Earth](https://www.naturalearthdata.com) (domínio público)
- **Mapa base**: © contribuidores do [OpenStreetMap](https://www.openstreetmap.org/copyright)
- **Ícones**: [Font Awesome Free](https://fontawesome.com) e [Material Symbols](https://fonts.google.com/icons) (onda da agitação marítima, Apache-2.0) · **Tipo de letra**: Fira Sans

Pormenores e licenças de terceiros em [`NOTICE`](NOTICE).

## Licença

Copyright (C) 2021-2026 Tomahock e contribuidores.

Código aberto em **[GNU AGPL-3.0-or-later](LICENSE)**, com um termo adicional de atribuição (secção 7(b)): qualquer cópia, versão modificada ou serviço em rede baseado neste código tem de publicar o código-fonte e manter visível "Baseado no Avisos.pt, por Tomahock" com o link para este repositório. Ver [NOTICE](NOTICE).
