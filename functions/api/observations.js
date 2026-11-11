import { fetchFogosJson, proxyFogos } from '../_fogos.js'
import { getStations } from '../_warnings.js'
import { IPMA_AREAS } from '../../src/data/ipmaAreas.js'
import { STATION_AREAS } from '../../src/data/stationAreas.js'
import { stationArea } from '../../src/utils/stations.js'
import { stationTimeZone, todayAggregates } from '../../src/utils/stationToday.js'

// Upstream returns 24h of hourly observations for every station — ~500 KB–1 MB
// uncompressed. We only need the most recent hour to render current conditions,
// so trim server-side. Keeps the client payload small and the CDN cache dense.
//
// Plus `today` (#48): per station, max/min temperature, highest hourly mean
// wind and rain total since 00:00 local (src/utils/stationToday.js), from the
// same 24 h. The station's region (Açores = Atlantic/Azores midnight) comes
// from the catalog (Cache API, 1 h); without it, the generated id → area
// table, else Lisbon. Shape: { hour, stations: { <id>: obs }, today: { <id>:
// { tmax, tmin, tMissing, windMax, wMissing, rain, rMissing } } }.

async function stationRegions(env, waitUntil) {
	try {
		const list = typeof caches !== 'undefined' ? await getStations(env, waitUntil) : await fetchFogosJson(env, '/v2/weather/stations/ipma')
		const map = {}
		for (const f of Array.isArray(list) ? list : []) {
			const id = f?.properties?.idEstacao
			const [lng, lat] = f?.geometry?.coordinates ?? []
			if (id != null) map[String(id)] = IPMA_AREAS[stationArea(id, lat, lng)]?.region
		}
		return map
	} catch {
		return {}
	}
}

export async function onRequestGet({ env, waitUntil }) {
	const regions = await stationRegions(env, waitUntil)
	const tzOf = (id) => stationTimeZone(regions[id] ?? IPMA_AREAS[STATION_AREAS[id]]?.region)
	return proxyFogos({
		env,
		path: '/v2/weather/observations',
		cacheSeconds: 600,
		label: 'observations',
		transform: (data) => {
			if (!data || typeof data !== 'object' || Array.isArray(data)) return { hour: null, stations: {}, today: {} }
			const hours = Object.keys(data).sort()
			const latest = hours[hours.length - 1]
			if (!latest) return { hour: null, stations: {}, today: {} }
			return { hour: latest, stations: data[latest] ?? {}, today: todayAggregates(data, tzOf) }
		},
	})
}
