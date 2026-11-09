import { useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'
import { obsDate, reading } from '../utils/stations.js'

const FIELDS = ['temperatura', 'humidade', 'pressao', 'precAcumulada', 'intensidadeVentoKM', 'idDireccVento']

const HOUR = 3600 * 1000

// Readings → one point per hour from the first to the last reading. The
// FogosPT series only contains hours the station reported, and StationChart
// spaces points by index, so missing hours must become explicit empty points
// (the line breaks there) rather than vanish.
function normalize(rows, dateKey) {
	const byHour = new Map()
	for (const r of rows) {
		const t = obsDate(r[dateKey])
		if (!t) continue
		const p = { t }
		for (const f of FIELDS) p[f] = reading(r, f)
		byHour.set(Math.floor(t.getTime() / HOUR), p)
	}
	if (byHour.size === 0) return []
	const keys = [...byHour.keys()]
	const first = Math.min(...keys)
	const last = Math.max(...keys)
	const out = []
	for (let h = first; h <= last; h++) {
		out.push(byHour.get(h) ?? Object.fromEntries([['t', new Date(h * HOUR)], ...FIELDS.map((f) => [f, null])]))
	}
	return out
}

// Hourly series for one station.
// Primary: FogosPT /v2/weather/stations/{id}/observations (up to 7 days).
// Fallback when that endpoint isn't available yet: the last 24 h slice of
// the all-stations feed — `limited: true` tells the page to hide the range
// picker.
export function useStationSeries(id, hours) {
	const [state, setState] = useState({ points: null, limited: false, error: null })

	useEffect(() => {
		if (id == null) return
		const ctrl = new AbortController()
		setState((s) => ({ ...s, points: null, error: null }))

		fetchJson(`/api/stations/${id}/observations?hours=${hours}`, ctrl.signal)
			.then((data) => setState({ points: normalize(data?.observations ?? [], 'date'), limited: false, error: null }))
			.catch((err) => {
				if (err.name === 'AbortError') return
				fetchJson(`/api/observations/recent?stations=${id}`, ctrl.signal)
					.then((data) => setState({ points: normalize(data?.stations?.[id] ?? [], 'hour'), limited: true, error: null }))
					.catch((err2) => {
						if (err2.name !== 'AbortError') setState({ points: [], limited: true, error: err2.message })
					})
			})
		return () => ctrl.abort()
	}, [id, hours])

	return state
}

// Daily summaries (IPMA, ~2 days late). Null while loading, [] when
// unavailable — the page just hides the section.
export function useStationDaily(id, days = 30) {
	const [daily, setDaily] = useState(null)
	useEffect(() => {
		if (id == null) return
		const ctrl = new AbortController()
		setDaily(null)
		fetchJson(`/api/stations/${id}/daily?days=${days}`, ctrl.signal)
			.then((data) =>
				setDaily(
					(data?.daily ?? []).map((d) => ({
						date: d.date,
						lo: reading(d, 'temp_min'),
						hi: reading(d, 'temp_max'),
						prec: reading(d, 'prec_quant'),
						humMed: reading(d, 'hum_med'),
					}))
				)
			)
			.catch((err) => {
				if (err.name !== 'AbortError') setDaily([])
			})
		return () => ctrl.abort()
	}, [id, days])
	return daily
}
