// Shared helper for /functions/api/* handlers that proxy FogosPT.
// Keeps the API key server-side and enforces headers required by
// https://fogos.pt/pt/api (X-API-Key + identifiable User-Agent).

const BASE = 'https://api.fogos.pt'

// FOGOS_API_BASE is a local-dev escape hatch (point wrangler at a mock
// server); never set it in the CF dashboard.
function baseUrl(env) {
	return env.FOGOS_API_BASE || BASE
}
const USER_AGENT = 'AvisosPT/1.0 (+https://avisos.pt)'
const TIMEOUT_MS = 30_000

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...extraHeaders,
		},
	})
}

/**
 * Fetch a FogosPT endpoint and return a proxied Response.
 * @param {{env: any, path: string, cacheSeconds: number, transform?: (data: any) => any, label?: string}} opts
 */
export async function proxyFogos({ env, path, cacheSeconds, transform, label = path }) {
	const key = env.FOGOS_API_KEY
	if (!key) {
		console.error(`[${label}] FOGOS_API_KEY not set`)
		return jsonResponse({ error: 'missing_api_key' }, 500)
	}

	let upstream
	try {
		upstream = await fetch(baseUrl(env) + path, {
			headers: {
				'X-API-Key': key,
				'User-Agent': USER_AGENT,
				Accept: 'application/json',
			},
			signal: AbortSignal.timeout(TIMEOUT_MS),
		})
	} catch (err) {
		console.error(`[${label}] fetch failed:`, err)
		return jsonResponse({ error: 'upstream_unreachable' }, 502)
	}

	console.log(`[${label}] ${upstream.status}`)

	if (!upstream.ok) {
		return jsonResponse({ error: 'upstream_error', status: upstream.status }, 502)
	}

	const cacheHeader = { 'cache-control': `public, max-age=${cacheSeconds}` }

	if (!transform) {
		const body = await upstream.text()
		return new Response(body, {
			status: 200,
			headers: {
				'content-type': 'application/json; charset=utf-8',
				...cacheHeader,
			},
		})
	}

	let data
	try {
		data = await upstream.json()
	} catch (err) {
		console.error(`[${label}] invalid JSON from upstream:`, err)
		return jsonResponse({ error: 'upstream_invalid_json' }, 502)
	}

	return jsonResponse(transform(data), 200, cacheHeader)
}

/**
 * Fetch a FogosPT endpoint and return the parsed JSON (for server-side use
 * by the SEO middleware / OG images, not proxied to the browser). Throws on
 * any failure so callers can fall back to generic content.
 */
export async function fetchFogosJson(env, path) {
	if (!env.FOGOS_API_KEY) throw new Error('missing_api_key')
	const res = await fetch(baseUrl(env) + path, {
		headers: {
			'X-API-Key': env.FOGOS_API_KEY,
			'User-Agent': USER_AGENT,
			Accept: 'application/json',
		},
		signal: AbortSignal.timeout(10_000),
	})
	if (!res.ok) throw new Error(`upstream_${res.status}`)
	return res.json()
}
