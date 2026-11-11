import { beforeEach, describe, expect, test, vi } from 'vitest'

import * as fma from '../../functions/api/incidents/fma.js'
import * as observations from '../../functions/api/observations.js'
import * as recent from '../../functions/api/observations/recent.js'
import * as stations from '../../functions/api/stations.js'
import * as daily from '../../functions/api/stations/[id]/daily.js'
import * as stationObs from '../../functions/api/stations/[id]/observations.js'
import * as warnings from '../../functions/api/warnings.js'
import * as history from '../../functions/api/warnings/history.js'

const env = { FOGOS_API_KEY: 'k' }
let fetchMock
let upstream

beforeEach(() => {
	upstream = []
	fetchMock = vi.fn(async () => new Response(JSON.stringify(upstream)))
	vi.stubGlobal('fetch', fetchMock)
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-11-11T12:00:00Z'))
	return () => vi.useRealTimers()
})

const call = (mod, url = 'https://avisos.pt/api/x', params = {}) =>
	mod.onRequestGet({ env, request: new Request(url), params })
const calledPath = () => new URL(fetchMock.mock.calls[0][0]).pathname + new URL(fetchMock.mock.calls[0][0]).search

describe('/api/warnings', () => {
	test('drops warnings that already ended', async () => {
		upstream = [
			{ idAreaAviso: 'LSB', awarenessTypeName: 'Vento', endTime: '2026-11-11T11:59:00' },
			{ idAreaAviso: 'LSB', awarenessTypeName: 'Vento', endTime: '2026-11-11T12:01:00' },
		]
		const res = await call(warnings)
		expect(calledPath()).toBe('/v2/warnings/ipma')
		expect((await res.json()).map((w) => w.endTime)).toEqual(['2026-11-11T12:01:00'])
	})
	test('a non-array upstream becomes []', async () => {
		upstream = { error: 'x' }
		expect(await (await call(warnings)).json()).toEqual([])
	})
})

describe('/api/warnings/history', () => {
	test('forwards only the allowed params', async () => {
		await call(history, 'https://avisos.pt/api/warnings/history?from=2026-11-01&area=LSB&junk=1&kind=agravado')
		expect(calledPath()).toBe('/v2/warnings/ipma/history?from=2026-11-01&area=LSB&kind=agravado')
	})
	test('no params → no query string; long values are cut', async () => {
		await call(history, 'https://avisos.pt/api/warnings/history')
		expect(calledPath()).toBe('/v2/warnings/ipma/history')
		await call(history, `https://avisos.pt/api/warnings/history?area=${'A'.repeat(500)}`)
		expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('area')).toHaveLength(200)
	})
})

test('/api/stations proxies the catalog', async () => {
	await call(stations)
	expect(calledPath()).toBe('/v2/weather/stations/ipma')
})

describe('/api/observations keeps only the latest hour', () => {
	test('picks the latest key', async () => {
		upstream = { '2026-11-11T10:00': { 1: { temperatura: 10 } }, '2026-11-11T11:00': { 1: { temperatura: 11 } } }
		expect(await (await call(observations)).json()).toEqual({ hour: '2026-11-11T11:00', stations: { 1: { temperatura: 11 } } })
	})
	test.each([[{}], [null], [[]]])('empty/odd upstream %j → { hour: null, stations: {} }', async (body) => {
		upstream = body
		expect(await (await call(observations)).json()).toEqual({ hour: null, stations: {} })
	})
})

describe('/api/observations/recent', () => {
	test('1–40 numeric ids, else 400 without calling upstream', async () => {
		for (const q of ['', 'stations=', 'stations=abc', `stations=${Array.from({ length: 41 }, (_, i) => i + 1).join(',')}`]) {
			const res = await call(recent, `https://avisos.pt/api/observations/recent?${q}`)
			expect(res.status).toBe(400)
		}
		expect(fetchMock).not.toHaveBeenCalled()
	})
	test('one entry per hour per station, { hour } when missing', async () => {
		upstream = { '2026-11-11T11:00': { 1: { temperatura: 11 } }, '2026-11-11T10:00': { 2: { temperatura: 9 } } }
		const body = await (await call(recent, 'https://avisos.pt/api/observations/recent?stations=1,2,x')).json()
		expect(body.hours).toEqual(['2026-11-11T10:00', '2026-11-11T11:00'])
		expect(body.stations['1']).toEqual([{ hour: '2026-11-11T10:00' }, { hour: '2026-11-11T11:00', temperatura: 11 }])
		expect(body.stations['2']).toEqual([{ hour: '2026-11-11T10:00', temperatura: 9 }, { hour: '2026-11-11T11:00' }])
	})
})

describe('/api/stations/[id]/observations and /daily validate input', () => {
	test.each([
		[stationObs, '1210881', '', '/v2/weather/stations/1210881/observations?hours=48'],
		[stationObs, '1210881', '?hours=168', '/v2/weather/stations/1210881/observations?hours=168'],
		[daily, '1210881', '', '/v2/weather/stations/1210881/daily?days=30'],
		[daily, '1210881', '?days=90', '/v2/weather/stations/1210881/daily?days=90'],
	])('valid → proxied', async (mod, id, q, path) => {
		await call(mod, `https://avisos.pt/api/stations/${id}/x${q}`, { id })
		expect(calledPath()).toBe(path)
	})
	test.each([
		[stationObs, 'abc', ''],
		[stationObs, '1', '?hours=0'],
		[stationObs, '1', '?hours=169'],
		[stationObs, '1', '?hours=1.5'],
		[stationObs, '1', '?hours=x'],
		[daily, '1/../2', ''],
		[daily, '1', '?days=91'],
		[daily, '1', '?days=-1'],
	])('invalid → 400 invalid_params', async (mod, id, q) => {
		const res = await call(mod, `https://avisos.pt/api/stations/x/y${q}`, { id })
		expect(res.status).toBe(400)
		expect(await res.json()).toEqual({ error: 'invalid_params' })
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

describe('/api/incidents/fma', () => {
	test('keeps only the fields the district page uses', async () => {
		upstream = {
			data: [
				{
					id: 2026001,
					dateTime: { sec: 1762862400 },
					natureza: 'Queda de árvore',
					district: 'Lisboa',
					concelho: 'Sintra',
					lat: 38.8,
					lng: -9.4,
					man: 3,
					meios_aquaticos: 1,
					weather: { huge: true },
					warnings: [1, 2, 3],
				},
				{ _id: { $id: 'abc' } },
			],
		}
		const body = await (await call(fma)).json()
		expect(calledPath()).toBe('/v2/incidents/active?fma=1&limit=1000')
		expect(body[0]).toMatchObject({ id: '2026001', start: '2025-11-11T12:00:00.000Z', natureza: 'Queda de árvore', man: 3, aquatic: 1, terrain: 0 })
		expect(body[0]).not.toHaveProperty('weather')
		expect(body[1]).toMatchObject({ id: 'abc', start: null, district: null, man: 0 })
	})
	test('odd upstream → []', async () => {
		upstream = { data: null }
		expect(await (await call(fma)).json()).toEqual([])
	})
})
