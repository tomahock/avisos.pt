// AEMET (Spain) warnings: display helpers and the "Espanha junto à
// fronteira" grouping of a Portuguese district's neighbouring zones.

import { borderZones } from '../data/borderZones.js'
import { ccaaName, provinceName } from '../data/spainNames.js'
import { sortWarnings } from './share.js'

// AEMET's parameter ("Rachas máximas: 90 km/h"). Coastal warnings carry no
// value ("Costeros: ") — a parameter ending in ":" is treated as absent.
export function parameterText(w) {
	const p = typeof w?.parameter === 'string' ? w.parameter.trim() : ''
	return !p || p.endsWith(':') ? null : p
}

// AEMET's probability band, "40%-70%" → "40–70 %".
export function probabilityText(w) {
	const p = typeof w?.probability === 'string' ? w.probability.trim() : ''
	if (!p) return null
	const m = p.match(/^(\d+)\s*%?\s*-\s*(\d+)\s*%$/)
	return m ? `${m[1]}–${m[2]} %` : p
}

// Map code → { name, province, ccaa } from es-zones.geojson; province/ccaa
// are the INE / AEMET codes (names via spainNames.js).
export function zonesMetaFrom(fc) {
	const meta = new Map()
	for (const f of fc?.features ?? []) {
		const p = f?.properties
		if (p?.code == null) continue
		meta.set(String(p.code), { name: p.name ?? null, province: p.province ?? null, ccaa: p.ccaa ?? null })
	}
	return meta
}

/**
 * The AEMET zones bordering district `code` (BORDER_ZONES order, north →
 * south), each with its warnings sorted (sortWarnings).
 * `province` is the Portuguese province NAME (provinceName), null when the
 * zone has no metadata. `name` is the zone's AEMET name, falling back to the
 * warning's `areaName`, then to the code.
 * @returns {Array<{ code: string, name: string, province: string|null, warnings: object[] }>}
 */
export function borderGroups(code, warnings, zonesMeta) {
	const list = Array.isArray(warnings) ? warnings : []
	return borderZones(code).map((zone) => {
		const own = list.filter((w) => String(w.idAreaAviso) === zone)
		const m = zonesMeta?.get(zone)
		return {
			code: zone,
			name: m?.name || own.find((w) => w.areaName)?.areaName || zone,
			province: provinceName(m?.province),
			warnings: sortWarnings(own),
		}
	})
}

// Distinct Portuguese names of the autonomous communities bordering
// district `code`, in BORDER_ZONES order.
export function borderRegions(code, zonesMeta) {
	const names = borderZones(code)
		.map((zone) => ccaaName(zonesMeta?.get(zone)?.ccaa))
		.filter(Boolean)
	return [...new Set(names)]
}
