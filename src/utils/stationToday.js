// "Since 00:00" aggregates per station (max/min temperature, highest hourly
// mean wind, rain total) from FogosPT's 24 h of hourly observations — used by
// /api/observations (functions) and shown on /estacoes. DOM/React-free.
//
// Keys are UTC hours ("2026-11-11T14:00"). "Today" is the station's local
// calendar day — Europe/Lisbon for the continent and Madeira, Atlantic/Azores
// for the Açores (DST-aware: 23/25-hour days just have fewer/more slots).
// Temperature and wind are readings AT the hour, so 00:00 counts; rain
// (precAcumulada) is the total of the hour ENDING at that time, so the 00:00
// reading belongs to yesterday and today's rain starts with 01:00.
// IPMA publishes no real-time gust: windMax is the highest hourly MEAN wind.

import { reading } from './stations.js'

const HOUR = 3600 * 1000
const fmtCache = new Map()
function partsIn(tz) {
	if (!fmtCache.has(tz)) {
		fmtCache.set(tz, new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }))
	}
	return fmtCache.get(tz)
}

const keyTime = (key) => Date.parse(`${key}:00Z`)
const toKey = (t) => new Date(t).toISOString().slice(0, 16)

/** Local { date: 'YYYY-MM-DD', hour } of a UTC hour key. */
export function localDay(key, tz) {
	const p = {}
	for (const { type, value } of partsIn(tz).formatToParts(new Date(keyTime(key)))) p[type] = value
	return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

export function stationTimeZone(region) {
	return region === 'acores' ? 'Atlantic/Azores' : 'Europe/Lisbon'
}

/** UTC hour keys of the local day of `latestKey`, from local 00:00 to it. */
export function todaySlots(latestKey, tz) {
	const { date } = localDay(latestKey, tz)
	const out = []
	for (let t = keyTime(latestKey); localDay(toKey(t), tz).date === date; t -= HOUR) out.unshift(toKey(t))
	return out
}

const round1 = (v) => Math.round(v * 10) / 10

/**
 * data = { '<UTC hour>': { '<id>': obs } } → { '<id>': { tmax, tmin, tMissing,
 * windMax, wMissing, rain, rMissing } } for stations with any reading today.
 * `tzOf(id)` → IANA time zone. `*Missing` = hours of today without a reading
 * (values are then partial: rain is a lower bound). rain is null at 00:xx.
 */
export function todayAggregates(data, tzOf) {
	if (!data || typeof data !== 'object') return {}
	const keys = Object.keys(data).sort()
	const latest = keys.at(-1)
	if (!latest) return {}
	const ids = new Set()
	for (const k of keys) for (const id of Object.keys(data[k] ?? {})) ids.add(id)

	const slotsByTz = new Map()
	const out = {}
	for (const id of ids) {
		const tz = tzOf(id)
		if (!slotsByTz.has(tz)) {
			const slots = todaySlots(latest, tz)
			// Slots start at local 00:00, whose rain is yesterday's last hour.
			slotsByTz.set(tz, { slots, rainSlots: slots.slice(1) })
		}
		const { slots, rainSlots } = slotsByTz.get(tz)
		const at = (k, f) => reading(data[k]?.[id], f)
		const temps = slots.map((k) => at(k, 'temperatura')).filter((v) => v != null)
		const winds = slots.map((k) => at(k, 'intensidadeVentoKM')).filter((v) => v != null)
		const rains = rainSlots.map((k) => at(k, 'precAcumulada')).filter((v) => v != null)
		if (!temps.length && !winds.length && !rains.length) continue
		out[id] = {
			tmax: temps.length ? Math.max(...temps) : null,
			tmin: temps.length ? Math.min(...temps) : null,
			tMissing: slots.length - temps.length,
			windMax: winds.length ? Math.max(...winds) : null,
			wMissing: slots.length - winds.length,
			rain: rains.length ? round1(rains.reduce((s, v) => s + v, 0)) : null,
			rMissing: rainSlots.length - rains.length,
		}
	}
	return out
}
