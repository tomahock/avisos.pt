import { describe, expect, test } from 'vitest'

import { chartSets, extent, latestLevel, outOfScaleText, reachedText, thresholdDomain, thresholdLines, thresholdsSummary } from './chartThresholds.js'
import { stationThresholds } from './criteriaThresholds.js'

const LSB = chartSets(stationThresholds('LSB'))
const AOR = chartSets(stationThresholds('AOR'))
const rain1h = LSB.chuva.filter((s) => s.key === 'rain1h')

describe('scale rule: data must fill ≥ 50 % of the Y range', () => {
	test('rain from zero = data reach ≥ 50 % of yellow (10 mm)', () => {
		expect(thresholdDomain(0, 5, rain1h)).toMatchObject({ lo: 0, hi: 10 })
		expect(thresholdDomain(0, 5, rain1h).included.has('rain1h')).toBe(true)
		const far = thresholdDomain(0, 4.9, rain1h)
		expect(far).toMatchObject({ lo: 0, hi: 4.9 }) // not squashed
		expect(far.outOfScale.map((s) => s.key)).toEqual(['rain1h'])
	})
	test('temperature: relative to the data span, not to 0 °C', () => {
		// Lisboa: heat yellow 34, cold yellow 3. Data 8–16 °C: cold → range 3–16, data fill 8/13.
		const d = thresholdDomain(8, 16, LSB.temperatura)
		expect([...d.included]).toEqual(['cold'])
		expect(d.outOfScale.map((s) => s.key)).toEqual(['heat'])
		expect(d).toMatchObject({ lo: 3, hi: 16 })
		// 17 °C would be "≥ 50 % of 34" but far from it on a 15–17 chart.
		expect(thresholdDomain(15, 17, LSB.temperatura).included.size).toBe(0)
	})
	test('a threshold inside the data is always included', () => {
		expect(thresholdDomain(0, 30, rain1h).included.has('rain1h')).toBe(true)
	})
	test('no sets → data domain untouched', () => {
		expect(thresholdDomain(2, 9, [])).toMatchObject({ lo: 2, hi: 9, outOfScale: [] })
	})
})

describe('thresholdLines', () => {
	test('stops at the next level not reached by the data', () => {
		const lines = thresholdLines(LSB.chuva, new Set(['rain1h', 'rain6h']), 0, 60, { main: { lo: 0, hi: 11 }, overlay: { lo: 0, hi: 46 } })
		expect(lines.map((l) => [l.key, l.label])).toEqual([
			['rain1h-yellow', 'amarelo 10'],
			['rain1h-orange', 'laranja 21'],
			['rain6h-yellow', '6 h 30'],
			['rain6h-orange', '6 h 41'],
			['rain6h-red', '6 h > 60'],
		])
	})
	test('cold goes downwards; lines outside the scale are dropped', () => {
		const lines = thresholdLines(LSB.temperatura, new Set(['cold']), 0, 20, { main: { lo: 8, hi: 16 } })
		expect(lines.map((l) => l.label)).toEqual(['amarelo 3'])
		const all = thresholdLines(LSB.temperatura, new Set(['cold']), -5, 20)
		expect(all.map((l) => l.label)).toEqual(['amarelo 3', 'laranja 0', 'vermelho < -1'])
	})
	test('gusts are marked as reference', () => {
		const [l] = thresholdLines(AOR.vento, new Set(['gust']), 0, 90, { main: { lo: 60, hi: 80 } })
		expect(l).toMatchObject({ level: 'yellow', value: 85, reference: true, label: 'rajada 85' })
		expect(l.title).toBe('Limiar amarelo (rajada, referência): 85 km/h')
	})
})

test('outOfScaleText names the criterion', () => {
	expect(outOfScaleText(rain1h)).toBe('limiar amarelo 10 mm/h, fora da escala')
	expect(outOfScaleText(LSB.temperatura)).toBe('Tempo Quente: limiar amarelo 34 °C, fora da escala · Tempo Frio: limiar amarelo 3 °C, fora da escala')
	expect(outOfScaleText(LSB.vento)).toBe('rajada: limiar amarelo 70 km/h, fora da escala')
})

test('reachedText: worst level of the direct criteria, never the gust reference', () => {
	expect(reachedText(LSB.chuva, { main: 11, overlay: 46 })).toBe('≥ limiar laranja') // 6 h ≥ 41
	expect(reachedText(LSB.chuva, { main: 9, overlay: 20 })).toBeNull()
	expect(reachedText(LSB.vento, { main: 140 })).toBeNull() // gust = reference only
	expect(reachedText(AOR.vento, { main: 76 })).toBe('≥ limiar laranja') // Açores mean
	expect(reachedText(LSB.range, { hi: 35, lo: 10 })).toBe('≥ limiar amarelo')
	expect(reachedText(LSB.range, { hi: 20, lo: -2 })).toBe('≥ limiar vermelho')
})

test('latestLevel (district chip) only from direct criteria', () => {
	const lsb = stationThresholds('LSB')
	const aor = stationThresholds('AOR')
	expect(latestLevel(lsb, 'chuva', 11)).toBe('yellow')
	expect(latestLevel(lsb, 'temperatura', 2)).toBe('yellow')
	expect(latestLevel(lsb, 'temperatura', 41)).toBe('red')
	expect(latestLevel(lsb, 'vento', 200)).toBeNull() // only gusts there
	expect(latestLevel(aor, 'vento', 68)).toBe('yellow')
	expect(latestLevel(lsb, 'humidade', 100)).toBeNull()
	expect(latestLevel(null, 'chuva', 50)).toBeNull()
	expect(latestLevel(lsb, 'chuva', null)).toBeNull()
})

test('chartSets: mean wind only in the Açores; empty without criteria', () => {
	expect(LSB.vento.map((s) => s.key)).toEqual(['gust'])
	expect(AOR.vento.map((s) => s.key)).toEqual(['gust', 'mean'])
	expect(chartSets(null)).toEqual({ temperatura: [], range: [], chuva: [], vento: [] })
})

test('thresholdsSummary and extent', () => {
	expect(thresholdsSummary(rain1h)).toBe('mm/1h: amarelo 10, laranja 21, vermelho > 40 mm/h')
	expect(extent([3, null, -1, 7])).toEqual({ lo: -1, hi: 7 })
	expect(extent([null])).toBeUndefined()
})
