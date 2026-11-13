// Generates the Spanish (AEMET) warning zones drawn on /mapa and the table of
// Spanish zones neighbouring each Portuguese district. Run again when AEMET
// changes its zones or after changing the concelho/sea-band GeoJSONs:
//
//   curl -s -A "Fogos.pt/3.0" -o scripts/data/aemet-zones.json \
//     "https://api.fogos.pt/v2/warnings/aemet/zones?peninsula=1"
//   node scripts/build-spain-zones.mjs [input.json]
//
// Input: scripts/data/aemet-zones.json (or the path given), the Fogos.pt API's
// GeoJSON of the 192 peninsular AEMET zones (MultiPolygon, lon/lat, 2
// decimals; properties code/name/ccaa/province/coastal). Saved once so the
// output is deterministic (same input → same files).
//
// Outputs:
//   public/data/es-zones.geojson — one feature per zone, properties code,
//     name, province, ccaa, coastal and anchor ([lat, lng] for the icon pill,
//     an interior point of the largest part). How:
//       0. input snapped to its 0.01° grid and simplified topologically
//          (topoSimplify: each border between two zones simplified once, so
//          neighbours keep sharing it — no gaps or overlaps), TOPO_NEAR in
//          western Spain and TOPO_FAR elsewhere, to fit ~150 KB;
//       1. land zones − Portuguese land (union of the concelhos of
//          public/data/pt-continental.geojson, the polygons the map draws), so
//          Spain never paints over or under a Portuguese polygon;
//       2. sea zones ("…C") − (Portuguese land ∪ Spanish land zones ∪
//          public/data/sea-bands.geojson), so they never cover land or the
//          Portuguese sea bands (AEMET's Miño and Huelva coastal zones reach
//          into Portuguese waters);
//       3. the cut edges (which follow the dense Portuguese outline)
//          simplified by SIMPLIFY (≈ 200 m), clipped again (simplifying moves
//          edges), PRECISION decimals, rebuilt valid (polyclip union of the
//          geometry with itself, parts touching at a vertex separated),
//          parts under MIN_PART_KM2 dropped.
//   src/data/borderZones.js — BORDER_ZONES[ipmaCode] = AEMET codes, for every
//     continental district with Spanish neighbours:
//       - a land zone counts when its drawn geometry is within BORDER_KM of
//         the district (union of its concelhos);
//       - a coastal zone counts when its land twin (code without "C") does and
//         the district has a sea band (SEA_AREAS);
//     ordered north → south by the centroid latitude of the land zone, each
//     coastal zone right after its land twin.
// @turf/turf is a devDependency used only here and in tests — never in the bundle.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import * as turf from '@turf/turf'

import { CONTINENTAL_CODES, codeFromContinentalName } from '../src/data/ipmaAreas.js'
import { SEA_AREAS } from '../src/data/seaAreas.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p), 'utf8'))
const INPUT = process.argv[2] ?? 'scripts/data/aemet-zones.json'
const OUT_GEOJSON = 'public/data/es-zones.geojson'
const OUT_TABLE = 'src/data/borderZones.js'

// The spec's starting point was 5 km; at 5 km the coarse AEMET outlines also
// bring in zones that only come near the border without reaching it —
// Rias Baixas (4.4 km off Vila Nova de Cerveira, beyond A Guarda) and Interior
// de Pontevedra (2.6 km off Melgaço) for Viana do Castelo, Montaña de Ourense
// (3.8 km off Chaves) for Vila Real. Every real neighbour overlaps the
// Portuguese outline (distance 0), so 2 km keeps them all with margin.
const BORDER_KM = 2
const SIMPLIFY = 0.002
// AEMET's zones come already coarse (0.01° grid, vertices 3–10 km apart);
// to fit the size budget they are simplified further, topologically (see
// topoSimplify), and more away from Portugal, where the map shows them
// small: arcs reaching west of NEAR_LON (western Spain: Galicia, Castile and
// León, Extremadura, western Andalusia) by TOPO_NEAR (~500 m), the rest by
// TOPO_FAR (~2 km).
const NEAR_LON = -5.5
const TOPO_NEAR = 0.005
const TOPO_FAR = 0.02
const topoTolerance = (arc) => (arc.some(([x]) => x < NEAR_LON) ? TOPO_NEAR : TOPO_FAR)
const PRECISION = 4
const MIN_PART_KM2 = 1

const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)

const polygonsOf = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
const dedupe = (ring) => ring.filter((c, i) => i === 0 || c[0] !== ring[i - 1][0] || c[1] !== ring[i - 1][1])
// Rings without repeated points; [] when the outer ring is degenerate.
const rings = (p) => {
	const [outer, ...holes] = p.map(dedupe)
	return outer.length >= 4 ? [outer, ...holes.filter((r) => r.length >= 4)] : []
}
const toGeometry = (polys) => (polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys })
const km2 = (g) => turf.area(g) / 1e6
const bboxesMeet = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]

// Valid (Multi)Polygon from possibly broken rings, without parts < MIN_PART_KM2
// (null when nothing is left).
function rebuild(geometry) {
	const parts = polygonsOf(geometry).map(rings).filter((p) => p.length > 0)
	if (parts.length === 0) return null
	const mp = turf.multiPolygon(parts)
	const fixed = turf.union(turf.featureCollection([mp, mp]))
	const polys = polygonsOf(fixed?.geometry)
		.map(rings)
		.filter((p) => p.length > 0 && km2(turf.polygon(p)) >= MIN_PART_KM2)
	return polys.length ? untouch(toGeometry(polys)) : null
}

// polyclip keeps parts that touch at a vertex (e.g. AEMET's two parts of
// Sistema Central de Salamanca), which turf.booleanValid rejects: drop the
// shared vertex of the smaller part by two points UNTOUCH° along its edges
// (cuts a corner of a few tens of metres).
const UNTOUCH = 0.0003
function untouch(geometry) {
	if (geometry.type === 'Polygon' || turf.booleanValid(turf.feature(geometry))) return geometry
	const key = (c) => `${c[0]},${c[1]}`
	const toward = (c, d) => {
		const t = Math.min(0.5, UNTOUCH / Math.hypot(d[0] - c[0], d[1] - c[1]))
		return [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t].map((v) => Number(v.toFixed(PRECISION)))
	}
	const polys = [...geometry.coordinates].sort((a, b) => km2(turf.polygon(b)) - km2(turf.polygon(a)))
	const seen = new Set()
	const fixed = polys.map((p) => {
		const out = p.map((ring) => {
			const n = ring.length - 1
			const kept = ring
				.slice(0, -1)
				.flatMap((c, i) => (seen.has(key(c)) ? [toward(c, ring[(i - 1 + n) % n]), toward(c, ring[(i + 1) % n])] : [c]))
			return [...kept, kept[0]]
		})
		for (const ring of p) for (const c of ring) seen.add(key(c))
		return out.filter((r) => r.length >= 4)
	})
	const result = toGeometry(fixed.filter((p) => p.length > 0))
	if (!turf.booleanValid(turf.feature(result))) throw new Error('could not separate touching parts')
	return result
}

function minus(geometry, blocker) {
	if (!bboxesMeet(turf.bbox(geometry), blocker.bbox)) return geometry
	return turf.difference(turf.featureCollection([turf.feature(geometry), blocker]))?.geometry ?? null
}

// Interior point for the icon pill: turf.pointOnFeature of the largest part
// (its bbox centre, when inside). pointOnFeature falls back to a vertex — on
// the edge — so then take the middle of the widest interior run of a few
// horizontal lines across the part.
function anchorOf(geometry) {
	const largest = polygonsOf(geometry)
		.map((p) => turf.polygon(p))
		.sort((a, b) => turf.area(b) - turf.area(a))[0]
	const round = ([x, y]) => [Number(x.toFixed(PRECISION)), Number(y.toFixed(PRECISION))]
	const inside = (c) => turf.booleanPointInPolygon(turf.point(c), largest, { ignoreBoundary: true })
	const p = round(turf.pointOnFeature(largest).geometry.coordinates)
	if (inside(p)) return [p[1], p[0]]
	const [, minY, , maxY] = turf.bbox(largest)
	const runs = []
	for (const t of [0.5037, 0.3519, 0.6481, 0.2063, 0.7937]) {
		const y = minY + (maxY - minY) * t
		const xs = []
		for (const ring of largest.geometry.coordinates) {
			for (let i = 1; i < ring.length; i++) {
				const [[x1, y1], [x2, y2]] = [ring[i - 1], ring[i]]
				if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
			}
		}
		xs.sort((a, b) => a - b)
		for (let i = 0; i + 1 < xs.length; i += 2) runs.push({ width: xs[i + 1] - xs[i], at: round([(xs[i] + xs[i + 1]) / 2, y]) })
	}
	const best = runs.sort((a, b) => b.width - a.width).find((r) => inside(r.at))
	if (!best) throw new Error('no interior anchor')
	return [best.at[1], best.at[0]]
}

// --- Portuguese geometry -----------------------------------------------------
const concelhos = read('public/data/pt-continental.geojson').features.filter((f) => f.geometry)
const districts = new Map()
for (const f of concelhos) {
	const code = codeFromContinentalName(f.properties.dis_name)
	if (!code) throw new Error(`unknown district ${f.properties.dis_name}`)
	if (!districts.has(code)) districts.set(code, [])
	districts.get(code).push(f)
}
const ptLand = turf.union(turf.featureCollection(concelhos))
ptLand.bbox = turf.bbox(ptLand)
const seaBands = read('public/data/sea-bands.geojson').features
log('Portuguese land union')

// --- AEMET zones -------------------------------------------------------------
// A few input vertices are a hair off the 0.01° grid (-2.600001): snap them so
// both sides of every border share exactly the same vertices.
const snap = (geometry) => turf.truncate(turf.feature(geometry), { precision: 2, coordinates: 2 }).geometry
const raw = read(INPUT)
	.features.map((f) => ({ ...f, geometry: rebuild(snap(f.geometry)) }))
	.sort((a, b) => (a.properties.code < b.properties.code ? -1 : 1))
const simplified = topoSimplify(
	raw.map((f) => f.geometry),
	topoTolerance
)
const input = raw.map((f, i) => ({ ...f, geometry: rebuild(simplified[i]) }))
log('AEMET zones simplified')
const isCoastal = (f) => f.properties.coastal === true

// Douglas–Peucker (planar, degrees) of an open line, endpoints kept.
function douglasPeucker(line, tolerance) {
	if (line.length <= 2) return line
	const keep = new Uint8Array(line.length)
	keep[0] = keep[line.length - 1] = 1
	const stack = [[0, line.length - 1]]
	while (stack.length) {
		const [a, b] = stack.pop()
		const [[x1, y1], [x2, y2]] = [line[a], line[b]]
		const len = Math.hypot(x2 - x1, y2 - y1)
		let worst = -1
		let far = 0
		for (let i = a + 1; i < b; i++) {
			const [x, y] = line[i]
			const d = len === 0 ? Math.hypot(x - x1, y - y1) : Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / len
			if (d > far) [far, worst] = [d, i]
		}
		if (worst > 0 && far > tolerance) {
			keep[worst] = 1
			stack.push([a, worst], [worst, b])
		}
	}
	return line.filter((_, i) => keep[i])
}

// A closed ring split at the fixed vertices (isFixed(i)), each run between
// two of them simplified by simplifyRun(run) — a run starts and ends on a
// fixed vertex. Without fixed vertices the ring is one run from start(ring).
// Null when the ring collapses (fewer than 3 distinct points): it is then
// dropped on every side — a sliver whose borders all simplified away.
function simplifyRing(ring, isFixed, simplifyRun, start) {
	const n = ring.length - 1
	const fixed = []
	for (let i = 0; i < n; i++) if (isFixed(i)) fixed.push(i)
	if (fixed.length === 0) fixed.push(start(ring))
	const out = []
	for (let k = 0; k < fixed.length; k++) {
		const [a, b] = [fixed[k], fixed[(k + 1) % fixed.length]]
		const run = []
		for (let i = a; ; i = (i + 1) % n) {
			run.push(ring[i])
			if (run.length > 1 && i === b) break
		}
		out.push(...simplifyRun(run).slice(0, -1))
	}
	out.push(out[0])
	return out.length >= 4 ? out : null
}

// Applies ringFn to every ring; a polygon whose outer ring collapses is
// dropped, as is a collapsed hole.
function mapRings(geometry, ringFn) {
	const polys = polygonsOf(geometry)
		.map((p) => p.map(ringFn))
		.filter((p) => p[0])
		.map((p) => p.filter(Boolean))
	return polys.length ? toGeometry(polys) : null
}

// Topology-preserving simplification of every zone at once: the input is on
// a 0.01° grid, so neighbouring zones share their border vertices exactly.
// Rings are cut at the vertices where the set of zones sharing the edge
// changes (or that 3+ rings meet at), and each such arc is simplified once,
// in a canonical direction, so both sides of a border stay identical (no
// gaps or overlaps between Spanish zones).
function topoSimplify(geometries, toleranceFor) {
	const key = (c) => `${c[0]},${c[1]}`
	const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
	const all = geometries.flatMap((g) => polygonsOf(g).flat())
	const edgeRings = new Map()
	const vertexRings = new Map()
	const add = (map, k, i) => (map.get(k) ?? map.set(k, new Set()).get(k)).add(i)
	all.forEach((ring, i) => {
		for (let j = 1; j < ring.length; j++) {
			add(edgeRings, edgeKey(key(ring[j - 1]), key(ring[j])), i)
			add(vertexRings, key(ring[j]), i)
		}
	})
	const sig = (a, b) => [...edgeRings.get(edgeKey(key(a), key(b)))].sort((x, y) => x - y).join(',')
	const cache = new Map()
	const simplifyArc = (run) => {
		const ks = run.map(key)
		const closed = ks[0] === ks[ks.length - 1]
		const reverse = closed ? ks[ks.length - 2] < ks[1] : ks[0] > ks[ks.length - 1]
		const canon = reverse ? [...run].reverse() : run
		const id = (reverse ? [...ks].reverse() : ks).join(';')
		if (!cache.has(id)) {
			const tolerance = toleranceFor(canon)
			// A closed arc needs a second fixed point: its farthest vertex.
			let simplified
			if (closed) {
				const far = canon.reduce((best, c, i) => (Math.hypot(c[0] - canon[0][0], c[1] - canon[0][1]) > Math.hypot(canon[best][0] - canon[0][0], canon[best][1] - canon[0][1]) ? i : best), 0)
				simplified = [...douglasPeucker(canon.slice(0, far + 1), tolerance).slice(0, -1), ...douglasPeucker(canon.slice(far), tolerance)]
			} else {
				simplified = douglasPeucker(canon, tolerance)
			}
			cache.set(id, simplified)
		}
		const s = cache.get(id)
		return reverse ? [...s].reverse() : s
	}
	const minKey = (ring) => ring.slice(0, -1).reduce((best, c, i) => (key(c) < key(ring[best]) ? i : best), 0)
	return geometries.map((g) =>
		mapRings(g, (ring) => {
			const n = ring.length - 1
			const isNode = (i) => vertexRings.get(key(ring[i])).size >= 3 || sig(ring[(i - 1 + n) % n], ring[i]) !== sig(ring[i], ring[i + 1])
			return simplifyRing(ring, isNode, simplifyArc, minKey)
		})
	)
}

// After clipping, the cut edges follow the dense Portuguese outline: simplify
// only the runs between vertices of AEMET's 0.01° grid (already simplified
// by topoSimplify), so borders between Spanish zones are left alone.
const onGrid = (c) => Math.abs(c[0] * 100 - Math.round(c[0] * 100)) < 1e-6 && Math.abs(c[1] * 100 - Math.round(c[1] * 100)) < 1e-6
const simplifyCuts = (geometry) =>
	mapRings(geometry, (ring) =>
		simplifyRing(
			ring,
			(i) => onGrid(ring[i]),
			(run) => douglasPeucker(run, SIMPLIFY),
			() => 0
		)
	)

function finish(geometry, blocker) {
	let g = geometry && minus(geometry, blocker)
	if (!g) return null
	g = rebuild(simplifyCuts(g))
	g = g && minus(g, blocker)
	g = g && turf.truncate(turf.feature(g), { precision: PRECISION, coordinates: 2 }).geometry
	return g && rebuild(g)
}

const out = new Map()
for (const f of input.filter((z) => !isCoastal(z))) out.set(f.properties.code, finish(f.geometry, ptLand))
log('land zones clipped')

const esLand = turf.union(turf.featureCollection([...out.values()].filter(Boolean).map((g) => turf.feature(g))))
const seaBlock = turf.union(turf.featureCollection([ptLand, esLand, ...seaBands]))
seaBlock.bbox = turf.bbox(seaBlock)
for (const f of input.filter(isCoastal)) out.set(f.properties.code, finish(f.geometry, seaBlock))
log('sea zones clipped')

const features = input.map((f) => {
	const { code, name, province, ccaa } = f.properties
	const geometry = out.get(code)
	if (!geometry) throw new Error(`${code}: nothing left after clipping`)
	if (!turf.booleanValid(turf.feature(geometry))) throw new Error(`${code}: invalid geometry`)
	return {
		type: 'Feature',
		properties: { code, name, province, ccaa, coastal: isCoastal(f), anchor: anchorOf(geometry) },
		geometry,
	}
})

const json = JSON.stringify({ type: 'FeatureCollection', features })
fs.writeFileSync(path.join(root, OUT_GEOJSON), json + '\n')
log(`${OUT_GEOJSON}: ${features.length} zones, ${(json.length / 1024).toFixed(0)} KB, gzip ${(gzipSync(json).length / 1024).toFixed(0)} KB`)

// --- Border table -------------------------------------------------------------
const byCode = new Map(features.map((f) => [f.properties.code, f]))
const lat = (code) => turf.centroid(byCode.get(code)).geometry.coordinates[1]
const table = {}
for (const code of CONTINENTAL_CODES) {
	const own = districts.get(code)
	const district = own.length === 1 ? own[0] : turf.union(turf.featureCollection(own))
	const near = turf.buffer(district, BORDER_KM, { units: 'kilometers', steps: 16 })
	const nearBox = turf.bbox(near)
	const land = features
		.filter((f) => !f.properties.coastal && bboxesMeet(turf.bbox(f), nearBox) && turf.booleanIntersects(f, near))
		.map((f) => f.properties.code)
		.sort((a, b) => lat(b) - lat(a) || (a < b ? -1 : 1))
	if (land.length === 0) continue
	table[code] = land.flatMap((z) => (SEA_AREAS.includes(code) && byCode.has(`${z}C`) ? [z, `${z}C`] : [z]))
}

const name = (z) => byCode.get(z).properties.name
for (const [code, list] of Object.entries(table)) console.log(`${code}: ${list.map((z) => `${z} ${name(z)}`).join(' · ')}`)

const body = Object.entries(table)
	.map(([code, list]) => `\t${code}: [${list.map((z) => `'${z}'`).join(', ')}],`)
	.join('\n')
const source = `// GENERATED by scripts/build-spain-zones.mjs — do not edit by hand; re-run the
// script. For every continental IPMA district with Spanish neighbours, the
// AEMET zones (public/data/es-zones.geojson) that border it: land zones within
// ${BORDER_KM} km of the district, plus the coastal zone ("…C") of each of them
// when the district has a sea band. North → south, coastal zones right after
// their land twin. Districts without Spanish neighbours are absent.

export const BORDER_KM = ${BORDER_KM}

export const BORDER_ZONES = {
${body}
}

export function borderZones(code) {
	return (Object.hasOwn(BORDER_ZONES, code ?? '') && BORDER_ZONES[code]) || []
}
`
fs.writeFileSync(path.join(root, OUT_TABLE), source)
log(`${OUT_TABLE}: ${Object.keys(table).length} districts`)
