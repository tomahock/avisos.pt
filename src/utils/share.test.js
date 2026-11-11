import { describe, expect, test } from 'vitest'

import {
	PAGE_META,
	districtPath,
	districtSeo,
	findWarning,
	formatLisbon,
	formatRange,
	slugify,
	sortWarnings,
	warningHeadline,
	warningPath,
	warningSeo,
	warningSlug,
	warningsVersion,
} from './share.js'

const w = (over = {}) => ({
	text: 'Rajadas até 90 km/h.',
	awarenessTypeName: 'Vento',
	idAreaAviso: 'LSB',
	awarenessLevelID: 'orange',
	startTime: '2026-11-11T14:30:00',
	endTime: '2026-11-11T21:00:00',
	...over,
})

describe('slugify', () => {
	test('strips accents, case and punctuation', () => {
		expect(slugify('Agitação Marítima')).toBe('agitacao-maritima')
		expect(slugify('  Tempo  Quente! ')).toBe('tempo-quente')
	})
})

describe('warning URLs (a public URL contract)', () => {
	test('slug = type + Lisbon start, straight from the string', () => {
		expect(warningSlug(w())).toBe('vento-20261111-1430')
		expect(warningSlug(w({ awarenessTypeName: 'Agitação Marítima', startTime: '2026-08-01T00:05:00' }))).toBe(
			'agitacao-maritima-20260801-0005'
		)
	})
	test('path goes under the district', () => {
		expect(warningPath(w())).toBe('/distrito/lisboa/aviso/vento-20261111-1430')
		expect(districtPath('XXX')).toBe('/')
	})
	test('a level change on the same window keeps the URL; findWarning picks the worst', () => {
		const list = [w({ awarenessLevelID: 'yellow' }), w({ awarenessLevelID: 'red' }), w({ idAreaAviso: 'PTO' })]
		expect(findWarning(list, 'LSB', 'vento-20261111-1430').awarenessLevelID).toBe('red')
		expect(findWarning(list, 'LSB', 'vento-20261112-1430')).toBeNull()
		expect(findWarning([], 'LSB', 'x')).toBeNull()
	})
})

describe('Lisbon formatting (identical on server and browser)', () => {
	test('formatLisbon', () => {
		expect(formatLisbon('2026-11-11T14:30:00')).toBe('11 nov, 14:30')
		expect(formatLisbon('2026-08-01T09:05:00')).toBe('1 ago, 09:05')
		expect(formatLisbon('xpto')).toBe('xpto')
	})
	test('formatRange + headline', () => {
		expect(formatRange(w())).toBe('11 nov, 14:30 → 11 nov, 21:00')
		expect(warningHeadline(w())).toBe('Aviso laranja de Vento')
	})
})

describe('SEO copy', () => {
	test('district without data, without warnings and with warnings', () => {
		expect(districtSeo('LSB', null).description).toMatch(/^Avisos meteorológicos do IPMA em vigor para Lisboa/)
		expect(districtSeo('LSB', []).description).toMatch(/^Sem avisos meteorológicos para Lisboa/)
		const seo = districtSeo('LSB', [
			w({ awarenessLevelID: 'yellow', awarenessTypeName: 'Precipitação', endTime: '2026-11-12T06:00:00' }),
			w(),
			w({ idAreaAviso: 'PTO' }),
		])
		expect(seo).toMatchObject({ title: 'Avisos meteorológicos para Lisboa', path: '/distrito/lisboa', worst: 'orange' })
		expect(seo.description).toBe('2 avisos: laranja de Vento; amarelo de Precipitação. Até 12 nov, 06:00.')
	})
	test('warning', () => {
		expect(warningSeo(w())).toEqual({
			title: 'Aviso laranja de Vento — Lisboa',
			description: '11 nov, 14:30 → 11 nov, 21:00. Rajadas até 90 km/h.',
			path: '/distrito/lisboa/aviso/vento-20261111-1430',
			worst: 'orange',
		})
	})
	test('every static page has a title and a description', () => {
		for (const [path, meta] of Object.entries(PAGE_META)) {
			expect(path).toMatch(/^\//)
			expect(meta.title.length).toBeGreaterThan(10)
			expect(meta.description.length).toBeGreaterThan(50)
		}
		expect(Object.keys(PAGE_META)).toEqual(expect.arrayContaining(['/cronologia', '/historico', '/mapa', '/estacoes', '/criterios']))
	})
})

describe('warningsVersion', () => {
	test('order-independent, changes when anything rendered changes', () => {
		const a = [w(), w({ idAreaAviso: 'PTO' })]
		expect(warningsVersion(a)).toBe(warningsVersion([...a].reverse()))
		expect(warningsVersion(a)).not.toBe(warningsVersion([w({ text: 'outro' }), w({ idAreaAviso: 'PTO' })]))
		expect(warningsVersion(a)).not.toBe(warningsVersion([w({ awarenessLevelID: 'red' }), w({ idAreaAviso: 'PTO' })]))
		expect(warningsVersion([])).toMatch(/^[0-9a-z]+$/)
	})
})

test('sortWarnings: chronological, then IPMA legend order', () => {
	const list = [
		w({ awarenessTypeName: 'Vento', startTime: '2026-11-11T10:00:00' }),
		w({ awarenessTypeName: 'Trovoada', startTime: '2026-11-11T10:00:00' }),
		w({ awarenessTypeName: 'Neve', startTime: '2026-11-11T08:00:00' }),
	]
	expect(sortWarnings(list).map((x) => x.awarenessTypeName)).toEqual(['Neve', 'Trovoada', 'Vento'])
	expect(list[0].awarenessTypeName).toBe('Vento') // not mutated
})
