import { jsonResponse, proxyFogos } from '../../../_fogos.js'

// One station's daily summaries (FogosPT GET /v2/weather/stations/{id}/daily).
// IPMA publishes them ~2 days late.
//   GET /api/stations/1210881/daily?days=30   (1–90)
export function onRequestGet({ env, params, request }) {
	const id = String(params.id)
	const days = Number(new URL(request.url).searchParams.get('days') ?? 30)
	if (!/^\d+$/.test(id) || !Number.isInteger(days) || days < 1 || days > 90) {
		return jsonResponse({ error: 'invalid_params' }, 400)
	}
	return proxyFogos({
		env,
		path: `/v2/weather/stations/${id}/daily?days=${days}`,
		cacheSeconds: 3600,
		label: 'station-daily',
	})
}
