// Server-side FogosPT data for the SEO middleware and OG images (warnings,
// station catalog, latest observations). Cached in the colo's Cache API with
// the same TTLs as the /api proxies, so crawlers and share-preview bots don't
// each hit FogosPT.

import { fetchFogosJson } from './_fogos.js'
import { activeWarnings } from '../src/utils/share.js'

async function cached(key, ttl, load, waitUntil) {
	const cache = caches.default
	const hit = await cache.match(key)
	if (hit) return hit.json()

	const value = await load()
	const res = new Response(JSON.stringify(value), {
		headers: {
			'content-type': 'application/json',
			'cache-control': `public, max-age=${ttl}`,
		},
	})
	const put = cache.put(key, res)
	if (waitUntil) waitUntil(put)
	else await put
	return value
}

const KEY = (name) => `https://avisos.pt/__internal/${name}.json`

export function getWarnings(env, waitUntil) {
	return cached(
		KEY('warnings'),
		300,
		async () => {
			const data = await fetchFogosJson(env, '/v2/warnings/ipma')
			return Array.isArray(data) ? data : []
		},
		waitUntil
	).then((list) => activeWarnings(list))
}

// Station catalog (GeoJSON features), 1 h — changes very rarely.
export function getStations(env, waitUntil) {
	return cached(
		KEY('stations'),
		3600,
		async () => {
			const data = await fetchFogosJson(env, '/v2/weather/stations/ipma')
			return Array.isArray(data) ? data : []
		},
		waitUntil
	)
}

// Latest hour of observations for every station: { hour, stations }, 10 min.
export function getLatestObservations(env, waitUntil) {
	return cached(
		KEY('observations-latest'),
		600,
		async () => {
			const data = await fetchFogosJson(env, '/v2/weather/observations')
			const hours = data && typeof data === 'object' ? Object.keys(data).sort() : []
			const hour = hours.at(-1) ?? null
			return { hour, stations: hour ? data[hour] : {} }
		},
		waitUntil
	)
}
