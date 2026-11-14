// Rain accumulated since local 00:00 (#58), for the station page chart.
// DOM/React-free.
//
// Points are the hourly series of useStationSeries: `t` is the UTC end of the
// hour and `precAcumulada` the rain of the hour ENDING at `t` — so the 00:00
// reading belongs to the previous day and a day's rain starts with 01:00 (the
// same rule as stationToday.js). Several days accumulate from 00:00 of the
// first day without resetting; the per-day view is the daily chart.

import { localDay } from './stationToday.js'

const HOUR = 3600 * 1000
const toKey = (t) => new Date(t).toISOString().slice(0, 16)

// `hours` = series to fetch: covers 00:00 of the first day up to now.
export const RAIN_PERIODS = [
	{ days: 1, label: 'Hoje', hours: 24 },
	{ days: 2, label: '2 dias', hours: 48 },
	{ days: 3, label: '3 dias', hours: 72 },
	{ days: 7, label: '7 dias', hours: 168 },
]

function minusDays(date, n) {
	const [y, m, d] = date.split('-').map(Number)
	return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}

/** UTC instant of local 00:00 of the first of `days` calendar days ending today. */
function periodStart(now, days, tz) {
	const nowHour = Math.floor(now.getTime() / HOUR) * HOUR
	const first = minusDays(localDay(toKey(nowHour), tz).date, days - 1)
	let t = nowHour
	while (localDay(toKey(t - HOUR), tz).date >= first) t -= HOUR
	return t
}

const round1 = (v) => Math.round(v * 10) / 10

/**
 * → { from: Date, points: [{ t, v }] (v = mm since `from`, starting with 0 at
 * `from`, one point per hour up to the last reading), total (null without
 * any reading in the period), missing (hours without a reading — the total
 * is then a lower bound) }.
 */
export function cumulativeRain(points, { days = 1, tz = 'Europe/Lisbon', now = new Date() } = {}) {
	const from = periodStart(now, days, tz)
	const byHour = new Map()
	for (const p of points ?? []) {
		const t = p?.t instanceof Date ? p.t.getTime() : NaN
		if (t > from && t <= now.getTime()) byHour.set(t, p.precAcumulada)
	}
	const read = [...byHour.entries()].filter(([, v]) => v != null)
	if (read.length === 0) return { from: new Date(from), points: [], total: null, missing: 0 }

	const last = Math.max(...byHour.keys())
	const out = [{ t: new Date(from), v: 0 }]
	let sum = 0
	let missing = 0
	for (let t = from + HOUR; t <= last; t += HOUR) {
		const v = byHour.get(t)
		if (v == null) missing++
		else sum += v
		out.push({ t: new Date(t), v: round1(sum) })
	}
	return { from: new Date(from), points: out, total: round1(sum), missing }
}
