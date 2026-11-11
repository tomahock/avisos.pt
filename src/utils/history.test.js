import assert from 'node:assert/strict'
import { test } from 'node:test'

import { groupEventsByDay, historyQuery, lisbonIso } from './history.js'

// 2026-11-11 12:00 Lisbon (= UTC in winter)
const NOW = new Date('2026-11-11T12:00:00Z')
const q = (s) => historyQuery(new URLSearchParams(s), NOW)

test('default is the last 7 days up to now, no filters', () => {
	assert.deepEqual(q(''), {
		from: '2026-11-04T12:00:00',
		to: '2026-11-11T12:00:00',
		area: [],
		type: [],
		kind: [],
	})
})

test('periodo picks the window', () => {
	assert.equal(q('periodo=24h').from, '2026-11-10T12:00:00')
	// 720 h earlier lands in summer time (UTC+1)
	assert.equal(q('periodo=30d').from, '2026-10-12T13:00:00')
	assert.equal(q('periodo=xpto').from, '2026-11-04T12:00:00')
})

test('regiao slug becomes the IPMA code, unknown slugs are ignored', () => {
	assert.deepEqual(q('regiao=lisboa').area, ['LSB'])
	assert.deepEqual(q('regiao=atlantida').area, [])
})

test('tipo slug becomes the awarenessTypeName', () => {
	assert.deepEqual(q('tipo=agitacao-maritima').type, ['Agitação Marítima'])
	assert.deepEqual(q('tipo=xpto').type, [])
})

test('evento keeps only known, visible kinds', () => {
	assert.deepEqual(q('evento=agravado,xpto,texto_alterado,desagravado').kind, ['agravado', 'desagravado'])
})

test('de/ate win over periodo and are capped at 31 days', () => {
	assert.deepEqual(
		[q('periodo=24h&de=2026-11-01&ate=2026-11-05').from, q('periodo=24h&de=2026-11-01&ate=2026-11-05').to],
		['2026-11-01', '2026-11-05']
	)
	const capped = q('de=2026-08-01&ate=2026-11-05')
	assert.deepEqual([capped.from, capped.to], ['2026-10-05', '2026-11-05'])
	assert.equal(q('de=ontem').from, '2026-11-04T12:00:00')
})

test('lisbonIso formats wall-clock Lisbon time (summer = UTC+1)', () => {
	assert.equal(lisbonIso(Date.UTC(2026, 7, 19, 13, 32)), '2026-08-19T14:32:00')
})

test('groupEventsByDay groups by local day, newest first', () => {
	const ev = (occurredAt) => ({ id: occurredAt, occurredAt })
	const groups = groupEventsByDay([ev('2026-11-10T09:00:00'), ev('2026-11-11T08:00:00'), ev('2026-11-10T14:32:00')])
	assert.deepEqual(
		groups.map((g) => [g.day, g.events.map((e) => e.id)]),
		[
			['2026-11-11', ['2026-11-11T08:00:00']],
			['2026-11-10', ['2026-11-10T14:32:00', '2026-11-10T09:00:00']],
		]
	)
})
