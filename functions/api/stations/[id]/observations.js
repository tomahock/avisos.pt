import { jsonResponse, proxyFogos } from '../../../_fogos.js'

// One station's hourly series (FogosPT GET /v2/weather/stations/{id}/observations).
//   GET /api/stations/1210881/observations?hours=48   (1–168)
export function onRequestGet({ env, params, request }) {
	const id = String(params.id)
	const hours = Number(new URL(request.url).searchParams.get('hours') ?? 48)
	if (!/^\d+$/.test(id) || !Number.isInteger(hours) || hours < 1 || hours > 168) {
		return jsonResponse({ error: 'invalid_params' }, 400)
	}
	return proxyFogos({
		env,
		path: `/v2/weather/stations/${id}/observations?hours=${hours}`,
		cacheSeconds: 600,
		label: 'station-observations',
	})
}
