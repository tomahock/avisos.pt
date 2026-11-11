import { beforeEach, describe, expect, test, vi } from 'vitest'

import * as fma from '../../functions/api/incidents/fma.js'
import * as madeiraEvent from '../../functions/api/madeira/event.js'
import * as madeiraOccurrences from '../../functions/api/madeira/occurrences.js'
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
		const body = await (await call(observations)).json()
		expect(body).toMatchObject({ hour: '2026-11-11T11:00', stations: { 1: { temperatura: 11 } } })
	})
	test.each([[{}], [null], [[]]])('empty/odd upstream %j → { hour: null, stations: {}, today: {} }', async (body) => {
		upstream = body
		expect(await (await call(observations)).json()).toEqual({ hour: null, stations: {}, today: {} })
	})
})

// #48: "since 00:00" per station, computed from the same 24 h upstream.
describe('/api/observations today', () => {
	const obs = {
		'2026-11-10T23:00': { 1: { temperatura: 20, intensidadeVentoKM: 80, precAcumulada: 5 }, 9: { temperatura: 3 } },
		'2026-11-11T00:00': { 1: { temperatura: 9, intensidadeVentoKM: 10, precAcumulada: 2 }, 9: { temperatura: -1 } },
		'2026-11-11T01:00': { 1: { temperatura: 8, intensidadeVentoKM: 30, precAcumulada: 1 }, 9: { temperatura: 4, precAcumulada: 2 } },
		'2026-11-11T02:00': { 1: { temperatura: 7, intensidadeVentoKM: -99, precAcumulada: 0.5 }, 9: { temperatura: 5, precAcumulada: 1 } },
	}
	// Station 9 is in the Açores (catalog coordinates): its day starts at 01:00 UTC.
	const catalog = [
		{ type: 'Feature', properties: { idEstacao: 1, localEstacao: 'Lisboa' }, geometry: { type: 'Point', coordinates: [-9.15, 38.72] } },
		{ type: 'Feature', properties: { idEstacao: 9, localEstacao: 'Ponta Delgada' }, geometry: { type: 'Point', coordinates: [-25.67, 37.74] } },
	]
	const route = (catalogOk = true) =>
		fetchMock.mockImplementation(async (url) => {
			if (String(url).includes('/v2/weather/stations/ipma')) return catalogOk ? new Response(JSON.stringify(catalog)) : new Response('x', { status: 500 })
			return new Response(JSON.stringify(obs))
		})

	test('per station, in its own time zone; stations unchanged', async () => {
		route()
		const body = await (await call(observations)).json()
		expect(body.stations).toEqual(obs['2026-11-11T02:00'])
		expect(body.today['1']).toEqual({ tmax: 9, tmin: 7, tMissing: 0, windMax: 30, wMissing: 1, rain: 1.5, rMissing: 0 })
		// Açores: 00:00 UTC (−1 °C) is still yesterday; rain from 02:00 UTC.
		expect(body.today['9']).toMatchObject({ tmax: 5, tmin: 4, rain: 1, rMissing: 0 })
	})
	test('catalog unavailable → still answers (Lisbon time for unknown stations)', async () => {
		route(false)
		const res = await call(observations)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.today['9']).toMatchObject({ tmin: -1 }) // counted from Lisbon midnight
		expect(body.today['1']).toMatchObject({ tmax: 9 })
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

describe('/api/madeira/event', () => {
	test('keeps what the area pages render, drops the breakdowns', async () => {
		upstream = {
			success: true,
			data: {
				id: 'e1',
				title: 'Depressão Charles',
				status: 'ATIVO',
				active: true,
				start: '2026-11-10T20:00:00Z',
				updatedAt: '2026-11-11T12:15:00Z',
				kpi: { occurrences: 265, activeOccurrences: '20', operationals: 668, groundAssets: 274, municipalities: 12, peak: { time: '2026-11-11T06:00:00Z', occurrences: 36 } },
				recommendations: ['Evite deslocações.', '', null],
				municipalities: [{ name: 'Funchal', occurrences: 65, natures: [{ code: '1' }] }],
				roadRestrictions: [{ road: 'ER 101', closed: true, text: 'Cortada', time: null }, { road: 'VR 1', text: 'Condicionada' }, {}],
				communiques: [
					{ title: 'Aviso 17', time: '2026-11-06T11:31:00Z', text: 'Muito texto', link: 'https://www.procivmadeira.pt/x', official: true },
					{ title: 'Ligação estranha', link: 'javascript:alert(1)' },
					{ title: '' },
				],
				natures: [1],
				hourly: [1],
				parishes: [1],
				entities: [1],
				topOccurrences: [1],
				source: 'SRPC-RAM',
			},
		}
		const body = await (await call(madeiraEvent)).json()
		expect(calledPath()).toBe('/v2/madeira/events/current')
		const e = body.event
		expect(e).toMatchObject({ id: 'e1', title: 'Depressão Charles', active: true, zone: null, end: null, updatedAt: '2026-11-11T12:15:00Z' })
		expect(e.kpi).toEqual({ occurrences: 265, activeOccurrences: 20, operationals: 668, groundAssets: 274, municipalities: 12, peak: { time: '2026-11-11T06:00:00Z', occurrences: 36 } })
		expect(e.recommendations).toEqual(['Evite deslocações.'])
		expect(e.municipalities).toEqual([{ name: 'Funchal', occurrences: 65 }])
		expect(e.roadRestrictions).toEqual([
			{ road: 'ER 101', closed: true, text: 'Cortada', time: null },
			{ road: 'VR 1', closed: false, text: 'Condicionada', time: null },
		])
		expect(e.communiques).toEqual([
			{ title: 'Aviso 17', time: '2026-11-06T11:31:00Z', link: 'https://www.procivmadeira.pt/x', official: true },
			{ title: 'Ligação estranha', time: null, link: null, official: false },
		])
		for (const k of ['natures', 'hourly', 'parishes', 'entities', 'topOccurrences', 'source']) expect(e).not.toHaveProperty(k)
	})
	test.each([[{ success: true, data: null }], [{}], [null], [[]]])('no event / odd upstream %j → { event: null }', async (body) => {
		upstream = body
		expect(await (await call(madeiraEvent)).json()).toEqual({ event: null })
	})
	test('kpi missing → zeros, no peak', async () => {
		upstream = { data: { id: 1, active: true } }
		const { event } = await (await call(madeiraEvent)).json()
		expect(event.kpi).toEqual({ occurrences: 0, activeOccurrences: 0, operationals: 0, groundAssets: 0, municipalities: 0, peak: null })
		expect(event).toMatchObject({ id: '1', roadRestrictions: [], communiques: [], recommendations: [], municipalities: [] })
	})
})

describe('/api/madeira/occurrences', () => {
	test('asks for the last 24 h and keeps only the fields used', async () => {
		upstream = {
			success: true,
			data: [
				{ id: 'a', copies: 2, start: '2026-11-11T11:59:00Z', natureCode: '3311', nature: 'Queda', firefighters: 2, vehicles: 1, parishCode: '310307', parish: 'São Martinho', municipalityCode: '3103', municipality: 'Funchal', lat: 32.64, lng: -16.93, location: 'parish', entities: ['CMOS'], updatedAt: 'x' },
				{ id: 'b', copies: 0, start: '2026-11-11T11:00:00Z', natureCode: 3313, nature: 'Movimento de massa', firefighters: null, parishCode: null, municipalityCode: null }, // before #101: no lat/lng
				{ id: 'c', lat: 32.6, lng: null, location: null },
				null,
			],
		}
		const body = await (await call(madeiraOccurrences)).json()
		expect(calledPath()).toBe('/v2/madeira/occurrences?limit=2000')
		expect(body).toHaveLength(3)
		expect(body[0]).toEqual({ id: 'a', copies: 2, start: '2026-11-11T11:59:00Z', natureCode: '3311', nature: 'Queda', firefighters: 2, vehicles: 1, parishCode: '310307', parish: 'São Martinho', municipalityCode: '3103', municipality: 'Funchal', lat: 32.64, lng: -16.93 })
		expect(body[1]).toMatchObject({ id: 'b', copies: 1, natureCode: '3313', firefighters: 0, vehicles: 0, lat: null, lng: null, municipality: null })
		expect(body[2]).toMatchObject({ id: 'c', lat: null, lng: null })
	})
	test('odd upstream → []', async () => {
		upstream = { data: null }
		expect(await (await call(madeiraOccurrences)).json()).toEqual([])
	})
	test('upstream down → 502', async () => {
		fetchMock.mockResolvedValueOnce(new Response('x', { status: 503 }))
		expect((await call(madeiraOccurrences)).status).toBe(502)
	})
})
