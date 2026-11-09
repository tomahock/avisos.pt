import { IPMA_AREAS, codeFromContinentalName } from '../../data/ipmaAreas.js'
import { codeForFeature } from '../../data/islandConcelhos.js'

// Where to put an area's warning-icon pill, as [lat, lng].
//
// - Island zones: the hand-picked IPMA_AREAS[code].iconAt. Computing them from
//   polygons doesn't work: Madeira's north/south/mountain zones don't follow
//   concelhos, group bboxes land in the sea, and some concelhos are
//   MultiPolygons with far-flung islets (Funchal includes the Selvagens at
//   ~30°N, which pushed the Costa Sul icon off the Madeira map).
// - Continental districts: centre of the bounding box of all their
//   municipalities, so the icon sits inside the district rather than on the
//   (often coastal) capital.
// - Fallback: the area's lat/lng.

function bboxOf(coords, box = [Infinity, Infinity, -Infinity, -Infinity]) {
	if (typeof coords[0] === 'number') {
		box[0] = Math.min(box[0], coords[0])
		box[1] = Math.min(box[1], coords[1])
		box[2] = Math.max(box[2], coords[0])
		box[3] = Math.max(box[3], coords[1])
	} else {
		for (const c of coords) bboxOf(c, box)
	}
	return box
}

function continentalAnchors(geojson) {
	const boxes = new Map()
	for (const f of geojson?.features ?? []) {
		const code = codeForFeature(f, codeFromContinentalName)
		if (!code || !f.geometry || IPMA_AREAS[code]?.region !== 'continental') continue
		boxes.set(code, bboxOf(f.geometry.coordinates, boxes.get(code)))
	}
	const anchors = new Map()
	for (const [code, b] of boxes) anchors.set(code, [(b[1] + b[3]) / 2, (b[0] + b[2]) / 2])
	return anchors
}

// Map code → [lat, lng] for every area, given one map's GeoJSON.
export function areaAnchors(geojson) {
	const computed = continentalAnchors(geojson)
	const anchors = new Map()
	for (const [code, area] of Object.entries(IPMA_AREAS)) {
		anchors.set(code, area.iconAt ?? computed.get(code) ?? [area.lat, area.lng])
	}
	return anchors
}
