import { describe, expect, test } from 'vitest'

import {
	buildHours,
	dayLabel,
	durationHours,
	floorHour,
	formatHour,
	groupDays,
	mapPeriods,
	relativeWindow,
	warningsAt,
	warningsInPeriod,
	worstAt,
} from './timeline.js'

// Tests run in Europe/Lisbon (vitest.config.js). 11 Nov 2026 = UTC+0.
const NOW = new Date('2026-11-11T10:20:00Z')
const w = (level, start, end, type = 'Vento') => ({
	awarenessLevelID: level,
	awarenessTypeName: type,
	idAreaAviso: 'LSB',
	startTime: start,
	endTime: end,
})

describe('buildHours', () => {
	test('starts at the current hour, at least 48 h', () => {
		const hours = buildHours([], NOW)
		expect(hours[0].toISOString()).toBe('2026-11-11T10:00:00.000Z')
		expect(hours).toHaveLength(48)
	})
	test('extends to the last endTime, capped at 96 h', () => {
		expect(buildHours([w('yellow', '2026-11-11T10:00:00', '2026-11-14T10:00:00')], NOW)).toHaveLength(72)
		expect(buildHours([w('yellow', '2026-11-11T10:00:00', '2026-11-30T00:00:00')], NOW)).toHaveLength(96)
	})
	test('unparseable endTimes are ignored', () => {
		expect(buildHours([w('yellow', 'x', 'y')], NOW)).toHaveLength(48)
	})
	test('floorHour / formatHour', () => {
		expect(floorHour(NOW).toISOString()).toBe('2026-11-11T10:00:00.000Z')
		expect(formatHour(new Date('2026-11-11T09:00:00Z'))).toBe('09')
	})
})

describe('slots', () => {
	const list = [w('yellow', '2026-11-11T09:00:00', '2026-11-11T18:00:00'), w('red', '2026-11-11T12:00:00', '2026-11-11T14:00:00')]
	const at = (h) => new Date(Date.UTC(2026, 10, 11, h))
	test('warningsAt uses half-open overlap', () => {
		expect(warningsAt(list, at(8))).toHaveLength(0)
		expect(warningsAt(list, at(13))).toHaveLength(2)
		expect(warningsAt(list, at(14))).toHaveLength(1) // red ends at 14:00
		expect(warningsAt(list, at(18))).toHaveLength(0)
	})
	test('worstAt picks the highest level', () => {
		expect(worstAt(list, at(10))).toBe('yellow')
		expect(worstAt(list, at(12))).toBe('red')
		expect(worstAt(list, at(20))).toBeNull()
	})
})

test('groupDays splits at local midnight (incl. a DST day)', () => {
	const hours = buildHours([w('yellow', '2026-10-24T20:00:00', '2026-10-27T00:00:00')], new Date('2026-10-24T20:00:00Z'))
	const days = groupDays(hours)
	expect(days.map((d) => d.span)).toEqual([3, 25, 24]) // 25 Oct has 25 hours
	expect(days.reduce((a, d) => a + d.span, 0)).toBe(hours.length)
})

describe('labels', () => {
	test('dayLabel: Hoje / Amanhã / weekday', () => {
		expect(dayLabel(new Date('2026-11-11T22:00:00Z'), NOW).main).toBe('Hoje')
		expect(dayLabel(new Date('2026-11-12T01:00:00Z'), NOW).main).toBe('Amanhã')
		expect(dayLabel(new Date('2026-11-13T01:00:00Z'), NOW).main).toMatch(/^Sex/)
	})
	test('relativeWindow', () => {
		expect(relativeWindow(w('yellow', '2026-11-11T13:20:00', '2026-11-11T20:00:00'), NOW)).toEqual({ active: false, text: 'começa em 3 h' })
		expect(relativeWindow(w('yellow', '2026-11-11T09:00:00', '2026-11-11T11:00:00'), NOW)).toEqual({ active: true, text: 'termina em 40 min' })
		expect(relativeWindow(w('yellow', '2026-11-11T09:00:00', '2026-11-14T10:20:00'), NOW).text).toBe('termina em 3 dias')
		expect(relativeWindow(w('yellow', '2026-11-11T08:00:00', '2026-11-11T09:00:00'), NOW)).toEqual({ active: false, text: 'terminou' })
	})
	test('durationHours', () => {
		expect(durationHours(w('yellow', '2026-11-11T09:00:00', '2026-11-11T18:00:00'))).toBe(9)
	})
})

describe('map periods', () => {
	test('Agora first, then one tab per day up to the last end, max 5 days', () => {
		const periods = mapPeriods([w('yellow', '2026-11-11T09:00:00', '2026-11-12T06:00:00')], NOW)
		expect(periods.map((p) => p.main)).toEqual(['Agora', 'Hoje', 'Amanhã'])
		expect(periods[1].from).toBe(NOW.getTime())
		expect(mapPeriods([w('yellow', '2026-11-11T09:00:00', '2026-11-30T00:00:00')], NOW)).toHaveLength(6)
		expect(mapPeriods([], NOW).map((p) => p.key)).toEqual(['agora', '0'])
	})
	test('warningsInPeriod', () => {
		const [agora, hoje, amanha] = mapPeriods([w('yellow', '2026-11-11T09:00:00', '2026-11-13T00:00:00')], NOW)
		const later = w('red', '2026-11-12T08:00:00', '2026-11-12T12:00:00')
		const nowW = w('yellow', '2026-11-11T09:00:00', '2026-11-11T12:00:00')
		expect(warningsInPeriod([later, nowW], agora)).toEqual([nowW])
		expect(warningsInPeriod([later, nowW], hoje)).toEqual([nowW])
		expect(warningsInPeriod([later, nowW], amanha)).toEqual([later])
	})
})
