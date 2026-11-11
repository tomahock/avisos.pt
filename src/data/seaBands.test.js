// Integrity of the generated public/data/sea-bands.geojson
// (scripts/build-sea-bands.mjs): one band per sea area, none for inland
// districts or MRM, valid geometry that stays off land and off its
// neighbours, and touches its own area's coast.

import { readFileSync } from 'node:fs'

import * as turf from '@turf/turf'
import { describe, expect, test } from 'vitest'

import { IPMA_AREA_CODES, codeFromContinentalName } from './ipmaAreas.js'
import { codeForFeature } from './islandConcelhos.js'
import { SEA_AREAS, SEA_BAND_KM } from './seaAreas.js'

const read = (p) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), 'utf8'))
const bands = read('sea-bands.geojson')
const concelhos = [...read('pt-continental.geojson').features, ...read('pt-arquipelagos.geojson').features].filter((f) => f.geometry)
const band = (code) => bands.features.find((f) => f.properties.code === code)
const km2 = (g) => (g ? turf.area(g) / 1e6 : 0)

test('one band per sea area, generated with SEA_BAND_KM', () => {
	expect(bands.bandKm).toBe(SEA_BAND_KM)
	expect(bands.features.map((f) => f.properties.code).sort()).toEqual([...SEA_AREAS].sort())
})

test('no band for inland districts or Madeira mountain zone (MRM)', () => {
	const inland = IPMA_AREA_CODES.filter((c) => !SEA_AREAS.includes(c))
	expect(inland).toEqual(expect.arrayContaining(['BGC', 'VRL', 'VIS', 'GDA', 'CBO', 'STM', 'PTG', 'EVR', 'MRM']))
	for (const code of inland) expect(band(code)).toBeUndefined()
})

describe.each(SEA_AREAS)('%s', (code) => {
	const f = band(code)
	const own = concelhos.filter((c) => codeForFeature(c, codeFromContinentalName) === code)
	test('valid (Multi)Polygon with a real area', () => {
		expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type)
		expect(turf.booleanValid(f)).toBe(true)
		expect(km2(f)).toBeGreaterThan(100)
	})
	test('hugs its own coast and stays off its land', () => {
		const land = own.length === 1 ? own[0] : turf.union(turf.featureCollection(own))
		expect(turf.booleanIntersects(f, turf.buffer(land, 1, { units: 'kilometers' }))).toBe(true)
		// Overlap with land: only simplification noise (<1% of the band).
		expect(km2(turf.intersect(turf.featureCollection([f, land])))).toBeLessThan(km2(f) * 0.01)
		// Nothing farther than the band width (+ buffer arc tolerance).
		const reach = turf.buffer(land, SEA_BAND_KM + 1, { units: 'kilometers' })
		expect(km2(turf.difference(turf.featureCollection([f, reach])))).toBeLessThan(1)
	})
})

test('neighbouring bands do not overlap', () => {
	for (let i = 0; i < bands.features.length; i++) {
		for (let j = i + 1; j < bands.features.length; j++) {
			const [a, b] = [bands.features[i], bands.features[j]]
			if (!turf.booleanIntersects(turf.bboxPolygon(turf.bbox(a)), turf.bboxPolygon(turf.bbox(b)))) continue
			expect(km2(turf.intersect(turf.featureCollection([a, b]))), `${a.properties.code} × ${b.properties.code}`).toBeLessThan(0.5)
		}
	}
})

test('neighbouring continental bands meet (no gap at district boundaries)', () => {
	const chain = ['VCT', 'BRG', 'PTO', 'AVR', 'CBR', 'LRA', 'LSB', 'STB', 'BJA', 'FAR']
	for (let i = 1; i < chain.length; i++) {
		const [a, b] = [band(chain[i - 1]), band(chain[i])]
		expect(turf.booleanIntersects(turf.buffer(a, 0.2, { units: 'kilometers' }), b), `${chain[i - 1]} – ${chain[i]}`).toBe(true)
	}
})

// Inner waters are not "sea": the band starts at the open coast (#38).
// The Tejo estuary is open water in the concelho polygons (the others are
// inside concelho limits already); points sampled across the estuary.
describe('no band inside estuaries and lagoons', () => {
	const inLand = (pt) => concelhos.some((c) => turf.booleanPointInPolygon(pt, c))
	const inBand = (pt) => bands.features.find((f) => turf.booleanPointInPolygon(pt, f))?.properties.code ?? null
	const TEJO = [
		[-9.03, 38.74], // Mar da Palha
		[-9.1, 38.66], // Seixal
		[-9.06, 38.7], // Barreiro
		[-9.0, 38.8], // Alverca
		[-9.13, 38.69], // Cacilhas, inside the mouth
	]
	test.each(TEJO)('Tejo %f,%f is water but has no band', (lng, lat) => {
		const pt = turf.point([lng, lat])
		expect(inLand(pt)).toBe(false)
		expect(inBand(pt)).toBeNull()
	})
	test.each([
		['Sado', -8.8, 38.46],
		['Ria de Aveiro', -8.7, 40.68],
		['Ria Formosa', -7.9, 37.0],
		['Lagoa de Óbidos', -9.18, 39.41],
		['Douro', -8.63, 41.14],
		['Guadiana', -7.415, 37.19],
	])('%s has no band', (_, lng, lat) => {
		expect(inBand(turf.point([lng, lat]))).toBeNull()
	})
	test('the open coast just outside the Tejo still has its band', () => {
		expect(inBand(turf.point([-9.26, 38.6]))).toBe('STB') // off Fonte da Telha (Costa da Caparica)
		expect(inBand(turf.point([-9.45, 38.68]))).toBe('LSB') // off Cascais
	})
})
