import { jsonResponse, proxyFogos } from '../../_fogos.js'

const MAX_STATIONS = 40

// Last ~24 h of hourly readings for a handful of stations (district pages'
// sparklines). Upstream only offers all ~190 stations at once (~1 MB), so we
// fetch it and keep just the requested ids.
//   GET /api/observations/recent?stations=1210881,1200535
// → { hours: ['2026-11-09T13:00', …], stations: { '1210881': [{ hour, temperatura, … } | { hour }] } }
export function onRequestGet({ env, request }) {
	const ids = (new URL(request.url).searchParams.get('stations') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => /^\d+$/.test(s))
	if (ids.length === 0 || ids.length > MAX_STATIONS) {
		return jsonResponse({ error: 'invalid_stations', max: MAX_STATIONS }, 400)
	}
	const wanted = new Set(ids)

	return proxyFogos({
		env,
		path: '/v2/weather/observations',
		cacheSeconds: 600,
		label: 'observations-recent',
		transform: (data) => {
			const hours = data && typeof data === 'object' ? Object.keys(data).sort() : []
			const stations = {}
			for (const id of wanted) stations[id] = []
			// One entry per hour per station — `{ hour }` alone when the station
			// didn't report — so consumers that space points by index keep
			// outages visible instead of joining across them.
			for (const hour of hours) {
				const row = data[hour] ?? {}
				for (const id of wanted) stations[id].push(row[id] ? { hour, ...row[id] } : { hour })
			}
			return { hours, stations }
		},
	})
}
