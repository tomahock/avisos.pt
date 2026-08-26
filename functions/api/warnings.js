const UPSTREAM = 'https://api.fogos.pt/v2/warnings/ipma'
const USER_AGENT = 'AvisosPT/1.0 (+https://avisos.pt)'
const TIMEOUT_MS = 30_000

export async function onRequestGet({ env }) {
	const key = env.FOGOS_API_KEY
	if (!key) {
		console.error('FOGOS_API_KEY not set')
		return json({ error: 'missing_api_key' }, 500)
	}

	let upstream
	try {
		upstream = await fetch(UPSTREAM, {
			headers: {
				'X-API-Key': key,
				'User-Agent': USER_AGENT,
				Accept: 'application/json',
			},
			signal: AbortSignal.timeout(TIMEOUT_MS),
		})
	} catch (err) {
		console.error('FogosPT fetch failed:', err)
		return json({ error: 'upstream_unreachable' }, 502)
	}

	console.log(`FogosPT /v2/warnings/ipma → ${upstream.status}`)

	if (!upstream.ok) {
		return json({ error: 'upstream_error', status: upstream.status }, 502)
	}

	const body = await upstream.text()
	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=300',
		},
	})
}

function json(payload, status) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	})
}
