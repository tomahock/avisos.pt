import { expect, test } from 'vitest'

import { mapPeriods, warningsInPeriod } from './timeline.js'
import { bandsForRegion, seaBandStyle, seaWarningsByCode } from './seaBands.js'

const w = (idAreaAviso, awarenessLevelID, startTime, endTime, awarenessTypeName = 'Agitação Marítima') => ({
	idAreaAviso,
	awarenessLevelID,
	awarenessTypeName,
	startTime,
	endTime,
	text: 'Ondas.',
})

test('only Agitação Marítima, worst level per area', () => {
	const m = seaWarningsByCode([
		w('FAR', 'yellow', '2026-11-11T06:00:00', '2026-11-11T18:00:00'),
		w('FAR', 'orange', '2026-11-11T18:00:00', '2026-11-12T06:00:00'),
		w('LSB', 'red', '2026-11-11T06:00:00', '2026-11-11T18:00:00', 'Vento'),
		w('MCS', 'purple', '2026-11-11T06:00:00', '2026-11-11T18:00:00'), // unknown level
		null,
	])
	expect([...m.keys()]).toEqual(['FAR'])
	expect(m.get('FAR').level).toBe('orange')
	expect(m.get('FAR').warnings).toHaveLength(2)
	expect(seaWarningsByCode(null).size).toBe(0)
})

test('follows the map period: a later warning only colours its own day', () => {
	const now = new Date('2026-11-11T10:00:00Z')
	const list = [w('FAR', 'yellow', '2026-11-11T06:00:00', '2026-11-11T12:00:00'), w('FAR', 'red', '2026-11-12T06:00:00', '2026-11-12T18:00:00')]
	const periods = mapPeriods(list, now)
	const level = (key) => seaWarningsByCode(warningsInPeriod(list, periods.find((p) => p.key === key))).get('FAR')?.level
	expect(level('agora')).toBe('yellow')
	expect(level('0')).toBe('yellow')
	expect(level('1')).toBe('red')
})

test('bandsForRegion splits the collection per map', () => {
	const fc = { features: ['LSB', 'FAR', 'ACE', 'MCS', 'MPS', 'XYZ'].map((code) => ({ properties: { code } })) }
	expect(bandsForRegion(fc, 'continental').features.map((f) => f.properties.code)).toEqual(['LSB', 'FAR'])
	expect(bandsForRegion(fc, 'acores').features.map((f) => f.properties.code)).toEqual(['ACE'])
	expect(bandsForRegion(fc, 'madeira').features.map((f) => f.properties.code)).toEqual(['MCS', 'MPS'])
	expect(bandsForRegion(null, 'madeira').features).toEqual([])
})

test('style uses the level fill (Leaflet needs hex)', () => {
	expect(seaBandStyle('red')).toMatchObject({ fillColor: '#dc2626', color: '#dc2626' })
	expect(seaBandStyle('nope').fillColor).toBe('#94a3b8')
})
