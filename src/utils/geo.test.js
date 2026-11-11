import { expect, test } from 'vitest'

import { haversineKm, nearestStationWithObs } from './geo.js'

const LISBOA = { lat: 38.7223, lng: -9.1393 }
const PORTO = { lat: 41.1579, lng: -8.6291 }

test('Lisboa–Porto is about 274 km', () => {
	expect(haversineKm(LISBOA, PORTO)).toBeGreaterThan(272)
	expect(haversineKm(LISBOA, PORTO)).toBeLessThan(276)
	expect(haversineKm(LISBOA, LISBOA)).toBe(0)
})

const station = (id, lat, lng, name = `E${id}`) => ({
	properties: { idEstacao: id, localEstacao: name },
	geometry: { coordinates: [lng, lat] },
})

test('nearest station only counts stations with observations', () => {
	const stations = [station(1, 38.72, -9.14), station(2, 38.8, -9.2), station(3, 41.15, -8.63)]
	const best = nearestStationWithObs(LISBOA, stations, { 2: { temperatura: 15 }, 3: { temperatura: 12 } })
	expect(best).toMatchObject({ id: '2', name: 'E2', obs: { temperatura: 15 } })
})

test('broken features and missing input are tolerated', () => {
	const stations = [null, { properties: {} }, { geometry: { coordinates: [0, 0] } }, station(4, 38.7, -9.1)]
	expect(nearestStationWithObs(LISBOA, stations, { 4: {} })?.id).toBe('4')
	expect(nearestStationWithObs(null, stations, { 4: {} })).toBeNull()
	expect(nearestStationWithObs(LISBOA, [], {})).toBeNull()
})
