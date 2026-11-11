import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { madeiraAreaForConcelho } from '../data/islandConcelhos.js'
import {
	activeEvent,
	areaOccurrences,
	eventAreaOccurrences,
	formatInstant,
	instant,
	isMadeiraArea,
	newestFirst,
	occurrenceArea,
	occurrenceCount,
	occurrenceWindow,
	occurrencesBetween,
	parishGroups,
	totalCount,
	unplacedOccurrences,
} from './madeira.js'

const o = (extra) => ({ id: 'x', copies: 1, start: '2026-11-11T10:00:00Z', ...extra })

test('Madeira concelho names → area, any case/accents', () => {
	expect(madeiraAreaForConcelho('Câmara de Lobos')).toBe('MCS')
	expect(madeiraAreaForConcelho('camara de lobos')).toBe('MCS')
	expect(madeiraAreaForConcelho('SÃO VICENTE')).toBe('MCN')
	expect(madeiraAreaForConcelho('Porto Santo')).toBe('MPS')
	expect(madeiraAreaForConcelho('Sem concelho')).toBeNull()
	expect(madeiraAreaForConcelho('Horta')).toBeNull() // Açores
	expect(madeiraAreaForConcelho(null)).toBeNull()
})

test('isMadeiraArea', () => {
	expect(['MCN', 'MCS', 'MRM', 'MPS'].every(isMadeiraArea)).toBe(true)
	expect(isMadeiraArea('LSB')).toBe(false)
	expect(isMadeiraArea('XYZ')).toBe(false)
})

describe('occurrence → area', () => {
	test.each([
		['3101', 'MCS'], ['3102', 'MCS'], ['3103', 'MCS'], ['3104', 'MCS'], ['3105', 'MCS'], ['3107', 'MCS'], ['3108', 'MCS'],
		['3106', 'MCN'], ['3109', 'MCN'], ['3110', 'MCN'],
		['3201', 'MPS'],
	])('CAOP %s → %s', (municipalityCode, area) => {
		expect(occurrenceArea(o({ municipalityCode }))).toBe(area)
	})
	test('falls back to the concelho name, else null', () => {
		expect(occurrenceArea(o({ municipalityCode: null, municipality: 'Santana' }))).toBe('MCN')
		expect(occurrenceArea(o({ municipalityCode: '9999', municipality: 'Funchal' }))).toBe('MCS')
		expect(occurrenceArea(o({ municipalityCode: null, municipality: null }))).toBeNull()
		expect(occurrenceArea(null)).toBeNull()
	})
	test('areaOccurrences: MRM is the whole main island (not Porto Santo)', () => {
		const list = [o({ id: 'n', municipalityCode: '3109' }), o({ id: 's', municipalityCode: '3103' }), o({ id: 'p', municipalityCode: '3201' }), o({ id: 'u' })]
		expect(areaOccurrences(list, 'MCN').map((x) => x.id)).toEqual(['n'])
		expect(areaOccurrences(list, 'MCS').map((x) => x.id)).toEqual(['s'])
		expect(areaOccurrences(list, 'MPS').map((x) => x.id)).toEqual(['p'])
		expect(areaOccurrences(list, 'MRM').map((x) => x.id)).toEqual(['n', 's'])
		expect(areaOccurrences(list, 'LSB')).toEqual([])
		expect(areaOccurrences(null, 'MCS')).toEqual([])
		expect(unplacedOccurrences(list).map((x) => x.id)).toEqual(['u'])
	})
})

test('copies count, defaulting to 1 for odd values', () => {
	expect(occurrenceCount(o({ copies: 3 }))).toBe(3)
	expect([0, -1, 1.5, 'x', null, undefined].map((copies) => occurrenceCount(o({ copies })))).toEqual([1, 1, 1, 1, 1, 1])
	expect(totalCount([o({ copies: 2 }), o()])).toBe(3)
	expect(totalCount(null)).toBe(0)
})

test('times are UTC instants, shown in the visitor timezone (TZ=Europe/Lisbon in tests)', () => {
	expect(instant('2026-07-11T22:19:00Z').toISOString()).toBe('2026-07-11T22:19:00.000Z')
	expect(instant('lixo')).toBeNull()
	expect(instant(null)).toBeNull()
	// Summer: 22:19 UTC = 23:19 in Lisbon (a Lisbon wall-clock reading would say 22:19).
	expect(formatInstant('2026-07-11T22:19:00Z')).toBe('11/07, 23:19')
	expect(formatInstant('2026-11-11T12:15:00Z')).toBe('11/11, 12:15')
	expect(formatInstant('')).toBeNull()
})

test('newestFirst and occurrencesBetween', () => {
	const list = [o({ id: 'a', start: '2026-11-11T09:00:00Z' }), o({ id: 'b', start: '2026-11-11T11:00:00Z' }), o({ id: 'c', start: null })]
	expect(newestFirst(list).map((x) => x.id)).toEqual(['b', 'a', 'c'])
	const from = Date.parse('2026-11-11T10:00:00Z')
	expect(occurrencesBetween(list, from, from + 3600e3 + 1).map((x) => x.id)).toEqual(['b'])
	expect(occurrencesBetween(list, 0, Infinity).map((x) => x.id)).toEqual(['a', 'b'])
})

test('parishGroups: one per parish, counts copies, skips missing coordinates', () => {
	const groups = parishGroups([
		o({ id: '1', parishCode: '310307', parish: 'São Martinho', municipality: 'Funchal', lat: 32.64, lng: -16.93, start: '2026-11-11T09:00:00Z' }),
		o({ id: '2', parishCode: '310307', parish: 'São Martinho', municipality: 'Funchal', lat: 32.64, lng: -16.93, copies: 2, start: '2026-11-11T11:00:00Z' }),
		o({ id: '3', parishCode: '320101', parish: 'Porto Santo', lat: 33.07, lng: -16.34 }),
		o({ id: '4', parishCode: '310403' }), // before FogosPT/fogosapi#101
		o({ id: '5', lat: null, lng: null }),
		o({ id: '6', lat: '32.6', lng: '-16.9' }), // not numbers
	])
	expect(groups.map((g) => [g.key, g.count])).toEqual([['310307', 3], ['320101', 1]])
	expect(groups[0]).toMatchObject({ parish: 'São Martinho', municipality: 'Funchal', lat: 32.64, lng: -16.93 })
	expect(groups[0].occurrences.map((x) => x.id)).toEqual(['2', '1'])
	expect(parishGroups(null)).toEqual([])
})

describe('occurrenceWindow (map period picker)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-11-11T15:30:00Z'))
	})
	afterEach(() => vi.useRealTimers())
	test('Agora = last 24 h, today = since local midnight, later days = none', () => {
		const now = new Date()
		expect(occurrenceWindow({ key: 'agora' }, now)).toEqual({ from: now.getTime() - 24 * 3600e3, to: now.getTime() + 1, label: 'nas últimas 24 h' })
		expect(occurrenceWindow(undefined, now).label).toBe('nas últimas 24 h')
		expect(occurrenceWindow({ key: '0' }, now)).toEqual({ from: Date.parse('2026-11-11T00:00:00Z'), to: now.getTime() + 1, label: 'hoje' })
		expect(occurrenceWindow({ key: '1' }, now)).toBeNull()
	})
})

describe('event', () => {
	test('activeEvent only passes an active, open event', () => {
		expect(activeEvent({ active: true, status: 'ATIVO' })).toBeTruthy()
		expect(activeEvent({ active: false, status: 'ATIVO' })).toBeNull()
		expect(activeEvent({ active: true, status: 'ENCERRADO' })).toBeNull()
		expect(activeEvent(null)).toBeNull()
	})
	test('eventAreaOccurrences sums the per-concelho totals of the area', () => {
		const event = {
			municipalities: [
				{ name: 'Funchal', occurrences: 30 },
				{ name: 'Santa Cruz', occurrences: 5 },
				{ name: 'Santana', occurrences: 10 },
				{ name: 'Sem concelho', occurrences: 5 },
			],
		}
		expect(eventAreaOccurrences(event, 'MCS')).toBe(35)
		expect(eventAreaOccurrences(event, 'MCN')).toBe(10)
		expect(eventAreaOccurrences(event, 'MRM')).toBe(45)
		expect(eventAreaOccurrences(event, 'MPS')).toBe(0)
		expect(eventAreaOccurrences({ municipalities: [] }, 'MCS')).toBeNull()
		expect(eventAreaOccurrences(null, 'MCS')).toBeNull()
	})
})
