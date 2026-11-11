import { describe, expect, test } from 'vitest'

import { localDay, stationTimeZone, todayAggregates, todaySlots } from './stationToday.js'

// Upstream keys: UTC hours "YYYY-MM-DDTHH:MM".
const key = (iso) => iso.slice(0, 16)
const hoursBack = (latestIso, n) => Array.from({ length: n }, (_, i) => key(new Date(Date.parse(latestIso) - (n - 1 - i) * 3600e3).toISOString()))

describe('local day and slots', () => {
	test('Lisbon (WET) and Azores (UTC−1) midnights differ by one hour', () => {
		expect(localDay('2026-11-11T00:00', 'Europe/Lisbon')).toEqual({ date: '2026-11-11', hour: 0 })
		expect(localDay('2026-11-11T00:00', 'Atlantic/Azores')).toEqual({ date: '2026-11-10', hour: 23 })
		expect(stationTimeZone('acores')).toBe('Atlantic/Azores')
		expect(stationTimeZone('madeira')).toBe('Europe/Lisbon')
		expect(stationTimeZone(null)).toBe('Europe/Lisbon')
	})
	test('slots since local midnight up to the latest hour', () => {
		// 14:00 UTC on 11 Nov: Lisbon 00:00…14:00 (15 slots), Azores 00:00…13:00 local (14 slots)
		expect(todaySlots('2026-11-11T14:00', 'Europe/Lisbon')).toHaveLength(15)
		const az = todaySlots('2026-11-11T14:00', 'Atlantic/Azores')
		expect(az).toHaveLength(14)
		expect(az[0]).toBe('2026-11-11T01:00') // 00:00 in the Azores
	})
	test('DST days: 23 and 25 hour days', () => {
		// 29 Mar 2026: Lisbon jumps 01:00 → 02:00. At 23:00 local (22:00 UTC) the day had 23 hours.
		expect(todaySlots('2026-03-29T22:00', 'Europe/Lisbon')).toHaveLength(23)
		// 25 Oct 2026: 02:00 → 01:00. At 23:00 local (23:00 UTC) the day had 25 hours.
		expect(todaySlots('2026-10-25T23:00', 'Europe/Lisbon')).toHaveLength(25)
	})
})

describe('todayAggregates', () => {
	const latest = '2026-11-11T14:00:00Z'
	const hours = hoursBack(latest, 24) // 15:00 on 10 Nov … 14:00 on 11 Nov (UTC)
	const obs = (temp, wind, rain) => ({ temperatura: temp, intensidadeVentoKM: wind, precAcumulada: rain })
	const make = (fn) => Object.fromEntries(hours.map((h, i) => [h, fn(h, i)]))

	test('Lisbon station: max/min/wind since 00:00, rain over the hours after 00:00', () => {
		const data = make((h) => {
			const hh = Number(h.slice(11, 13))
			const today = h.startsWith('2026-11-11')
			return { 1: obs(today ? 10 + hh / 2 : 30, today ? hh : 99, today ? 0.5 : 9) }
		})
		const t = todayAggregates(data, () => 'Europe/Lisbon')[1]
		// 00:00…14:00 → 15 temps 10…17; yesterday's 30 °C and 99 km/h ignored.
		expect(t).toMatchObject({ tmax: 17, tmin: 10, tMissing: 0, windMax: 14, wMissing: 0 })
		// Rain: 01:00…14:00 = 14 hours × 0.5 (the 00:00 reading is 23–24 h of yesterday).
		expect(t).toMatchObject({ rain: 7, rMissing: 0 })
	})

	test('Azores station uses its own midnight (01:00 UTC)', () => {
		const data = make((h) => ({ 2: obs(h === '2026-11-11T00:00' ? -5 : 12, 10, h === '2026-11-11T01:00' ? 3 : 1) }))
		const t = todayAggregates(data, () => 'Atlantic/Azores')[2]
		// 00:00 UTC is 23:00 of the 10th in the Azores → its −5 °C is yesterday.
		expect(t.tmin).toBe(12)
		// Rain slots: 02:00…14:00 UTC (13 h × 1 mm); the 01:00 UTC reading is the hour ending at local midnight.
		expect(t.rain).toBe(13)
	})

	test('missing hours and -99 → partial values with the count', () => {
		const data = make((h) => {
			if (h === '2026-11-11T05:00') return {} // station absent
			if (h === '2026-11-11T06:00') return { 1: obs(-99, -99, -99) }
			return { 1: obs(12, 20, 1) }
		})
		const t = todayAggregates(data, () => 'Europe/Lisbon')[1]
		expect(t).toMatchObject({ tmax: 12, tmin: 12, tMissing: 2, windMax: 20, wMissing: 2, rain: 12, rMissing: 2 })
	})

	test('hours of today missing from the 24 h window count as missing', () => {
		const data = Object.fromEntries(hoursBack(latest, 3).map((h) => [h, { 1: obs(10, 5, 1) }])) // only 12:00–14:00
		const t = todayAggregates(data, () => 'Europe/Lisbon')[1]
		expect(t).toMatchObject({ tMissing: 12, rain: 3, rMissing: 11 })
	})

	test('before the first reading of the day / at 00:00: no rain yet, no entry without readings', () => {
		const at0 = { '2026-11-11T00:00': { 1: obs(9, 3, 0.4) }, '2026-11-10T23:00': { 1: obs(11, 5, 2), 2: obs(8, 1, 0) } }
		const t = todayAggregates(at0, () => 'Europe/Lisbon')
		expect(t[1]).toMatchObject({ tmax: 9, tmin: 9, windMax: 3, rain: null, rMissing: 0 })
		expect(t[2]).toBeUndefined() // nothing today yet
		expect(todayAggregates({}, () => 'Europe/Lisbon')).toEqual({})
		expect(todayAggregates(null, () => 'Europe/Lisbon')).toEqual({})
	})
})
