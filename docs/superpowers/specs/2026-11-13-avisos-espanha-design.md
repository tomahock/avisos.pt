# Avisos de Espanha (AEMET) no avisos.pt — desenho

Issue: #56 · Depende de: FogosPT/fogosapi#102 (em produção desde 2026-11-13) · Estado: rascunho para aprovação

## Porquê

Os fenómenos meteorológicos não olham para fronteiras. Quem acompanha uma tempestade
a entrar por Trás-os-Montes ou calor vindo da Andaluzia quer perceber se do outro
lado da fronteira também há aviso e com que severidade — e, nos distritos raianos,
perceber **tudo** sobre esses avisos, como percebe os portugueses.

## Objetivos

1. **Mapa (`/mapa`, mapa continental)**: toda a Espanha peninsular desenhada — as
   192 zonas de aviso da AEMET (160 de terra, 32 de mar) —, sem aviso em contorno
   claro como os distritos portugueses, com aviso coloridas pelo pior nível no
   período escolhido.
2. **Página de cada distrito raiano** (`/distrito/<slug>`): secção **«Do outro lado
   da fronteira»** com os avisos completos das zonas espanholas vizinhas desse
   distrito.

## Não-objetivos

- Avisos espanhóis noutras páginas: início, `/cronologia`, `/historico`, página do
  aviso, OG images, sitemap (decidido com o utilizador: só mapa + distritos
  raianos).
- Estações meteorológicas espanholas (a API já as tem; fica para depois).
- Baleares e Canárias (o mapa continental não as enquadra; os mapas dos Açores e da
  Madeira ficam como estão).
- Traduzir o texto da AEMET (fica em espanhol, como a AEMET o publica).
- Partilha/permalink de avisos espanhóis.

## Anti-objetivos

- Um erro ou atraso da AEMET/API afetar o resto da página ou do mapa: os avisos
  portugueses são sempre a prioridade.
- Zonas espanholas a taparem polígonos portugueses (ou a pintarem terra portuguesa)
  junto à fronteira.
- Um aviso espanhol confundível com um português (sem dizer que é de Espanha/AEMET).

## Dados (Fogos.pt API, produção)

- `GET /v2/warnings/aemet?peninsula=1` — avisos em vigor ou previstos, **no formato
  de `/v2/warnings/ipma`** (`text`, `awarenessTypeName`, `idAreaAviso`,
  `awarenessLevelID`, `startTime`, `endTime` em hora de Lisboa sem offset), mais
  `areaName`, `phenomenon`, `parameter`, `probability`. `idAreaAviso` = código da
  zona AEMET (`713603`, costeiras com sufixo `C`: `713603C`). `awarenessTypeName` usa
  os nomes do IPMA quando há equivalente (Vento, Precipitação, Neve, Trovoada, Tempo
  Quente, Tempo Frio, Agitação Marítima, Nevoeiro); fenómenos sem equivalente vêm
  com o nome espanhol (ex. "Polvo en suspensión", "Deshielos", "Aludes",
  "Galernas"). `text` em espanhol. Atenção: nos avisos costeiros a AEMET não dá
  valor e `parameter` vem como `"Costeros: "` — tratar parâmetro sem valor como
  ausente.
- `GET /v2/warnings/aemet/zones?peninsula=1` — GeoJSON (MultiPolygon, lon/lat, 2
  casas decimais, ~180 KB) das 192 zonas: `code`, `name`, `ccaa`, `province`,
  `coastal`, `peninsula`.
- Licença: AEMET, reutilização livre citando a fonte — "Fonte: AEMET" (via Fogos.pt).

Medido a 2026-11-13: 21 avisos em vigor/previstos na Península.

## Desenho

### 1. Proxy

`functions/api/aemet/warnings.js` → `/v2/warnings/aemet?peninsula=1`, como
`functions/api/warnings.js` (`proxyFogos`, mesma cache, `activeWarnings()` como
transformação). Trim opcional aos campos usados.

### 2. Geometria e vizinhança: gerados por script

`node scripts/build-spain-zones.mjs` (no molde de `build-sea-bands.mjs`;
`@turf/turf` só no script), a correr de novo quando a AEMET mudar zonas:

- Lê as zonas da API de produção (ou de um ficheiro passado por argumento) e escreve
  **`public/data/es-zones.geojson`**: só `code` (+ `name`, `province`, `coastal` nas
  properties), coordenadas a 3–4 casas, geometria válida.
- **Junto à fronteira**: as zonas de terra são recortadas pela terra portuguesa
  (união dos concelhos que o mapa desenha), para não pintarem Portugal nem taparem
  polígonos portugueses; as zonas de mar são recortadas pela terra (portuguesa e
  espanhola) e pelas faixas de mar portuguesas (`sea-bands.geojson`) para não se
  sobreporem a elas.
- Gera também **`src/data/borderZones.js`**: para cada código IPMA continental, a
  lista ordenada de zonas AEMET vizinhas — zonas de terra a ≤ `BORDER_KM` (ponto de
  partida 5 km) do distrito, e as zonas costeiras (`…C`) que tocam a faixa de mar do
  distrito ou são o mar das zonas de terra vizinhas desse distrito costeiro. Ordem:
  norte → sul (latitude do centroide). Distritos sem vizinhas não aparecem.
- Valor esperado (a confirmar pelo script; `borderZones.test.js` fixa o resultado
  gerado, revisto à mão):
  - VCT: Miño de Pontevedra, Costa — Miño de Pontevedra, Miño de Ourense, Sur de Ourense
  - BRG, VRL, BGC: zonas de Ourense (Sur, Montaña) e de Zamora (Sanabria, Meseta)
  - GDA: Meseta de Salamanca, Norte de Cáceres
  - CBR, PTG, EVR: Cáceres e Badajoz (Norte de Cáceres, Tajo y Alagón, Meseta
    cacereña, Vegas del Guadiana, Sur de Badajoz)
  - BJA: Sur de Badajoz, Aracena, Andévalo y Condado
  - FAR: Andévalo y Condado, Litoral de Huelva, Costa — Litoral de Huelva
- Determinístico (mesmo input → mesmos ficheiros). Tamanho alvo do GeoJSON ≤ ~120 KB
  (gzip bem menos).

### 3. Mapa

Só o mapa continental (`WarningsMap` com uma nova prop, ex. `spain`), em
`pages/mapa.jsx`:

- `/api/aemet/warnings` e `/data/es-zones.geojson` carregados **sem bloquear o mapa**
  (como `sea-bands`); falha de qualquer um → mapa português intacto, sem camada de
  Espanha (sem erro visível além de, opcionalmente, nada).
- **O seletor de período conta com Espanha** (decisão do utilizador): os separadores
  de dia (`mapPeriods`) são calculados sobre a lista PT + ES, por isso um dia só com
  avisos espanhóis tem separador; o selo de cada separador mostra o **pior nível dos
  dois países** e a contagem separada, ex. "3 regiões · 5 zonas em Espanha" (só a
  parte que existir). `?dia=` valida contra estes separadores. Os avisos espanhóis
  passam pelo mesmo `warningsInPeriod`. Se a API AEMET falhar, o seletor é o de hoje
  (só PT). Os textos vazios do mapa ("Sem avisos em vigor.") continuam a falar dos
  avisos portugueses; um período só com avisos espanhóis não mostra mensagem de
  vazio enganadora (ex. "Sem avisos em Portugal neste período.").
- Camada **«Avisos em Espanha»** no controlo de camadas, ligada por defeito:
  - zonas de terra num pane próprio por baixo do overlay pane (polígonos portugueses
    sempre por cima), estilo dos distritos: sem aviso → contorno claro, com aviso →
    pior nível do período (mesmas cores/opacidade de `districtStyle`);
  - zonas de mar (`…C`) no pane do mar (`sea-bands`) com o estilo das faixas
    (`seaBandStyle`), desenhadas só quando têm aviso no período (como as faixas
    portuguesas) — sem aviso, nada **obedecem só ao interruptor «Avisos em Espanha»** (um
    interruptor por país; o «Agitação marítima (mar)» continua a ser só o português)
    — decisão minha;
  - tooltip e popup como os dos distritos: `<nome da zona> (Espanha)`, lista dos
    avisos (tipo, texto, período, parâmetro e probabilidade), "Fonte: AEMET". Sem link
    "Ver página de…".
- **Ícones dos avisos** (`WarningIconsLayer`): também para as zonas espanholas com
  aviso, mesma pílula, mesmo limiar de zoom; âncora = centro do bbox (ou
  `pointOnFeature`) da zona, calculado pelo script e guardado no GeoJSON
  (`properties.anchor`). Tipos sem equivalente IPMA usam o ícone genérico
  (`warningTypeMeta` já faz fallback) com o nome espanhol no título.
- **Legenda** (`MapLegend`): linha "Espanha: avisos da AEMET".
- O mapa continua centrado em Portugal (enquadramento atual).

### 4. Secção «Do outro lado da fronteira»

`components/district/BorderWarnings.jsx`, na página do distrito **logo a seguir aos
avisos portugueses** (antes das ocorrências), só quando `borderZones[code]` existe:

- Título «Do outro lado da fronteira» + subtítulo com as comunidades autónomas
  (ex. "Galiza", "Castela e Leão", "Estremadura", "Andaluzia").
- **Um grupo por zona vizinha**, pela ordem de `borderZones`: nome da zona +
  província; dentro, os avisos dessa zona (todos os ativos, incluindo os que
  começam mais tarde — como os portugueses), ordenados como os portugueses
  (`sortWarnings`), em **cartões iguais aos portugueses** com mais detalhe:
  tipo (mesmo ícone), nível, período (hora de Portugal), texto da AEMET, **limiar**
  (`parameter`, omitido se vazio) e **probabilidade**, e "Fonte: AEMET".
  Sem link de partilha nem permalink (o `WarningCard` ganha uma variante, ex.
  `source="aemet"`, ou um `BorderWarningCard` que reutiliza as mesmas peças — ao
  construtor, sem duplicar o cartão).
- Zonas vizinhas sem aviso: linha «Sem avisos» no grupo.
- Nenhuma zona vizinha com aviso: a secção mostra «Sem avisos do outro lado da
  fronteira» (com a lista das zonas vigiadas).
- Dados: hook próprio (ex. `useAemetWarnings`) com o mesmo refresh e a mesma
  filtragem de expirados (`useActiveWarnings`) que os avisos portugueses. Carrega
  sem bloquear a página; erro → mensagem inline com "Tentar de novo", resto da
  página intacto.
- Bandeira/rótulo discreto a indicar Espanha (ex. "🇪🇸" ou "ES") no título — nunca
  confundível com avisos portugueses.

### 5. Créditos

"AEMET (Agencia Estatal de Meteorología), via Fogos.pt" no `NOTICE`, no README
("Créditos dos dados") e no rodapé, ao lado de IPMA/ANEPC/SRPC.

## Testes

- Vitest: `borderZones.test.js` fixa a vizinhança de cada distrito; testes do
  agrupamento/ordenação da secção; parâmetro vazio omitido; tipos sem equivalente;
  geometria gerada válida e sem sobreposição com a terra portuguesa (amostras de
  pontos portugueses junto à raia sem zona espanhola).
- Fixtures/mock (`tests/fixtures/data.js`, `tests/fixtures/fogos.js`): avisos AEMET
  (ex. laranja em Sanabria, amarelo costeiro em Costa — Miño de Pontevedra, um que
  começa amanhã, um "Polvo en suspensión") servidos em `/v2/warnings/aemet`.
- Playwright: mapa com zonas espanholas coloridas e por baixo das portuguesas,
  interruptor da camada, popup "(Espanha)" com "Fonte: AEMET", seletor de período a
  mudar Espanha; Bragança com a secção e os cartões; Lisboa sem secção; API AEMET em
  erro → secção com erro e resto da página normal; mapa sem a camada quando a API
  AEMET falha.

## Decisões tomadas sem o utilizador (para rever)

- Zonas de mar espanholas controladas só por «Avisos em Espanha».
- Nomes portugueses das comunidades autónomas (61 Andaluzia, 67 Castela e Leão,
  70 Estremadura, 71 Galiza, …) e das províncias numa tabela fixa (`ccaa`/`province`
  da API são códigos INE).
- Bragança pode ter também «Meseta de Salamanca» como vizinha (o Douro faz fronteira);
  a tabela gerada decide, revista à mão.
- O texto da AEMET fica em espanhol; parâmetro vazio ("Costeros: ") omitido.
- Avisos espanhóis sem partilha/permalink.

## Deixado ao construtor

- Nomes de componentes/hooks, forma da variante do cartão, cores exatas do contorno
  das zonas espanholas sem aviso (devem ler-se como "outro país", não competir com
  Portugal).
- Valor final de `BORDER_KM` e da simplificação, desde que a tabela de vizinhança
  bata com o esperado acima (ou a diferença seja justificada no PR).
- Se o script lê da API em produção ou de um ficheiro guardado (fica registado).

## Deploy

Site estático no Cloudflare Pages: merge para `main`. Sem variáveis novas (usa o
`FOGOS_API_KEY` existente). A API já está em produção.
