import { proxyFogos } from '../../_fogos.js'

// Only these reach FogosPT /v2/warnings/ipma/history (from/to: Lisbon dates or
// wall-clock datetimes; area/type/kind: CSV). Anything else is dropped so the
// edge cache isn't split by junk params.
const PARAMS = ['from', 'to', 'area', 'type', 'kind']

//   GET /api/warnings/history?from=2026-11-04T12:00:00&to=…&area=LSB&kind=agravado
// → [{ id, kind, area, type, fromLevel, toLevel, startTime, endTime, previousEndTime, text, previousText, reportDate, occurredAt }]
export function onRequestGet({ env, request }) {
	const params = new URL(request.url).searchParams
	const upstream = new URLSearchParams()
	for (const name of PARAMS) {
		const value = params.get(name)
		if (value) upstream.set(name, value.slice(0, 200))
	}
	const query = upstream.toString()

	return proxyFogos({
		env,
		path: '/v2/warnings/ipma/history' + (query ? `?${query}` : ''),
		cacheSeconds: 300,
		label: 'warnings-history',
	})
}
