import { expect, test } from 'vitest'

import { cumulativeRain, RAIN_PERIODS } from './rainCumulative.js'

const LX = 'Europe/Lisbon'
// Hourly points as useStationSeries returns them: t = end of the hour (UTC),
// precAcumulada = rain of the hour ending at t.
const pt = (iso, mm) => ({ t: new Date(iso), precAcumulada: mm })

test('today starts at local midnight: the 00:00 reading belongs to yesterday', () => {
	const now = new Date('2026-11-14T03:20:00Z') // winter: Lisbon = UTC
	const points = [
		pt('2026-11-13T23:00:00Z', 5),
		pt('2026-11-14T00:00:00Z', 4), // 23:00–00:00 of the 13th
		pt('2026-11-14T01:00:00Z', 1),
		pt('2026-11-14T02:00:00Z', 0),
		pt('2026-11-14T03:00:00Z', 2.5),
	]
	const r = cumulativeRain(points, { days: 1, tz: LX, now })
	expect(r.points.map((p) => [p.t.toISOString().slice(11, 16), p.v])).toEqual([
		['00:00', 0],
		['01:00', 1],
		['02:00', 1],
		['03:00', 3.5],
	])
	expect(r.total).toBe(3.5)
	expect(r.missing).toBe(0)
	expect(r.from.toISOString()).toBe('2026-11-14T00:00:00.000Z')
})

test('several days accumulate from 00:00 of the first day, without resetting', () => {
	const now = new Date('2026-11-14T02:10:00Z')
	const points = []
	for (let h = -30; h <= 2; h++) points.push(pt(new Date(Date.UTC(2026, 10, 14, h)).toISOString(), 1))
	const r = cumulativeRain(points, { days: 2, tz: LX, now })
	// 00:00 of the 13th → 02:00 of the 14th = 26 hours of 1 mm.
	expect(r.from.toISOString()).toBe('2026-11-13T00:00:00.000Z')
	expect(r.total).toBe(26)
	expect(r.points.at(-1).v).toBe(26)
	expect(r.points.map((p) => p.v)).toEqual([...Array(27).keys()])
})

test('missing readings keep the line flat and are counted (summer time)', () => {
	const now = new Date('2026-07-01T02:30:00Z') // 03:30 in Lisbon (UTC+1)
	const points = [
		pt('2026-06-30T23:00:00Z', 9), // 00:00 local: the hour before midnight
		pt('2026-07-01T00:00:00Z', 2),
		pt('2026-07-01T01:00:00Z', null),
		pt('2026-07-01T02:00:00Z', 1),
	]
	const r = cumulativeRain(points, { days: 1, tz: LX, now })
	expect(r.from.toISOString()).toBe('2026-06-30T23:00:00.000Z')
	expect(r.points.map((p) => p.v)).toEqual([0, 2, 2, 3])
	expect(r.total).toBe(3)
	expect(r.missing).toBe(1)
})

test('hours before the first reading count as missing', () => {
	const now = new Date('2026-11-14T05:00:00Z')
	const points = [pt('2026-11-14T03:00:00Z', 1), pt('2026-11-14T04:00:00Z', 1), pt('2026-11-14T05:00:00Z', 1)]
	const r = cumulativeRain(points, { days: 1, tz: LX, now })
	expect(r.total).toBe(3)
	expect(r.missing).toBe(2) // 01:00 and 02:00
})

test('Açores use their own midnight', () => {
	const now = new Date('2026-11-14T03:00:00Z') // 02:00 in the Açores (UTC−1)
	const points = [pt('2026-11-14T01:00:00Z', 7), pt('2026-11-14T02:00:00Z', 1), pt('2026-11-14T03:00:00Z', 1)]
	const r = cumulativeRain(points, { days: 1, tz: 'Atlantic/Azores', now })
	expect(r.from.toISOString()).toBe('2026-11-14T01:00:00.000Z')
	expect(r.total).toBe(2)
})

test('no readings in the period', () => {
	const r = cumulativeRain([], { days: 1, tz: LX, now: new Date('2026-11-14T05:00:00Z') })
	expect(r.points).toEqual([])
	expect(r.total).toBeNull()
})

test('periods: today by default, hours to fetch cover the whole period', () => {
	expect(RAIN_PERIODS.map((p) => [p.days, p.label, p.hours])).toEqual([
		[1, 'Hoje', 24],
		[2, '2 dias', 48],
		[3, '3 dias', 72],
		[7, '7 dias', 168],
	])
})
