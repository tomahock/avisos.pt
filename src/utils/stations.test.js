import { describe, expect, test } from 'vitest'

import {
	fmtHpa,
	fmtKmh,
	fmtMm,
	fmtPct,
	fmtTemp,
	obsDate,
	reading,
	stationArea,
	stationIdFromSlug,
	stationPath,
	stationRows,
	stationSeo,
	stationSlug,
} from './stations.js'

describe('station URLs (only the leading id is authoritative)', () => {
	test('slug and path', () => {
		expect(stationSlug(1210881, 'Lisboa (Geofísico)')).toBe('1210881-lisboa-geofisico')
		expect(stationSlug(1210881, '')).toBe('1210881')
		expect(stationPath(1210881, 'Lisboa (Geofísico)')).toBe('/estacao/1210881-lisboa-geofisico')
	})
	test.each([
		['1210881-lisboa-geofisico', 1210881],
		['1210881-nome-antigo', 1210881],
		['1210881', 1210881],
		['lisboa', null],
		['', null],
		[undefined, null],
	])('stationIdFromSlug(%s) = %s', (slug, id) => expect(stationIdFromSlug(slug)).toBe(id))
})

test('reading treats -99, null and missing as no reading', () => {
	expect(reading({ temperatura: 12.5 }, 'temperatura')).toBe(12.5)
	expect(reading({ temperatura: -99 }, 'temperatura')).toBeNull()
	expect(reading({ temperatura: null }, 'temperatura')).toBeNull()
	expect(reading(null, 'temperatura')).toBeNull()
	expect(reading({}, 'temperatura')).toBeNull()
})

test('obsDate reads hour keys as UTC', () => {
	expect(obsDate('2026-08-27T13:00')?.toISOString()).toBe('2026-08-27T13:00:00.000Z')
	expect(obsDate('2026-08-27T13:00:00+01:00')?.toISOString()).toBe('2026-08-27T12:00:00.000Z')
	expect(obsDate('xpto')).toBeNull()
	expect(obsDate(null)).toBeNull()
})

test('pt-PT number formats; null stays null', () => {
	expect(fmtTemp(12.34)).toBe('12,3 °C')
	expect(fmtTemp(-0.04)).toMatch(/^-?0,0 °C$/)
	expect(fmtMm(0)).toBe('0,0 mm')
	expect(fmtPct(80.6)).toBe('81%')
	expect(fmtKmh(31.5)).toBe('32 km/h')
	expect(fmtHpa(1013.2)).toBe('1013 hPa')
	for (const f of [fmtTemp, fmtMm, fmtPct, fmtKmh, fmtHpa]) expect(f(null)).toBeNull()
})

describe('stationArea / stationRows', () => {
	test('unknown station falls back to the nearest area centroid', () => {
		expect(stationArea(999999999, 41.15, -8.62)).toBe('PTO')
		expect(stationArea(999999999, null, null)).toBeNull()
	})
	test('rows skip broken features and attach observations by string id', () => {
		const catalog = [
			{ properties: { idEstacao: 1, localEstacao: 'A' }, geometry: { coordinates: [-9.14, 38.72] } },
			{ properties: { idEstacao: 2, localEstacao: 'B' } },
			null,
			{ geometry: { coordinates: [0, 0] } },
		]
		const rows = stationRows(catalog, { 1: { temperatura: 15 } })
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({ id: 1, name: 'A', lat: 38.72, lng: -9.14, obs: { temperatura: 15 } })
		expect(stationRows(null, null)).toEqual([])
	})
})

describe('stationSeo', () => {
	const row = { id: 1, name: 'Lisboa', area: 'LSB', obs: { temperatura: 15.2, intensidadeVentoKM: 20, idDireccVento: 7, humidade: 80, precAcumulada: 0 } }
	test('with readings', () => {
		const seo = stationSeo(row, '2026-11-11T13:00')
		expect(seo.title).toBe('Lisboa — estação meteorológica IPMA')
		expect(seo.description).toBe('Às 13:00: 15,2 °C, vento 20 km/h O, humidade 80%, sem chuva. Temperatura, vento, chuva e humidade hora a hora — Lisboa.')
		expect(seo.path).toBe('/estacao/1-lisboa')
	})
	test('rain and missing readings', () => {
		expect(stationSeo({ ...row, obs: { precAcumulada: 1.2 } }, null).description).toMatch(/^Agora: chuva 1,2 mm na última hora\./)
		expect(stationSeo({ ...row, obs: { temperatura: -99 } }, null).description).toMatch(/^Observações hora a hora da estação meteorológica IPMA de Lisboa \(Lisboa\)/)
	})
})
