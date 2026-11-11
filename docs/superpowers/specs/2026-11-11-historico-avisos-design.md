# Histórico de avisos IPMA — desenho

Data: 2026-11-11 · Repos: `FogosPT/fogosapi` (dados + endpoint) e `avisos.pt` (página)

## Porquê

Durante a tempestade Charles houve avisos agravados e depois desagravados, e não havia forma de ver
essa evolução: o avisos.pt (e o feed do IPMA) só mostram o estado atual. Queremos perceber, para um
episódio, **a timeline de eventos**: quando cada aviso foi emitido, agravado, desagravado, prolongado,
retirado ou terminou, em que região e de que tipo.

## Objetivos

- Registar no fogosapi, a cada sync, um **log de eventos explícito** de alterações aos avisos IPMA.
- Guardar também as **alterações de texto** (mesmo que não sejam mostradas em lado nenhum).
- Expor esse log num endpoint público do fogosapi.
- Página `/historico` no avisos.pt com uma **timeline textual** filtrável.

## Não-objetivos

- **Sem histórico retroativo.** O log começa no deploy; a Charles anterior a isso não é reconstruída
  (decisão do utilizador). Não há comando de backfill.
- **Sem grelha tipo `/cronologia`** para o passado — só timeline textual (decisão do utilizador).
- Sem notificações, RSS ou exportação.
- A página de distrito não ganha uma secção própria — só um link (decisão minha).

## Anti-objetivos (falha mesmo que "funcione")

- Uma timeline cheia de ruído: o IPMA republica a cada emissão e "puxa" o `startTime` para agora —
  isso **não** pode gerar eventos visíveis.
- Eventos inventados por feeds vazios / em cache antigos (o sync já os ignora; o log tem de herdar essa
  proteção — nada é registado quando o sync sai cedo).
- Um agravamento aparecer como "retirado amarelo" + "emitido laranja" soltos em vez de um único
  "agravado amarelo → laranja".

## Parte 1 — fogosapi (PR em `FogosPT/fogosapi`)

### Contexto atual

`App\Jobs\HandleWeatherWarnings::sync()` (a cada 15 min) reconcilia o snapshot do IPMA com as linhas
ativas de `weather_warnings`, agrupadas por `(district, type, level)`: janelas emparelhadas por ordem de
início são atualizadas no sítio, janelas a mais são criadas, linhas a menos recebem `supersededAt`.
Uma mudança de nível hoje = linha do nível antigo com `supersededAt` + linha nova do nível novo.
Timezone da app: `Europe/Lisbon`.

### Nova coleção `weather_warning_events`

Modelo `App\Models\WeatherWarningEvent` (Mongo, mesmo estilo de `WeatherWarning`). Um documento por
evento:

| campo | descrição |
|---|---|
| `kind` | `emitido` · `agravado` · `desagravado` · `prolongado` · `encurtado` · `texto_alterado` · `retirado` · `terminado` |
| `district` | código IPMA da área (`LSB`, `MCN`, …) |
| `type` | `awarenessTypeName` (ex.: `Vento`) |
| `fromLevel` / `toLevel` | `yellow`/`orange`/`red`; `null` onde não se aplica (`emitido` não tem `from`, `retirado`/`terminado` não têm `to`) |
| `startTime` / `endTime` | janela depois do evento (para `retirado`/`terminado`: a última janela conhecida) |
| `previousEndTime` | para `prolongado`/`encurtado` (e agravado/desagravado, se mudou) |
| `text` / `previousText` | texto atual e anterior (sempre guardado em `texto_alterado`; nos outros, o texto vigente) |
| `reportDate` | o `reportDate` **mais recente do snapshot** que originou o evento (também para `retirado`: é a emissão que o deixou cair); `null` em `terminado` |
| `detectedAt` | hora do sync que detetou o evento |
| `occurredAt` | **o único campo de tempo para filtrar, ordenar e agrupar** (API e UI): `reportDate` quando existe, senão `detectedAt`; para `terminado`, o `endTime` da janela. Decisão minha |
| `warningId` / `previousWarningId` | `_id` das linhas de `weather_warnings` envolvidas |

Índices: `occurredAt` desc; `(district, occurredAt)`. Retenção: para sempre (volume pequeno).

### Regras de deteção (dentro do `sync`)

Os eventos derivam-se do diff que o sync já faz, agrupado por **`(district, type)`** (não por nível):

1. **Mudança de nível** — no mesmo `(district, type)`, uma linha que recebe `supersededAt` e uma linha
   criada neste mesmo sync cujas janelas **se sobrepõem** formam um par → `agravado` (nível sobe) ou
   `desagravado` (desce). Um evento por par, com `fromLevel`/`toLevel`.
2. **`emitido`** — linha criada sem par sobreposto.
3. **`retirado`** — linha com `supersededAt` sem par sobreposto (desapareceu antes do `endTime`).
4. **Atualização no sítio** (mesma linha):
   - `endTime` mudou → `prolongado` (mais tarde) ou `encurtado` (mais cedo), com `previousEndTime`.
   - `text` mudou → `texto_alterado`, com `text` e `previousText`. Pode coexistir com o anterior no
     mesmo sync (dois eventos).
   - Só `startTime`/`reportDate` mudaram → **nenhum evento** (é o ruído da republicação).
5. **`terminado`** — em cada sync que não saia cedo, linhas com `supersededAt` nulo, `endTime < now` e
   ainda sem evento de fim → evento `terminado` (`detectedAt = endTime`) e marcar a linha (ex.: campo
   `endedAt`) para não repetir.

Casos-limite deixados ao builder, com testes: uma janela amarela partida em amarelo+laranja+amarelo
(o laranja sobrepõe-se ao amarelo superseded → `agravado`; o resto deve sair como `prolongado`/
`encurtado`/`emitido` coerentes, sem duplicar), vários pares sobrepostos no mesmo `(district, type)`
(emparelhar pela maior sobreposição), e o caso de um sync que sai cedo (`isStale`, feed vazio, versão
mais antiga ignorada por `isOlder`) — **zero eventos**.

A escrita dos eventos não pode partir o sync: falha a gravar um evento → log/Sentry e continua.

### Endpoint `GET /v2/warnings/ipma/history`

Em `WarningsController`, rota no grupo `warnings` existente.

Parâmetros (todos opcionais):
- `from`, `to` — ISO date/datetime (Lisbon). Default: últimos 7 dias. Intervalo máximo 31 dias
  (pedidos maiores → 422).
- `area` — código IPMA (pode repetir/CSV).
- `type` — `awarenessTypeName` (CSV).
- `kind` — CSV de `kind`. **Default: todos exceto `texto_alterado`** (fica guardado mas não sai por
  omissão; pedível com `kind=texto_alterado`).

Resposta: array ordenado por `occurredAt` desc (e `from`/`to` filtram `occurredAt`), cada item com os campos da tabela (sem `_id` internos
além de um `id` string). Datas no mesmo formato de `/v2/warnings/ipma`: `Y-m-d\TH:i:s` em hora de
Lisboa, sem timezone. Cache Redis curta (≤ 5 min) é opcional, decisão do builder.

Documentar em `docs/` (OpenAPI, como os outros endpoints) e no `CLAUDE.md` do fogosapi.

### Testes

Unit tests do sync com snapshots sucessivos cobrindo cada `kind`, o ruído de republicação (zero
eventos), feeds stale/vazios (zero eventos) e os casos-limite acima. Feature test do endpoint
(filtros, default sem `texto_alterado`, limite de 31 dias).

## Parte 2 — avisos.pt (PR neste repo)

- **Proxy** `functions/api/warnings/history.js` → `/v2/warnings/ipma/history` via `proxyFogos`, cache
  5 min, passa os query params permitidos (`from`, `to`, `area`, `type`, `kind`) e nada mais.
- **Página `/historico`** (`src/pages/historico.jsx`, lazy em `main.jsx`):
  - Timeline textual agrupada por dia (mais recente primeiro). Cada linha, ex.:
    `14:32 · Lisboa · [ícone] Vento · amarelo → laranja · agravado` — níveis como chips com as cores de
    `LEVELS`, região com link para `/distrito/<slug>`, ícone via `<TypeIcon>`. Para `prolongado`/
    `encurtado`, mostrar o fim antigo → novo. `emitido` mostra a janela.
  - Hora mostrada e agrupamento por dia: `occurredAt`
    (decisão minha). Formatação com `parseWarningTime`/`formatWhen` (hora local do visitante, como o
    resto do site).
  - Filtros no URL, para partilhar a vista de um episódio: `?regiao=<slug>` (slugs de `ipmaAreas.js`),
    `?tipo=<slug do tipo>`, `?evento=agravado,desagravado,…`, período (`?de=AAAA-MM-DD&ate=AAAA-MM-DD`
    ou atalhos 24 h / 3 dias / 7 dias / 30 dias; default 7 dias). `texto_alterado` não é oferecido.
  - Estado vazio explica que o histórico só existe desde o arranque do registo; se o endpoint
    devolver erro/404 (fogosapi ainda não deployado), mostrar "histórico ainda não disponível" sem
    rebentar.
  - Dark mode e mobile seguindo as convenções do `CLAUDE.md` (`bg-surface`, sem `bg-white`, etc.).
- **Página de distrito**: link "Ver histórico" → `/historico?regiao=<slug>`.
- **Nav**: link "Histórico".
- **SEO**: `PAGE_META['/historico']` em `src/utils/share.js` (pública, indexável), middleware reconhece
  a rota, `public/sitemap.xml`, `usePageTitle`.
- **Docs**: `CLAUDE.md` (views, functions, data shapes do histórico) e README.

## Ordem de deploy

1. fogosapi (merge → deploy normal do `CLAUDE.md`; criar índices da coleção nova). O log começa aqui.
2. avisos.pt (push para o branch de deploy). Pode ir antes do 1 sem partir nada — a página mostra
   "ainda não disponível".

## Decisões minhas (para rever)

- Página pública e indexável.
- Distrito só ganha um link, não uma secção.
- Evento `terminado` registado (fecha a timeline de cada aviso).
- Um só tempo, `occurredAt` (= `reportDate` do snapshot / `detectedAt` / `endTime` em `terminado`), para filtrar, ordenar e mostrar.
- O trabalho no avisos.pt parte de `main` (o modo escuro, #30/#31, já está lá).
- `texto_alterado` fora do default da API e fora da UI.
- Default 7 dias, máximo 31 dias por pedido.

## Respostas do utilizador (2026-11-11)

- **Emparelhamento do sync pode mudar**: passa a emparelhar por sobreposição de janelas (dentro de
  `(district, type)`) em vez de posição na ordem de início, com testes de regressão do comportamento
  atual (stale/vazio/`isOlder`, Telegram STB só em criação real).
- **Margem de fim**: um aviso que desapareça do feed até **30 min** antes do `endTime` conta como
  `terminado`, não `retirado`.
- **Prioridade máxima — invariantes do `/v2/warnings/ipma`** (o que o avisos.pt mostra agora):
  1. **nunca duplicados em simultâneo**: no máximo uma entrada ativa por `(district, type)` a cobrir
     o mesmo instante (janelas sobrepostas do mesmo tipo/região não podem coexistir);
  2. **nunca expirados**: nada com `endTime < now` é servido.
  Estes invariantes têm testes próprios e o novo emparelhamento não os pode quebrar. O endpoint de
  leitura aplica-os também como defesa (filtro + colapso de sobrepostos), independentemente do sync.
