// Server-side warnings list for the SEO middleware and OG images.
// Cached in the colo's Cache API for 5 min (same TTL as /api/warnings) so
// crawlers and share-preview bots don't each hit FogosPT.

import { fetchFogosJson } from './_fogos.js'

const CACHE_KEY = 'https://avisos.pt/__internal/warnings.json'
const TTL = 300

export async function getWarnings(env, waitUntil) {
	const cache = caches.default
	const hit = await cache.match(CACHE_KEY)
	if (hit) return hit.json()

	const data = await fetchFogosJson(env, '/v2/warnings/ipma')
	const list = Array.isArray(data) ? data : []
	const res = new Response(JSON.stringify(list), {
		headers: {
			'content-type': 'application/json',
			'cache-control': `public, max-age=${TTL}`,
		},
	})
	const put = cache.put(CACHE_KEY, res)
	if (waitUntil) waitUntil(put)
	else await put
	return list
}
