import { readFileSync } from 'node:fs'

import { vi } from 'vitest'

import { makeFixtures } from '../fixtures/data.js'
import { fogosRoute } from '../fixtures/fogos.js'
import * as fma from '../../functions/api/incidents/fma.js'
import * as observations from '../../functions/api/observations.js'
import * as recent from '../../functions/api/observations/recent.js'
import * as stations from '../../functions/api/stations.js'
import * as daily from '../../functions/api/stations/[id]/daily.js'
import * as stationObs from '../../functions/api/stations/[id]/observations.js'
import * as warnings from '../../functions/api/warnings.js'
import * as history from '../../functions/api/warnings/history.js'

const UPSTREAM = 'http://fogos.test'
const ENV = { FOGOS_API_KEY: 'test', FOGOS_API_BASE: UPSTREAM }

// Browser path → [Pages Function module, params].
function handlerFor(pathname) {
	const fixed = {
		'/api/warnings': warnings,
		'/api/warnings/history': history,
		'/api/stations': stations,
		'/api/observations': observations,
		'/api/observations/recent': recent,
		'/api/incidents/fma': fma,
	}
	if (fixed[pathname]) return [fixed[pathname], {}]
	const m = pathname.match(/^\/api\/stations\/([^/]+)\/(observations|daily)$/)
	if (m) return [m[2] === 'daily' ? daily : stationObs, { id: m[1] }]
	return null
}

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * Stubs global fetch like the deployed site: /api/* goes through the real
 * Pages Functions, which call a fake FogosPT serving `makeFixtures(now)`.
 * `overrides` short-circuits a browser path: a number = that HTTP status,
 * a function = (url) => Response, anything else = JSON body.
 * Returns { fx, calls } — `calls` lists every browser-side URL requested.
 */
export function mockApi({ now = new Date(), fx = makeFixtures(now), overrides = {} } = {}) {
	const calls = []
	vi.spyOn(console, 'log').mockImplementation(() => {})
	const fetchMock = vi.fn(async (input, init) => {
		const url = typeof input === 'string' ? input : input.url
		if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
		if (url.startsWith(UPSTREAM)) {
			const { status, body } = fogosRoute(fx, url)
			return json(body, status)
		}
		calls.push(url)
		const u = new URL(url, 'http://localhost')
		const override = overrides[u.pathname]
		if (override !== undefined) {
			if (typeof override === 'number') return json({ error: 'test' }, override)
			if (typeof override === 'function') return override(url)
			return json(override)
		}
		if (u.pathname.startsWith('/data/')) {
			return json(JSON.parse(readFileSync(new URL(`../../public${u.pathname}`, import.meta.url), 'utf8')))
		}
		const h = handlerFor(u.pathname)
		if (!h) return new Response('<!doctype html>', { status: 404 })
		return h[0].onRequestGet({ env: ENV, params: h[1], request: new Request(new URL(u.pathname + u.search, 'https://avisos.pt')) })
	})
	vi.stubGlobal('fetch', fetchMock)
	return { fx, calls, fetchMock }
}
