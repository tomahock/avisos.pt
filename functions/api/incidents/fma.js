import { proxyFogos } from '../../_fogos.js'

// Active ANEPC incidents classified as FMA (fenómenos meteorológicos adversos:
// fallen trees, flooding, road clearing, damaged structures/power lines,
// landslides…) from FogosPT GET /v2/incidents/active?fma=1.
// Upstream entries embed weather + every warning of the district; we keep
// only what the district page renders. FogosPT ingests ANEPC every 2 min.
export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/incidents/active?fma=1&limit=1000',
		cacheSeconds: 120,
		label: 'incidents-fma',
		transform: (data) => {
			const list = Array.isArray(data?.data) ? data.data : []
			return list.map((i) => ({
				id: String(i.id ?? i._id?.$id ?? ''),
				start: i.dateTime?.sec ? new Date(i.dateTime.sec * 1000).toISOString() : null,
				natureza: i.natureza ?? null,
				naturezaCode: i.naturezaCode ?? null,
				status: i.status ?? null,
				statusCode: i.statusCode ?? null,
				statusColor: i.statusColor ?? null,
				district: i.district ?? null,
				concelho: i.concelho ?? null,
				freguesia: i.freguesia ?? null,
				localidade: i.localidade ?? null,
				lat: i.lat ?? null,
				lng: i.lng ?? null,
				man: i.man ?? 0,
				terrain: i.terrain ?? 0,
				aerial: i.aerial ?? 0,
				aquatic: i.meios_aquaticos ?? 0,
			}))
		},
	})
}
