# Avisos de Espanha (AEMET) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the AEMET (Spain) warnings on the continental `/mapa`, which then draws the whole Spanish peninsula, and add a «Do outro lado da fronteira» section to the pages of the districts on the Spanish border.

**Architecture:** A new Pages Function proxies `/v2/warnings/aemet?peninsula=1`; the data has the same shape as `/v2/warnings/ipma`. A build script (turf, the same pattern as `build-sea-bands.mjs`) writes two files: the Spanish zone geometry clipped against Portugal (`public/data/es-zones.geojson`), and the district → neighbouring zones table (`src/data/borderZones.js`). The map gets a Spain layer: land zones in their own pane under the Portuguese polygons, sea zones in the sea pane. The period picker counts Portugal + Spain. The district page gets a `BorderWarnings` section, which reuses `WarningCard` through an AEMET variant.

**Tech Stack:** React 18, react-leaflet, Tailwind 3, Vite, Cloudflare Pages Functions, @turf/turf (script only), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-avisos-espanha-design.md`

## Global Constraints

- Branch `feat/avisos-espanha` (issue #56). Commit messages: `feat(espanha): … (#56)` / `test(espanha): …` / `docs(espanha): …`, each ending with the session's `Co-Authored-By` line. Code style: the house style (tabs, no semicolons; see existing files).
- Before every commit, run `npm run lint` (max-warnings 0) and `npm test`. Run E2E with `npm run build && npx playwright test <spec>`, and run the full suite (`npm run test:all`) in Task 7.
- Every AEMET item uses the IPMA keys `text`, `awarenessTypeName`, `idAreaAviso` (AEMET zone code, coastal codes end in `C`), `awarenessLevelID`, `startTime`, `endTime` (Lisbon wall-clock, no offset). The extra keys are `areaName`, `phenomenon`, `parameter`, `probability`. A `parameter` ending in `": "` (no value, as on coastal warnings) counts as absent.
- AEMET failures must never affect Portuguese content. The map without Spain and the district page without the section must render exactly as on `main`, and the existing tests must keep passing.
- Spanish zones never cover Portuguese polygons. Land zones go in pane `es-zones` (z-index 395, between the sea-bands pane at 390 and the overlay pane at 400). Sea zones go in the existing `sea-bands` pane.
- Credits: "Fonte: AEMET" in every Spanish popup and in the section. The text `AEMET (Agencia Estatal de Meteorología), via Fogos.pt` goes in NOTICE, the README and the footer.
- `@turf/turf` is never imported from `src/`.
- Not in scope: the home page, cronologia, histórico, the aviso page, OG images, sitemap, Spanish stations, Baleares and Canárias, translation, sharing Spanish warnings.

## Review Focus

1. **AEMET API fails or returns `[]`.** The map shows Portugal unchanged with no Spain layer, and the period picker uses PT-only periods. On the district page the section shows its own error with a retry, or «Sem avisos do outro lado da fronteira». Test `map_without_spain_when_aemet_fails` (Task 6) and `section_error_keeps_page` (Task 4).
2. **A day tab exists only because of Spain.** The tab exists, its badge says e.g. "2 zonas em Espanha · amarelo", the Portuguese map shows nothing for that day, and the empty text says «Sem avisos em Portugal neste período.». Test `spain_only_day_has_a_tab` (Task 5).
3. **Unmapped phenomenon** (`awarenessTypeName` = "Polvo en suspensión"). The card, popup and icon fall back to the generic icon and show the Spanish name. Test `unmapped_type_renders` (Task 4).
4. **Coastal warning with an empty parameter.** No «Limiar:» line is shown. Test `empty_parameter_hidden` (Task 3).
5. **Border clipping.** Points in Portugal close to the border (Valença, Melgaço, Miranda do Douro, Elvas, Vila Real de Santo António) fall in no Spanish land zone. Points just inside Spain (Tui, Badajoz) fall in exactly one. Test `clipped_zones_leave_portugal` (Task 2).

---

### Task 1: Proxy, fixtures and mock route

**Files:**
- Create: `functions/api/aemet/warnings.js`
- Modify: `tests/fixtures/data.js` (add `aemetWarnings`), `tests/fixtures/fogos.js` (route), `tests/helpers/api.js` (`'/api/aemet/warnings'` → the new module), `tests/functions/api.test.js`

**Interfaces:**
- Produces: `GET /api/aemet/warnings`, which proxies `/v2/warnings/aemet?peninsula=1` with `cacheSeconds: 300`, `transform: activeWarnings`, `label: 'aemet-warnings'`. `makeFixtures().aemetWarnings` is built with the existing `w()` helper, plus `areaName`, `phenomenon`, `parameter` and `probability`:
  - `674901` Sanabria, Vento, orange, −1 h → +10 h, `"Rachas máximas: 90 km/h"`, `"40%-70%"`
  - `713603C` Costa - Miño de Pontevedra, Agitação Marítima, yellow, −2 h → +20 h, parameter `"Costeros: "`
  - `713202` Miño de Ourense, Precipitação, yellow, +54 h → +60 h — after the last PT `endTime` (FAR, +30 h), so its calendar day has a tab only because of Spain
  - `612103` Litoral de Huelva, `"Polvo en suspensión"`, yellow, −1 h → +8 h, phenomenon `VS`
  - `701001` Norte de Cáceres, Precipitação, yellow, −30 h → −1 h (already ended; must be dropped)
  - Don't change the existing PT `warnings` (other tests depend on them).

- [ ] **Step 1: Write the failing test.** In `tests/functions/api.test.js`, add `describe('/api/aemet/warnings')` with:
  - `test('proxies the peninsula warnings and drops ended ones')`: the upstream URL called is `/v2/warnings/aemet?peninsula=1`, the result contains no `701001`, and the other 4 are kept.
  - `test('upstream error → 502')`.
- [ ] **Step 2: Run.** `npx vitest run tests/functions/api.test.js` fails (module missing).
- [ ] **Step 3: Implement** the function, the fixture, the route and the helper mapping.
- [ ] **Step 4: Run.** `npx vitest run tests/functions/api.test.js` passes; `npm test` passes.
- [ ] **Step 5: Commit.** `feat(espanha): proxy /api/aemet/warnings e fixtures (#56)`

### Task 2: Zone geometry and border table (script)

**Files:**
- Create: `scripts/build-spain-zones.mjs`, `scripts/data/aemet-zones.json` (raw input, saved once from `https://api.fogos.pt/v2/warnings/aemet/zones?peninsula=1` with a `User-Agent`; the script reads this file, so the output is deterministic), `public/data/es-zones.geojson`, `src/data/borderZones.js`, `src/data/spainNames.js`, `src/data/borderZones.test.js`

**Interfaces:**
- Produces:
  - `public/data/es-zones.geojson`: a FeatureCollection. Each feature's properties are `code`, `name`, `province`, `ccaa`, `coastal` (bool) and `anchor` ([lat, lng] for the icon pill, from `turf.pointOnFeature` of the clipped geometry). Coordinates have 4 decimals. Land zones are clipped by the Portuguese land union (the concelhos of `public/data/pt-continental.geojson`). Sea zones are clipped by Portuguese land, by the Spanish land zones and by `public/data/sea-bands.geojson`. Simplify (tolerance ~0.002°) and rebuild valid geometry. Target ≤ ~150 KB.
  - `src/data/borderZones.js`: `export const BORDER_ZONES = { VCT: ['713603', '713603C', …], … }`, keyed by continental IPMA code and ordered north → south by centroid latitude. Rules:
    - a land zone counts when its distance to the district (union of the district's concelhos) is ≤ `BORDER_KM = 5`;
    - a coastal zone counts when its land twin (the code without `C`) is in the list **and** the district has a sea band.

    Also export `export function borderZones(code): string[]` (returns `[]` for unknown codes).
  - `src/data/spainNames.js`: `CCAA_PT = { '61': 'Andaluzia', '67': 'Castela e Leão', '70': 'Estremadura', '71': 'Galiza' }`, plus the other CCAA codes that appear in the input with their Portuguese names. `PROVINCE_PT` maps the INE province code to its name for every province in the input; use the usual Portuguese exonyms where they exist (Ourense, Pontevedra, Zamora, Salamanca, Cáceres, Badajoz, Huelva, Sevilha, Corunha, Lugo, Leão…).

    Also export `ccaaName(code)`, `provinceName(code)` and `zoneLabel(feature)`.
- Output the script prints: the BORDER_ZONES table and the output size.

- [ ] **Step 1: Write the failing tests** in `src/data/borderZones.test.js`:
  - `pins the neighbours of every border district`: `expect(BORDER_ZONES).toEqual({...})` with the table the script generated. Run the script first, review the table by hand against the spec's expected list, and record any difference (for example BGC + Meseta de Salamanca) in a comment. `LSB`, `PTO`, `STB` and `SRT` are absent.
  - `clipped_zones_leave_portugal` (Review Focus 5): with `turf.booleanPointInPolygon` on `es-zones.geojson`, the points Valença `[-8.645, 42.028]`, Melgaço `[-8.26, 42.11]`, Miranda do Douro `[-6.274, 41.494]`, Elvas `[-7.163, 38.881]` and VRSA `[-7.418, 37.194]` fall in no land zone. Tui `[-8.645, 42.047]` and Badajoz `[-6.97, 38.879]` each fall in exactly one.
  - `geometry is valid, every zone present`: 192 features; every geometry passes `turf.booleanValid`; codes are unique.
  - `sea zones never overlap Portuguese sea bands`: for every coastal zone, `turf.intersect` with each sea band has area < 1 km².
  - `names`: `ccaaName('71') === 'Galiza'`, and `provinceName` of Pontevedra's code is `'Pontevedra'`.
- [ ] **Step 2: Run.** `npx vitest run src/data/borderZones.test.js` fails.
- [ ] **Step 3: Implement** the script, run `node scripts/build-spain-zones.mjs`, and commit the generated files.
- [ ] **Step 4: Run.** `npx vitest run src/data/borderZones.test.js` passes; `npm run lint && npm test` pass.
- [ ] **Step 5: Commit.** `feat(espanha): zonas da AEMET recortadas e tabela de vizinhança dos distritos (#56)`

### Task 3: Spain utilities and data hook

**Files:**
- Create: `src/utils/spain.js`, `src/utils/spain.test.js`, `src/hooks/useAemetWarnings.js`, `src/hooks/useSpainZones.js`

**Interfaces:**
- Consumes: `BORDER_ZONES`, `spainNames` (Task 2), and `sortWarnings` / `activeWarnings` (`src/utils/share.js`).
- Produces:
  - `parameterText(w): string|null`. Returns null for null, empty, or ending in `":"` / `": "`.
  - `probabilityText(w): string|null`. `"40%-70%"` → `"40–70 %"`.
  - `borderGroups(code, warnings, zonesMeta): Array<{ code, name, province, warnings: sorted[] }>`. One entry per `BORDER_ZONES[code]` entry, in table order. `zonesMeta` is a `Map` from code to `{ name, province, ccaa }` built from `es-zones.geojson` properties. When metadata is missing, fall back to the warning's `areaName`, then to the code.
  - `borderRegions(code, zonesMeta): string[]`. The distinct `ccaaName`s of the district's border zones, in table order.
  - `useAemetWarnings(): { warnings: array|null, error: string|null, retry: () => void }`. It fetches `/api/aemet/warnings`, passes the result through `useActiveWarnings`, and refreshes every 5 min (`REFRESH_MS = 5 * 60 * 1000`).
  - `useSpainZones(): Map|null`. It fetches `/data/es-zones.geojson` once and builds the meta map. It is null while loading or on failure.

- [ ] **Step 1: Write the failing tests.** `spain.test.js`:
  - `empty_parameter_hidden` (Review Focus 4): `parameterText({ parameter: 'Costeros: ' }) === null`.
  - `parameterText` returns `'Rachas máximas: 90 km/h'` unchanged.
  - `probabilityText({ probability: '40%-70%' }) === '40–70 %'`.
  - `borderGroups('BGC', fixtureWarnings, meta)` returns the BGC groups in table order, with Sanabria's orange warning in Sanabria's group and empty `warnings` for the others.
  - `borderRegions('VCT', meta)` equals `['Galiza']`.
- [ ] **Step 2: Run.** `npx vitest run src/utils/spain.test.js` fails.
- [ ] **Step 3: Implement** them.
- [ ] **Step 4: Run.** It passes; `npm run lint && npm test` pass.
- [ ] **Step 5: Commit.** `feat(espanha): utilitários e hooks dos avisos da AEMET (#56)`

### Task 4: «Do outro lado da fronteira» section

**Files:**
- Create: `src/components/district/BorderWarnings.jsx`, `tests/pages/border-warnings.test.jsx`, `e2e/fronteira.spec.js`
- Modify: `src/components/warnings/WarningCard.jsx` (add an AEMET variant), `src/pages/distrito.jsx` (render `<BorderWarnings code={code} />` right after the PT warnings block, before `DistrictIncidents`)

**Interfaces:**
- Consumes: `useAemetWarnings`, `useSpainZones`, `borderGroups`, `borderRegions`, `parameterText` and `probabilityText` (Task 3), and `BORDER_ZONES` (Task 2).
- Produces: `WarningCard({ warning, source = 'ipma' })`. With `source === 'aemet'`:
  - the title is plain text, not a link, and the «Partilhar» link is gone;
  - after the text it shows `Limiar: <parameterText>` when present and `Probabilidade: <probabilityText>` when present;
  - the footer shows `<period> · Fonte: AEMET`.

  The IPMA rendering must be byte-identical (the existing tests guard it).
- Section markup:
  - `<section aria-labelledby="fronteira">` with `<h2 id="fronteira">Do outro lado da fronteira <span aria-label="Espanha">🇪🇸</span></h2>`, and a subtitle listing `borderRegions` joined with " · ";
  - per group: an `<h3>` with the zone name and a `<span>` with the province, then a card grid like the PT one (`grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3`), or «Sem avisos» when the zone has none;
  - when no group has warnings, a single message «Sem avisos do outro lado da fronteira», followed by the list of watched zones.
  - The section renders nothing for districts not in `BORDER_ZONES`. While loading it shows a small loading line. On error it shows «Não foi possível carregar os avisos de Espanha.» with a «Tentar de novo» button that calls `retry`.

- [ ] **Step 1: Write the failing tests.** `tests/pages/border-warnings.test.jsx`, using `renderRoute` and the api helper:
  - `Bragança shows the section with Sanabria orange`: the heading «Do outro lado da fronteira» is visible; the group «Sanabria» contains «Vento», «Aviso laranja», «Limiar: Rachas máximas: 90 km/h», «Probabilidade: 40–70 %» and «Fonte: AEMET»; there is no «Partilhar» inside the section.
  - `Lisboa has no section`.
  - `unmapped_type_renders` (Review Focus 3): the Faro section shows «Polvo en suspensión».
  - `section_error_keeps_page` (Review Focus 1): with `/api/aemet/warnings` mocked to 502, the error message and retry are shown, and the PT warnings section is still present.
  - `empty_parameter_hidden` in context: Viana's «Costa - Miño de Pontevedra» card has no «Limiar».

  `e2e/fronteira.spec.js` (`@responsive`): Bragança section visible with the Sanabria card; on mobile there is no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 2: Run.** `npx vitest run tests/pages/border-warnings.test.jsx` fails.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run.** Vitest passes, then `npm run build && npx playwright test e2e/fronteira.spec.js` passes, then `npm run lint && npm test`.
- [ ] **Step 5: Commit.** `feat(espanha): secção «Do outro lado da fronteira» nos distritos raianos (#56)`

### Task 5: Period picker counts Spain

**Files:**
- Modify: `src/pages/mapa.jsx` (load AEMET warnings without blocking; periods from PT+ES; empty text), `src/components/map/MapPeriodPicker.jsx` (badge with PT and ES counts), `src/utils/timeline.test.js` only if needed (do not change existing expectations)
- Test: `tests/pages/map-periods.test.jsx` (create)

**Interfaces:**
- Consumes: `useAemetWarnings` (Task 3).
- Produces:
  - `MapPeriodPicker({ periods, warnings, spainWarnings = [], selected, onSelect })`. The badge's worst level is taken over both lists. The text is built from the parts that exist: `N região/regiões`, `M zona/zonas em Espanha`, then `· <nível>`. With neither, it shows «Sem avisos».
  - In `mapa.jsx`: `periods = mapPeriods([...(warnings ?? []), ...(spainWarnings ?? [])], now)`, `periodSpain = warningsInPeriod(spainWarnings ?? [], period)`. The empty text is `isNow ? 'Sem avisos em vigor.' : 'Sem avisos neste período.'` when Spain also has nothing. When only Spain has warnings in the period, it is `isNow ? 'Sem avisos em vigor em Portugal.' : 'Sem avisos em Portugal neste período.'`.

- [ ] **Step 1: Write the failing tests.** In `tests/pages/map-periods.test.jsx` (render `/mapa`):
  - `spain_only_day_has_a_tab` (Review Focus 2): there is a tab for the day of the Miño de Ourense fixture, its badge contains «1 zona em Espanha», and it does not contain «região».
  - `today badge counts both`: the «Hoje» tab contains «regiões» and «zonas em Espanha».
  - `picker falls back to PT when AEMET fails`: with `/api/aemet/warnings` mocked to 502, the tabs match what `mapPeriods(ptWarnings)` produces.
- [ ] **Step 2: Run.** It fails.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run.** It passes; `npm run lint && npm test` pass (the existing map and timeline tests are unchanged).
- [ ] **Step 5: Commit.** `feat(espanha): seletor de período do mapa conta com os avisos de Espanha (#56)`

### Task 6: Spain layer on the continental map

**Files:**
- Modify: `src/components/map/WarningsMap.jsx` (new prop `spain = null`, plus an `SpainLayer` component, pane `es-zones`, and icons), `src/pages/mapa.jsx` (fetch `/data/es-zones.geojson` without blocking; pass `spain={{ zones, warnings: periodSpain }}` only to the continental map), `src/components/map/MapLegend.jsx` (an «Espanha: avisos da AEMET» line when given `showSpain`), `src/components/map/anchors.js` only if the icon layer needs a helper
- Test: `e2e/espanha-mapa.spec.js` (create), `src/components/map/MapLegend.test.jsx` (extend; new test only)

**Interfaces:**
- Consumes: `es-zones.geojson` properties (`code`, `name`, `province`, `coastal`, `anchor`), `parameterText` / `probabilityText`, `seaBandStyle`, `districtStyle`-equivalent styling, `warningIcon` / `typesWithLevel` (local to `WarningsMap`; reuse them, do not copy).
- Produces:
  - `WarningsMap` prop `spain: { zones: FeatureCollection, warnings: array } | null`. When present, it adds `<LayersControl.Overlay checked name="Avisos em Espanha">`. That overlay contains:
    - a `<Pane name="es-zones" style={{ zIndex: 395 }}>` with the land zones (`!coastal`), styled by the worst level in `spain.warnings`. Zones without a warning get a light outline: `{ fillColor: '#ffffff', fillOpacity: 0.05, color: '#a8a29e', weight: 0.5, opacity: 0.6, dashArray: '2 3' }`.
    - the coastal zones that have a warning, in pane `sea-bands` with `seaBandStyle`.
    - the Spanish icon pills, at `anchor`, hidden below `MIN_ICON_ZOOM`.
  - Popup: `<zone name> (Espanha)`, the warnings list (type, text, period, Limiar, Probabilidade), and «Fonte: AEMET». There is no district link. Tooltip on hover: `<strong>zone</strong> (Espanha): <type list>` or «sem avisos».
  - Remount key built from codes + levels + startTimes, the same pattern as `DistrictLayer`.
  - `MapLegend({ showSpain = false })`.

- [ ] **Step 1: Write the failing tests.** `e2e/espanha-mapa.spec.js`:
  - `spanish zones are drawn under the Portuguese polygons @responsive`: the `.leaflet-es-zones-pane` z-index is between 390 and 400; it holds ≥ 150 paths; one path has `fill="#f97316"` (Sanabria orange, «Agora»).
  - `popup says Espanha and AEMET`: clicking the orange path shows a popup containing «Sanabria (Espanha)» and «Fonte: AEMET».
  - `layer toggle`: unchecking «Avisos em Espanha» leaves 0 paths in the es-zones pane, and the Portuguese paths are still there.
  - `coastal warning paints the sea`: the `sea-bands` pane has a yellow path for 713603C.
  - `period picker drives Spain`: on the Miño de Ourense day tab there is a yellow path in the es-zones pane, and no orange.
  - `map_without_spain_when_aemet_fails` (Review Focus 1): use `page.route('**/api/aemet/warnings', r => r.fulfill({ status: 502 }))`. Expect no «Avisos em Espanha» layer, the PT polygons drawn, and the same tabs as PT-only.

  `MapLegend.test.jsx`: `showSpain` renders «Espanha: avisos da AEMET»; without it, it doesn't.
- [ ] **Step 2: Run.** `npm run build && npx playwright test e2e/espanha-mapa.spec.js` fails.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run.** It passes; then `npx playwright test e2e/mapa.spec.js e2e/sea-bands.spec.js` pass unchanged; then `npm run lint && npm test`.
- [ ] **Step 5: Commit.** `feat(espanha): zonas da AEMET no mapa continental (#56)`

### Task 7: Credits, docs and full check

**Files:**
- Modify: `NOTICE`, `README.md` («Créditos dos dados»), `src/components/layout/Footer.jsx` (AEMET via Fogos.pt next to IPMA/ANEPC/SRPC), `CLAUDE.md` (describe the Spain layer, the period picker counting Spain, the `BorderWarnings` section, the `build-spain-zones` script and how to regenerate it, `/api/aemet/warnings`, the new tests, and the non-goals)
- [ ] **Step 1:** Make the edits, then add a footer test if `Footer` has one (grep `tests/` for «Créditos» or the footer); otherwise extend `tests/pages/routes.test.jsx` with `footer credits AEMET`.
- [ ] **Step 2: Run.** `npm run test:all` passes everything.
- [ ] **Step 3: Commit.** `docs(espanha): créditos da AEMET e CLAUDE.md (#56)`. Push and the PR happen after the final review.
