import { describe, expect, test } from 'vitest'

import { defaultStationMetric, rainTotal } from './stationMetrics.js'

const NOW = new Date('2026-11-11T10:00:00Z') // 10:00 Lisbon
const w = (type, level, start, end) => ({ awarenessTypeName: type, awarenessLevelID: level, startTime: start, endTime: end })
const nowW = (type, level = 'yellow') => w(type, level, '2026-11-11T08:00:00', '2026-11-11T20:00:00')
const metric = (list) => defaultStationMetric(list, NOW).metric

describe('defaultStationMetric', () => {
	test('no warnings → temperatura', () => {
		expect(defaultStationMetric([], NOW)).toEqual({ metric: 'temperatura', warning: null })
		expect(defaultStationMetric(null, NOW).metric).toBe('temperatura')
	})
	test.each([
		['Precipitação', 'chuva'],
		['Trovoada', 'chuva'],
		['Vento', 'vento'],
		['Tempo Quente', 'temperatura'],
		['Tempo Frio', 'temperatura'],
		['Neve', 'temperatura'],
		['Nevoeiro', 'humidade'],
	])('%s → %s', (type, m) => expect(metric([nowW(type)])).toBe(m))
	test('Agitação Marítima never decides', () => {
		expect(metric([nowW('Agitação Marítima', 'red'), nowW('Precipitação')])).toBe('chuva')
		expect(metric([nowW('Agitação Marítima', 'red')])).toBe('temperatura')
	})
	test('in force beats starting within 24 h beats later', () => {
		const tonight = w('Precipitação', 'yellow', '2026-11-11T22:00:00', '2026-11-12T06:00:00')
		const later = w('Vento', 'red', '2026-11-13T00:00:00', '2026-11-13T12:00:00')
		expect(metric([later, tonight])).toBe('chuva')
		expect(metric([tonight, nowW('Nevoeiro')])).toBe('humidade')
	})
	test('same urgency: higher level, then IPMA legend order', () => {
		expect(metric([nowW('Precipitação'), nowW('Vento', 'orange')])).toBe('vento')
		expect(metric([nowW('Vento'), nowW('Trovoada')])).toBe('chuva') // Trovoada first in the legend
	})
})

test('rainTotal: missing hours are unknown, not dry', () => {
	expect(rainTotal([0.2, null, 1])).toEqual({ total: 1.2, measured: 2, missing: 1 })
	expect(rainTotal([null, null])).toEqual({ total: null, measured: 0, missing: 2 })
	expect(rainTotal([])).toEqual({ total: null, measured: 0, missing: 0 })
})
