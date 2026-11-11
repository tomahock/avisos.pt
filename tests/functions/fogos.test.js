import { beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchFogosJson, jsonResponse, proxyFogos } from '../../functions/_fogos.js'

const ENV = { FOGOS_API_KEY: 'k' }
let fetchMock

beforeEach(() => {
	fetchMock = vi.fn()
	vi.stubGlobal('fetch', fetchMock)
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

const ok = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

describe('proxyFogos', () => {
	test('missing key fails loud with 500 and never calls upstream', async () => {
		const res = await proxyFogos({ env: {}, path: '/x', cacheSeconds: 60 })
		expect(res.status).toBe(500)
		expect(await res.json()).toEqual({ error: 'missing_api_key' })
		expect(fetchMock).not.toHaveBeenCalled()
	})
	test('sends key, identifiable UA and passes the body through with cache-control', async () => {
		fetchMock.mockResolvedValue(ok([1, 2]))
		const res = await proxyFogos({ env: ENV, path: '/v2/x?a=1', cacheSeconds: 300 })
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('https://api.fogos.pt/v2/x?a=1')
		expect(init.headers['X-API-Key']).toBe('k')
		expect(init.headers['User-Agent']).toMatch(/^AvisosPT\//)
		expect(res.status).toBe(200)
		expect(res.headers.get('cache-control')).toBe('public, max-age=300')
		expect(res.headers.get('content-type')).toMatch(/application\/json/)
		expect(await res.json()).toEqual([1, 2])
	})
	test('FOGOS_API_BASE overrides the host (local mock)', async () => {
		fetchMock.mockResolvedValue(ok([]))
		await proxyFogos({ env: { ...ENV, FOGOS_API_BASE: 'http://127.0.0.1:8799' }, path: '/v2/x', cacheSeconds: 1 })
		expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8799/v2/x')
	})
	test('network failure → 502 upstream_unreachable', async () => {
		fetchMock.mockRejectedValue(new TypeError('boom'))
		const res = await proxyFogos({ env: ENV, path: '/x', cacheSeconds: 1 })
		expect(res.status).toBe(502)
		expect(await res.json()).toEqual({ error: 'upstream_unreachable' })
	})
	test('non-2xx → 502 upstream_error with the status, never cached', async () => {
		fetchMock.mockResolvedValue(ok({ e: 1 }, 503))
		const res = await proxyFogos({ env: ENV, path: '/x', cacheSeconds: 60 })
		expect(res.status).toBe(502)
		expect(await res.json()).toEqual({ error: 'upstream_error', status: 503 })
		expect(res.headers.get('cache-control')).toBeNull()
	})
	test('transform gets the parsed JSON; invalid JSON → 502', async () => {
		fetchMock.mockResolvedValueOnce(ok({ a: 1 }))
		const res = await proxyFogos({ env: ENV, path: '/x', cacheSeconds: 1, transform: (d) => ({ b: d.a + 1 }) })
		expect(await res.json()).toEqual({ b: 2 })
		fetchMock.mockResolvedValueOnce(ok('<html>'))
		const bad = await proxyFogos({ env: ENV, path: '/x', cacheSeconds: 1, transform: (d) => d })
		expect(bad.status).toBe(502)
		expect(await bad.json()).toEqual({ error: 'upstream_invalid_json' })
	})
})

describe('fetchFogosJson (server-side, throws)', () => {
	test('returns parsed JSON', async () => {
		fetchMock.mockResolvedValue(ok({ a: 1 }))
		expect(await fetchFogosJson(ENV, '/x')).toEqual({ a: 1 })
	})
	test('throws without key or on non-2xx', async () => {
		await expect(fetchFogosJson({}, '/x')).rejects.toThrow('missing_api_key')
		fetchMock.mockResolvedValue(ok({}, 404))
		await expect(fetchFogosJson(ENV, '/x')).rejects.toThrow('upstream_404')
	})
})

test('jsonResponse', async () => {
	const res = jsonResponse({ a: 1 }, 418, { 'x-y': 'z' })
	expect(res.status).toBe(418)
	expect(res.headers.get('x-y')).toBe('z')
	expect(await res.json()).toEqual({ a: 1 })
})
