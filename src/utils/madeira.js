// SRPC, IP-RAM (Madeira regional civil protection) data via the FogosPT API:
// the adverse-weather event in progress and the occurrences of the last 24 h.
// Shared by browser and functions — keep it DOM/React-free.
//
// Unlike IPMA warnings, every SRPC time is a real UTC instant ("…Z"): parse
// with `new Date()`, never with parseWarningTime() (Lisbon wall-clock).

import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { madeiraAreaForConcelho } from '../data/islandConcelhos.js'

// CAOP municipality code → IPMA warning area (same split as the concelho
// polygons in islandConcelhos.js).
const AREA_BY_MUNICIPALITY_CODE = {
	3101: 'MCS', // Calheta
	3102: 'MCS', // Câmara de Lobos
	3103: 'MCS', // Funchal
	3104: 'MCS', // Machico
	3105: 'MCS', // Ponta do Sol
	3106: 'MCN', // Porto Moniz
	3107: 'MCS', // Ribeira Brava
	3108: 'MCS', // Santa Cruz
	3109: 'MCN', // Santana
	3110: 'MCN', // São Vicente
	3201: 'MPS', // Porto Santo
}

// Main island of Madeira = Costa Norte + Costa Sul. MRM (Regiões
// Montanhosas) crosses concelho boundaries and SRPC doesn't say whether an
// occurrence was in the mountains, so the MRM page shows the whole island.
const MAIN_ISLAND = ['MCN', 'MCS']

export function isMadeiraArea(code) {
	return IPMA_AREAS[code]?.region === 'madeira'
}

/** IPMA area (MCN/MCS/MPS) of an occurrence, or null when SRPC gave no concelho. */
export function occurrenceArea(o) {
	return AREA_BY_MUNICIPALITY_CODE[o?.municipalityCode] ?? madeiraAreaForConcelho(o?.municipality) ?? null
}

/** Occurrences shown on an area page (MRM → the whole main island). */
export function areaOccurrences(list, code) {
	const areas = code === 'MRM' ? MAIN_ISLAND : [code]
	return (list ?? []).filter((o) => areas.includes(occurrenceArea(o)))
}

/** Occurrences SRPC didn't attribute to any concelho. */
export function unplacedOccurrences(list) {
	return (list ?? []).filter((o) => occurrenceArea(o) === null)
}

// SRPC sometimes registers the same occurrence more than once (`copies`).
export function occurrenceCount(o) {
	const n = Number(o?.copies)
	return Number.isInteger(n) && n > 0 ? n : 1
}

export function totalCount(list) {
	return (list ?? []).reduce((sum, o) => sum + occurrenceCount(o), 0)
}

export function instant(iso) {
	if (typeof iso !== 'string' || iso === '') return null
	const d = new Date(iso)
	return Number.isFinite(d.getTime()) ? d : null
}

/** "11/11, 14:05" in the visitor's timezone (same convention as formatWhen). */
export function formatInstant(iso) {
	const d = instant(iso)
	if (!d) return null
	return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function newestFirst(list) {
	return [...(list ?? [])].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
}

/** Occurrences that started in [from, to) (ms). */
export function occurrencesBetween(list, from, to) {
	return (list ?? []).filter((o) => {
		const t = instant(o.start)?.getTime()
		return t !== undefined && t >= from && t < to
	})
}

/**
 * One group per parish with an (approximate) location: SRPC only gives the
 * parish, so FogosPT places occurrences at the parish centroid. Occurrences
 * without lat/lng (not geocoded, or before FogosPT/fogosapi#101) are skipped.
 * → [{ key, parish, municipality, lat, lng, count, occurrences (newest first) }]
 */
export function parishGroups(list) {
	const groups = new Map()
	for (const o of list ?? []) {
		if (!Number.isFinite(o?.lat) || !Number.isFinite(o?.lng)) continue
		const key = o.parishCode ?? `${o.lat},${o.lng}`
		let g = groups.get(key)
		if (!g) {
			g = { key, parish: o.parish ?? null, municipality: o.municipality ?? null, lat: o.lat, lng: o.lng, count: 0, occurrences: [] }
			groups.set(key, g)
		}
		g.count += occurrenceCount(o)
		g.occurrences.push(o)
	}
	return [...groups.values()]
		.map((g) => ({ ...g, occurrences: newestFirst(g.occurrences) }))
		.sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)))
}

/**
 * Window of occurrences shown on /mapa for a period of the picker.
 * Occurrences are past events: "Agora" = last 24 h, today's tab = since local
 * midnight, future days = none (null).
 */
export function occurrenceWindow(period, now = new Date()) {
	const t = now.getTime()
	if (!period || period.key === 'agora') return { from: t - 24 * 3600 * 1000, to: t + 1, label: 'nas últimas 24 h' }
	if (period.key === '0') {
		const midnight = new Date(now)
		midnight.setHours(0, 0, 0, 0)
		return { from: midnight.getTime(), to: t + 1, label: 'hoje' }
	}
	return null
}

/** The event panel only shows an event SRPC still flags as active. */
export function activeEvent(event) {
	return event && event.active === true && event.status !== 'ENCERRADO' ? event : null
}

/** Event occurrences per area, summed from the event's per-concelho totals. */
export function eventAreaOccurrences(event, code) {
	const areas = code === 'MRM' ? MAIN_ISLAND : [code]
	const list = event?.municipalities
	if (!Array.isArray(list) || list.length === 0) return null
	return list.reduce((n, m) => (areas.includes(madeiraAreaForConcelho(m.name)) ? n + (Number(m.occurrences) || 0) : n), 0)
}
