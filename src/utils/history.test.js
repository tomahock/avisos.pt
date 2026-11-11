import { describe, expect, test } from 'vitest'

const expectDeep = (a, b) => expect(a).toEqual(b)
const expectEq = (a, b) => expect(a).toBe(b)

import { HISTORY_PERIODS, areaHistorySearch, groupEventsByDay, historyDayLabel, historyNow, historyQuery, lisbonIso } from './history.js'

// 2026-11-11 12:00 Lisbon (= UTC in winter)
const NOW = new Date('2026-11-11T12:00:00Z')
const q = (s) => historyQuery(new URLSearchParams(s), NOW)

test('default is the last 7 days up to now, no filters', () => {
	expectDeep(q(''), {
		from: '2026-11-04T12:00:00',
		to: '2026-11-11T12:00:00',
		area: [],
		type: [],
		kind: [],
	})
})

test('periodo picks the window', () => {
	expectEq(q('periodo=24h').from, '2026-11-10T12:00:00')
	// 720 h earlier lands in summer time (UTC+1)
	expectEq(q('periodo=30d').from, '2026-10-12T13:00:00')
	expectEq(q('periodo=xpto').from, '2026-11-04T12:00:00')
})

test('regiao slug becomes the IPMA code, unknown slugs are ignored', () => {
	expectDeep(q('regiao=lisboa').area, ['LSB'])
	expectDeep(q('regiao=atlantida').area, [])
})

test('tipo slug becomes the awarenessTypeName', () => {
	expectDeep(q('tipo=agitacao-maritima').type, ['Agitação Marítima'])
	expectDeep(q('tipo=xpto').type, [])
})

test('evento keeps only known, visible kinds', () => {
	expectDeep(q('evento=agravado,xpto,texto_alterado,desagravado').kind, ['agravado', 'desagravado'])
})

test('de/ate win over periodo and are capped at 31 days', () => {
	expectDeep(
		[q('periodo=24h&de=2026-11-01&ate=2026-11-05').from, q('periodo=24h&de=2026-11-01&ate=2026-11-05').to],
		['2026-11-01', '2026-11-05']
	)
	const capped = q('de=2026-08-01&ate=2026-11-05')
	expectDeep([capped.from, capped.to], ['2026-10-05', '2026-11-05'])
	expectEq(q('de=ontem').from, '2026-11-04T12:00:00')
})

test('lisbonIso formats wall-clock Lisbon time (summer = UTC+1)', () => {
	expectEq(lisbonIso(Date.UTC(2026, 7, 19, 13, 32)), '2026-08-19T14:32:00')
})

test('groupEventsByDay groups by local day, newest first', () => {
	const ev = (occurredAt) => ({ id: occurredAt, occurredAt })
	const groups = groupEventsByDay([ev('2026-11-10T09:00:00'), ev('2026-11-11T08:00:00'), ev('2026-11-10T14:32:00')])
	expectDeep(
		groups.map((g) => [g.day, g.events.map((e) => e.id)]),
		[
			['2026-11-11', ['2026-11-11T08:00:00']],
			['2026-11-10', ['2026-11-10T14:32:00', '2026-11-10T09:00:00']],
		]
	)
})

describe('district page helpers', () => {
	test('historyNow rounds down to 5 minutes', () => {
		expect(historyNow(Date.parse('2026-11-11T14:04:59Z')).toISOString()).toBe('2026-11-11T14:00:00.000Z')
		expect(historyNow(Date.parse('2026-11-11T14:05:00Z')).toISOString()).toBe('2026-11-11T14:05:00.000Z')
	})
	test('areaHistorySearch = /historico?regiao=<slug>&periodo=<id> as an API query', () => {
		const now = new Date('2026-11-11T14:00:00Z')
		expect(areaHistorySearch('madeira-costa-norte', '24h', now)).toBe('from=2026-11-10T14%3A00%3A00&to=2026-11-11T14%3A00%3A00&area=MCN')
		expect(new URLSearchParams(areaHistorySearch('lisboa', undefined, now)).get('from')).toBe('2026-11-04T14:00:00')
		expect(new URLSearchParams(areaHistorySearch('lisboa', 'lixo', now)).get('from')).toBe('2026-11-04T14:00:00') // → 7 dias
	})
	test('every period has a phrase for empty states', () => {
		expect(HISTORY_PERIODS.map((p) => p.phrase)).toEqual(['nas últimas 24 horas', 'nos últimos 3 dias', 'nos últimos 7 dias', 'nos últimos 30 dias'])
	})
	test('historyDayLabel', () => {
		expect(historyDayLabel('2026-11-11')).toBe('quarta-feira, 11 de novembro de 2026')
	})
})
