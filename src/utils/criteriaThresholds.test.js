import { describe, expect, test } from 'vitest'

import { IPMA_AREA_CODES } from '../data/ipmaAreas.js'
import {
	criteriaRegionForArea,
	levelReached,
	levelStart,
	parseThreshold,
	reaches,
	stationThresholds,
	temperatureRowForArea,
	thresholdText,
} from './criteriaThresholds.js'

describe('parseThreshold', () => {
	test.each([
		['10 a 20', { kind: 'range', lo: 10, hi: 20 }],
		['3 a 1', { kind: 'range', lo: 1, hi: 3 }], // descending, as IPMA writes cold
		['-2 a -1', { kind: 'range', lo: -2, hi: -1 }], // MRM, ascending negative
		['1 a -1', { kind: 'range', lo: -1, hi: 1 }],
		['> 130', { kind: 'gt', value: 130 }],
		['&gt; 130', { kind: 'gt', value: 130 }],
		['< -5', { kind: 'lt', value: -5 }],
		['&lt; -5', { kind: 'lt', value: -5 }],
		['≥ 48', { kind: 'ge', value: 48 }],
		['≤ 2,5', { kind: 'le', value: 2.5 }],
	])('%s', (s, out) => expect(parseThreshold(s)).toEqual(out))
	test.each(['', null, 'muito', '10 - 20', '> x'])('%s → null', (s) => expect(parseThreshold(s)).toBeNull())
})

test('levelStart: the weakest end of the range; > / < are strict', () => {
	expect(levelStart(parseThreshold('10 a 20'), 'up')).toEqual({ value: 10, strict: false })
	expect(levelStart(parseThreshold('3 a 1'), 'down')).toEqual({ value: 3, strict: false })
	expect(levelStart(parseThreshold('-2 a -1'), 'down')).toEqual({ value: -1, strict: false })
	expect(levelStart(parseThreshold('> 40'), 'up')).toEqual({ value: 40, strict: true })
	expect(levelStart(parseThreshold('< -1'), 'down')).toEqual({ value: -1, strict: true })
	expect(levelStart(parseThreshold('< -1'), 'up')).toBeNull() // wrong direction
})

test('reaches / levelReached', () => {
	const rain = stationThresholds('LSB').rain1h
	expect([9.9, 10, 20.5, 21, 40, 40.1].map((v) => levelReached(v, rain))).toEqual([null, 'yellow', 'yellow', 'orange', 'orange', 'red'])
	const cold = stationThresholds('LSB').cold
	expect([3.1, 3, 0.5, 0, -1, -1.1].map((v) => levelReached(v, cold))).toEqual([null, 'yellow', 'yellow', 'orange', 'orange', 'red'])
	expect(reaches(null, { value: 0, strict: false })).toBe(false)
	expect(levelReached(50, null)).toBeNull()
})

test('thresholdText', () => {
	expect(thresholdText({ value: 40, strict: true })).toBe('> 40')
	expect(thresholdText({ value: -1, strict: true }, 'down')).toBe('< -1')
	expect(thresholdText({ value: 2.5, strict: false })).toBe('2,5')
})

test('areas → criteria region and temperature row', () => {
	expect(criteriaRegionForArea('LSB').key).toBe('continente')
	expect(criteriaRegionForArea('MRM').key).toBe('madeira')
	expect(criteriaRegionForArea('ACE').key).toBe('acores')
	expect(criteriaRegionForArea('XYZ')).toBeNull()
	expect(temperatureRowForArea('MRM')[0]).toBe('Regiões Montanhosas')
	expect(temperatureRowForArea('AOC')[0]).toBe('Grupo Ocidental')
	expect(temperatureRowForArea('STB')[0]).toBe('Setúbal')
})

// Every interpreted value, written by hand from IPMA's tables (criterios.js).
// [yellow, orange, red]; red is always strict (> / <), the others ≥ / ≤.
const L = (y, o, r) => [
	{ level: 'yellow', value: y, strict: false },
	{ level: 'orange', value: o, strict: false },
	{ level: 'red', value: r, strict: true },
]
const CONT = { rain1h: [10, 21, 40], rain6h: [30, 41, 60], windGust: [70, 91, 130], windMean: null }
const MAD = CONT
const ACO = { rain1h: [10, 21, 40], rain6h: [25, 41, 60], windGust: [85, 101, 130], windMean: [65, 75, 87] }
// code: [region criteria, heat (max), cold (min)]
const PINNED = {
	VCT: [CONT, [32, 37, 38], [-1, -4, -5]],
	BRG: [CONT, [34, 37, 38], [-1, -4, -5]],
	BGC: [CONT, [34, 37, 38], [-4, -8, -10]],
	PTO: [CONT, [32, 37, 38], [1, -2, -3]],
	VRL: [CONT, [34, 38, 39], [-2, -4, -5]],
	AVR: [CONT, [31, 36, 38], [3, 0, -1]],
	VIS: [CONT, [35, 39, 40], [-2, -5, -7]],
	GDA: [CONT, [31, 34, 36], [-3, -7, -10]],
	CBR: [CONT, [35, 39, 40], [-1, -4, -5]],
	CBO: [CONT, [37, 40, 41], [0, -3, -4]],
	LRA: [CONT, [31, 36, 40], [-1, -4, -6]],
	STM: [CONT, [38, 42, 43], [1, -2, -3]],
	PTG: [CONT, [36, 40, 41], [1, -2, -5]],
	LSB: [CONT, [34, 38, 40], [3, 0, -1]],
	STB: [CONT, [35, 40, 42], [1, -3, -4]],
	EVR: [CONT, [37, 41, 43], [1, -2, -4]],
	BJA: [CONT, [37, 41, 43], [1, -2, -4]],
	FAR: [CONT, [33, 38, 41], [4, 0, -1]],
	AOC: [ACO, [28, 30, 31], [8, 4, 0]],
	ACE: [ACO, [28, 30, 31], [8, 4, 0]],
	AOR: [ACO, [28, 30, 31], [8, 4, 0]],
	MCN: [MAD, [24, 27, 30], [8, 6, 5]],
	MCS: [MAD, [27, 30, 35], [11, 9, 8]],
	MRM: [MAD, [25, 28, 29], [-1, -2, -4]], // "-2 a -1", "-4 a -2": ≤ −1, ≤ −2
	MPS: [MAD, [26, 28, 31], [11, 9, 8]],
}

test('pins cover the 25 areas', () => {
	expect(Object.keys(PINNED).sort()).toEqual([...IPMA_AREA_CODES].sort())
})

describe.each(Object.entries(PINNED))('%s', (code, [crit, heat, cold]) => {
	const t = stationThresholds(code)
	test.each(['rain1h', 'rain6h', 'windGust', 'windMean'])('%s', (key) => {
		if (crit[key] === null) expect(t[key]).toBeNull()
		else expect(t[key].levels).toEqual(L(...crit[key]))
	})
	test('heat / cold', () => {
		expect(t.heat).toMatchObject({ direction: 'up', levels: L(...heat), note: 'aviso exige ≥ 48 h' })
		expect(t.cold).toMatchObject({ direction: 'down', levels: L(...cold) })
		expect(t.windGust.reference).toBe(true)
	})
	test('levels get worse in the criterion direction', () => {
		for (const c of ['rain1h', 'rain6h', 'windGust', 'windMean', 'heat'].map((k) => t[k]).filter(Boolean)) {
			const v = c.levels.map((l) => l.value)
			expect(v[0] < v[1] && v[1] <= v[2], c.label).toBe(true)
		}
		const v = t.cold.levels.map((l) => l.value)
		expect(v[0] > v[1] && v[1] >= v[2]).toBe(true)
	})
})

test('unknown area → null', () => {
	expect(stationThresholds('XYZ')).toBeNull()
})
