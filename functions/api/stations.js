import { proxyFogos } from '../_fogos.js'

// Station catalog changes very rarely — 1 h at the edge.
export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/weather/stations/ipma',
		cacheSeconds: 3600,
		label: 'stations',
	})
}
