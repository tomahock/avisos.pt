import { describe, expect, test } from 'vitest'

import { mapEmptyText } from './mapText.js'

describe('mapEmptyText', () => {
	test('Portuguese warnings or none anywhere: the plain texts', () => {
		expect(mapEmptyText({ isNow: true, pt: 0, es: 0 })).toBe('Sem avisos em vigor.')
		expect(mapEmptyText({ isNow: false, pt: 0, es: 0 })).toBe('Sem avisos neste período.')
		expect(mapEmptyText({ isNow: true, pt: 3, es: 2 })).toBe('Sem avisos em vigor.')
		expect(mapEmptyText({ isNow: false, pt: 1, es: 0 })).toBe('Sem avisos neste período.')
	})

	test('only Spanish warnings: the texts say Portugal', () => {
		expect(mapEmptyText({ isNow: true, pt: 0, es: 2 })).toBe('Sem avisos em vigor em Portugal.')
		expect(mapEmptyText({ isNow: false, pt: 0, es: 1 })).toBe('Sem avisos em Portugal neste período.')
	})
})
