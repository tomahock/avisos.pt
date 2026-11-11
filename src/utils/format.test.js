import { describe, expect, test } from 'vitest'

import {
	formatHumidity,
	formatPrecip,
	formatTemp,
	formatWhen,
	formatWind,
	isValid,
	parseWarningTime,
	relativeMinutes,
	windDir,
} from './format.js'

describe('isValid', () => {
	test.each([
		[12.3, true],
		[0, true],
		[-5, true],
		[-99, false],
		[NaN, false],
		[Infinity, false],
		[null, false],
		[undefined, false],
		['12', false],
	])('%s → %s', (v, ok) => expect(isValid(v)).toBe(ok))
})

describe('formatters', () => {
	test('temperature rounds and hides -99', () => {
		expect(formatTemp(17.6)).toBe('18°C')
		expect(formatTemp(-99)).toBeNull()
	})
	test('humidity', () => {
		expect(formatHumidity(81.4)).toBe('81%')
		expect(formatHumidity(-99)).toBeNull()
	})
	test('precipitation drops a trailing .0', () => {
		expect(formatPrecip(0)).toBe('0 mm')
		expect(formatPrecip(2.25)).toBe('2.3 mm')
		expect(formatPrecip(-99)).toBeNull()
	})
	test('wind with and without direction', () => {
		expect(formatWind(31.4, 7)).toBe('31 km/h O')
		expect(formatWind(31.4, 0)).toBe('31 km/h')
		expect(formatWind(31.4, 42)).toBe('31 km/h')
		expect(formatWind(-99, 3)).toBeNull()
	})
	test('wind directions use Portuguese letters', () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(windDir)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO', 'N'])
		expect(windDir(0)).toBeNull()
		expect(windDir(undefined)).toBeNull()
	})
})

describe('parseWarningTime (Lisbon wall-clock → instant)', () => {
	test('winter is UTC+0', () => {
		expect(parseWarningTime('2026-11-11T14:30:00')).toBe(Date.UTC(2026, 10, 11, 14, 30))
	})
	test('summer is UTC+1', () => {
		expect(parseWarningTime('2026-08-11T14:30:00')).toBe(Date.UTC(2026, 7, 11, 13, 30))
	})
	test('seconds are optional', () => {
		expect(parseWarningTime('2026-11-11T14:30')).toBe(Date.UTC(2026, 10, 11, 14, 30))
	})
	test('around the spring-forward switch (29 Mar 2026, 01:00 → 02:00)', () => {
		expect(parseWarningTime('2026-03-29T00:30:00')).toBe(Date.UTC(2026, 2, 29, 0, 30))
		expect(parseWarningTime('2026-03-29T03:00:00')).toBe(Date.UTC(2026, 2, 29, 2, 0))
	})
	test('around the fall-back switch (25 Oct 2026, 02:00 → 01:00)', () => {
		expect(parseWarningTime('2026-10-25T00:30:00')).toBe(Date.UTC(2026, 9, 24, 23, 30))
		expect(parseWarningTime('2026-10-25T03:00:00')).toBe(Date.UTC(2026, 9, 25, 3, 0))
	})
	test('explicit offsets are honoured as-is', () => {
		expect(parseWarningTime('2026-08-11T14:30:00Z')).toBe(Date.UTC(2026, 7, 11, 14, 30))
		expect(parseWarningTime('2026-08-11T14:30:00+02:00')).toBe(Date.UTC(2026, 7, 11, 12, 30))
	})
	test('garbage is NaN, never a throw', () => {
		expect(parseWarningTime(undefined)).toBeNaN()
		expect(parseWarningTime(null)).toBeNaN()
		expect(parseWarningTime(42)).toBeNaN()
		expect(parseWarningTime('ontem')).toBeNaN()
	})
	test('formatWhen shows the visitor-local time and passes garbage through', () => {
		expect(formatWhen('2026-11-11T14:30:00')).toMatch(/11\/11.*14:30/)
		expect(formatWhen('xpto')).toBe('xpto')
	})
})

describe('relativeMinutes', () => {
	const to = new Date('2026-11-11T12:00:00Z')
	const ago = (min) => new Date(to - min * 60000)
	test.each([
		[0, 'agora mesmo'],
		[1, 'há 1 min'],
		[59, 'há 59 min'],
		[60, 'há 1 h'],
		[150, 'há 3 h'],
		[-5, 'agora mesmo'],
	])('%i min → %s', (min, text) => expect(relativeMinutes(ago(min), to)).toBe(text))
})
