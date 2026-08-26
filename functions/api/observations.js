import { proxyFogos } from '../_fogos.js'

// Upstream returns 24h of hourly observations for every station — ~500 KB–1 MB
// uncompressed. We only need the most recent hour to render current conditions,
// so trim server-side. Keeps the client payload small and the CDN cache dense.
export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/weather/observations',
		cacheSeconds: 600,
		label: 'observations',
		transform: (data) => {
			if (!data || typeof data !== 'object') return { hour: null, stations: {} }
			const hours = Object.keys(data).sort()
			const latest = hours[hours.length - 1]
			if (!latest) return { hour: null, stations: {} }
			return { hour: latest, stations: data[latest] ?? {} }
		},
	})
}
