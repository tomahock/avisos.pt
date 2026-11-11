import { expect, test } from 'vitest'

import { pointInBounds, stationInBounds } from './bounds.js'

const BOUNDS = { latMin: 36, latMax: 43, lngMin: -10, lngMax: -6 }
const at = (coordinates) => ({ properties: { idEstacao: 1 }, geometry: coordinates === undefined ? null : { coordinates } })

test('inside / outside the bounds', () => {
	expect(stationInBounds(at([-9.1, 38.7]), BOUNDS)).toBe(true)
	expect(stationInBounds(at([-16.9, 32.6]), BOUNDS)).toBe(false)
})

test('no bounds → every station with coordinates', () => {
	expect(stationInBounds(at([-16.9, 32.6]), null)).toBe(true)
})

test('a catalog entry without usable coordinates is dropped, never a crash', () => {
	for (const f of [at(undefined), at([]), at(['x', 'y']), at([null, null]), { properties: {} }, null]) {
		expect(stationInBounds(f, BOUNDS)).toBe(false)
		expect(stationInBounds(f, null)).toBe(false)
	}
})

test('pointInBounds', () => {
	expect(pointInBounds(-9.1, 38.7, BOUNDS)).toBe(true)
	expect(pointInBounds(-25.6, 37.7, BOUNDS)).toBe(false)
	expect(pointInBounds(undefined, 38.7, null)).toBe(false)
})
