// Generates public/data/sea-bands.geojson: for every IPMA area that gets
// "Agitação Marítima" warnings, the strip of sea within SEA_BAND_KM of its
// coast. /mapa paints it with the area's worst sea-state level. Run after
// changing the band width or the concelho GeoJSONs:
//
//   node scripts/build-sea-bands.mjs
//
// How (all on the simplified concelho polygons the map draws, so bands meet
// the drawn coastline):
//   1. land  = union of every concelho (continent + islands) and of Spain
//      (scripts/data/spain-near-pt.geojson, Natural Earth, public domain —
//      without it the bands of Viana, Beja and Faro would spill over the
//      land border and the border itself would count as coast); holes left
//      between the two sources are filled
//   2. seeds = vertices of the land outline, each labelled with the area of
//      the concelho it comes from ("ES" for Spain's coast, which only blocks);
//      Voronoi cells of the seeds,
//      merged per area = "sea closer to this area's coast than to any other"
//   3. band  = (area buffered by SEA_BAND_KM) − land ∩ that area's cells
// so neighbouring bands don't overlap and meet without gaps. Seeds of areas
// without a sea warning zone (e.g. Santarém on the Tagus estuary) still
// claim their cells, so they get no band and don't leak it to others.
// @turf/turf is a devDependency used only here — never in the bundle.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import * as turf from '@turf/turf'

import { codeFromContinentalName } from '../src/data/ipmaAreas.js'
import { codeForFeature } from '../src/data/islandConcelhos.js'
import { SEA_AREAS, SEA_BAND_KM } from '../src/data/seaAreas.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
const OUT = 'public/data/sea-bands.geojson'
// Seeds come from a coarser outline (~400 m) — plenty for splitting the sea
// between neighbours and keeps the Voronoi small.
const SEED_TOLERANCE = 0.004
// Output simplification (~100 m) and coordinate precision (~10 m).
const OUT_TOLERANCE = 0.001
const PRECISION = 4
// Drop slivers left by the subtraction (km²).
const MIN_PART_KM2 = 0.5
// The Selvagens belong to Funchal (→ MCS) but sit 280 km south, off the
// Madeira map and outside IPMA's Costa Sul sea zone: no band there.
const SELVAGENS_LAT = 31

const features = [...read('public/data/pt-continental.geojson').features, ...read('public/data/pt-arquipelagos.geojson').features]
	.filter((f) => f.geometry)
	.map((f) => turf.feature(f.geometry, { code: codeForFeature(f, codeFromContinentalName) }))

// Grown by SPAIN_GROW_KM so it closes the border rivers (Minho, Guadiana):
// the two sources don't share a border line, and the gap between them would
// otherwise count as sea. Overlapping Portuguese land is harmless.
const SPAIN_GROW_KM = 1.5
const spain = read('scripts/data/spain-near-pt.geojson').features.map((f) =>
	turf.feature(turf.buffer(f, SPAIN_GROW_KM, { units: 'kilometers' }).geometry, { code: 'ES' })
)

const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
// Remove consecutive repeated points (closing point kept).
const dedupe = (ring) => ring.filter((c, i) => i === 0 || c[0] !== ring[i - 1][0] || c[1] !== ring[i - 1][1])

const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)

// Union, then drop interior rings (slivers between the PT and ES outlines).
const merged = turf.union(turf.featureCollection([...features, ...spain]))
const land = turf.multiPolygon(
	(merged.geometry.type === 'Polygon' ? [merged.geometry.coordinates] : merged.geometry.coordinates).map((p) => [p[0]])
)
log('land union')

// Every concelho vertex → its area, for labelling seeds.
const vertexCode = new Map()
for (const f of features) {
	if (!f.properties.code) continue
	turf.coordEach(f, ([x, y]) => vertexCode.set(`${x},${y}`, f.properties.code))
}
// Simplification keeps original vertices, so PT seeds match exactly; the rest
// are Spain's coast (or a PT/ES junction) and only block.
const labelFor = ([x, y]) => vertexCode.get(`${x},${y}`) ?? 'ES'

const outline = turf.simplify(land, { tolerance: SEED_TOLERANCE, highQuality: false })
const seen = new Set()
const seeds = []
turf.coordEach(outline, (c) => {
	const k = `${c[0]},${c[1]}`
	if (seen.has(k)) return
	seen.add(k)
	seeds.push(turf.point(c, { code: labelFor(c) }))
})
log(`${seeds.length} seeds`)

const cells = turf.voronoi(turf.featureCollection(seeds), { bbox: [-33, 29, -5, 44] })
const cellsByCode = new Map()
cells.features.forEach((cell, i) => {
	if (!cell) return
	const code = seeds[i].properties.code
	if (!SEA_AREAS.includes(code)) return
	if (!cellsByCode.has(code)) cellsByCode.set(code, [])
	cellsByCode.get(code).push(cell)
})
log('voronoi')

const out = []
for (const code of SEA_AREAS) {
	const own = features.filter((f) => f.properties.code === code)
	const mine = cellsByCode.get(code)
	if (own.length === 0 || !mine) throw new Error(`${code}: no polygons or no coast`)
	const area = own.length === 1 ? own[0] : turf.union(turf.featureCollection(own))
	const buffered = turf.buffer(area, SEA_BAND_KM, { units: 'kilometers', steps: 16 })
	const sea = turf.difference(turf.featureCollection([buffered, land]))
	const zone = turf.union(turf.featureCollection(mine))
	let band = sea && zone ? turf.intersect(turf.featureCollection([sea, zone])) : null
	if (!band) throw new Error(`${code}: empty band`)
	band = turf.simplify(band, { tolerance: OUT_TOLERANCE, highQuality: true })
	band = turf.truncate(band, { precision: PRECISION, coordinates: 2 })
	// Rounding can collapse small rings and make edges cross: drop repeated
	// points and degenerate rings, then let polyclip rebuild valid rings
	// (union of the band with itself), dropping slivers and the Selvagens.
	const rings = (p) => p.map(dedupe).filter((r) => r.length >= 4)
	const parts = polygonsOf(band.geometry).map(rings).filter((p) => p.length > 0)
	const fixed = turf.union(turf.featureCollection([turf.multiPolygon(parts), turf.multiPolygon(parts)]))
	const polys = polygonsOf(fixed.geometry)
		.map(rings)
		.filter((p) => p.length > 0 && turf.area(turf.polygon(p)) / 1e6 >= MIN_PART_KM2 && !(code === 'MCS' && turf.centroid(turf.polygon(p)).geometry.coordinates[1] < SELVAGENS_LAT))
	const geometry = polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys }
	if (!turf.booleanValid(turf.feature(geometry))) throw new Error(`${code}: invalid geometry`)
	out.push({ type: 'Feature', properties: { code }, geometry })
	log(`${code}: ${polys.length} part(s), ${Math.round(turf.area(geometry) / 1e6)} km²`)
}

const json = JSON.stringify({ type: 'FeatureCollection', bandKm: SEA_BAND_KM, features: out })
fs.writeFileSync(path.join(root, OUT), json + '\n')
log(`${OUT}: ${(json.length / 1024).toFixed(0)} KB, gzip ${(gzipSync(json).length / 1024).toFixed(0)} KB`)
