// "Agitação Marítima" warnings → the sea band of each area on /mapa
// (geometry: public/data/sea-bands.geojson, scripts/build-sea-bands.mjs).
// DOM/React-free.

import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { LEVELS, worstLevelId } from '../data/levels.js'
import { SEA_WARNING_TYPE } from '../data/seaAreas.js'

/**
 * Sea-state warnings per area, for warnings already filtered to the selected
 * period: Map code → { level (worst), warnings }. Areas without one are absent.
 */
export function seaWarningsByCode(warnings) {
	const byCode = new Map()
	for (const w of warnings ?? []) {
		if (w?.awarenessTypeName !== SEA_WARNING_TYPE || !LEVELS[w.awarenessLevelID]) continue
		const entry = byCode.get(w.idAreaAviso)
		if (entry) entry.warnings.push(w)
		else byCode.set(w.idAreaAviso, { warnings: [w] })
	}
	for (const entry of byCode.values()) entry.level = worstLevelId(entry.warnings)
	return byCode
}

/** Bands of one map's region (continental / acores / madeira). */
export function bandsForRegion(collection, region) {
	return {
		type: 'FeatureCollection',
		features: (collection?.features ?? []).filter((f) => IPMA_AREAS[f.properties?.code]?.region === region),
	}
}

/** Leaflet path style of a band at a warning level. */
export function seaBandStyle(level) {
	const fill = LEVELS[level]?.fill ?? '#94a3b8'
	return { fillColor: fill, fillOpacity: 0.75, color: fill, weight: 1, opacity: 0.9 }
}
