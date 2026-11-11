import assert from 'node:assert/strict'
import { test } from 'node:test'

import { activeWarnings } from './share.js'

const NOW = Date.UTC(2026, 10, 11, 12, 0) // 12:00 Lisbon (winter = UTC)
const w = (endTime) => ({ awarenessTypeName: 'Vento', idAreaAviso: 'LSB', endTime })

test('drops warnings that already ended, keeps the rest', () => {
	assert.deepEqual(activeWarnings([w('2026-11-11T11:59:00'), w('2026-11-11T12:01:00')], NOW), [w('2026-11-11T12:01:00')])
})

test('a warning ending exactly now is still shown', () => {
	assert.equal(activeWarnings([w('2026-11-11T12:00:00')], NOW).length, 1)
})

test('summer time: 12:30 Lisbon is 11:30 UTC', () => {
	const summerNow = Date.UTC(2026, 7, 20, 11, 45)
	assert.deepEqual(activeWarnings([w('2026-08-20T12:30:00'), w('2026-08-20T12:50:00')], summerNow), [w('2026-08-20T12:50:00')])
})

test('non-arrays become an empty list', () => {
	assert.deepEqual(activeWarnings(null, NOW), [])
	assert.deepEqual(activeWarnings({ error: 'x' }, NOW), [])
})
