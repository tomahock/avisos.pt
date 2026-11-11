import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
	ACORES_CODES,
	CONTINENTAL_CODES,
	IPMA_AREAS,
	IPMA_AREA_CODES,
	MADEIRA_CODES,
	areaName,
	codeFromContinentalName,
	codeFromSlug,
} from './ipmaAreas.js'
import { codeForFeature } from './islandConcelhos.js'
import { LEVELS, levelMeta, worstLevelId } from './levels.js'
import { STATION_AREAS } from './stationAreas.js'
import { WARNING_TYPE_NAMES, typeRank, warningTypeMeta } from './warningTypes.js'

// Public URL contract: /distrito/<slug>. Changing this list must be deliberate.
const SLUGS = {
	VCT: 'viana-do-castelo',
	BRG: 'braga',
	VRL: 'vila-real',
	BGC: 'braganca',
	PTO: 'porto',
	AVR: 'aveiro',
	VIS: 'viseu',
	GDA: 'guarda',
	CBR: 'coimbra',
	CBO: 'castelo-branco',
	LRA: 'leiria',
	STM: 'santarem',
	PTG: 'portalegre',
	LSB: 'lisboa',
	STB: 'setubal',
	EVR: 'evora',
	BJA: 'beja',
	FAR: 'faro',
	AOC: 'acores-grupo-ocidental',
	ACE: 'acores-grupo-central',
	AOR: 'acores-grupo-oriental',
	MCN: 'madeira-costa-norte',
	MCS: 'madeira-costa-sul',
	MRM: 'madeira-regioes-montanhosas',
	MPS: 'porto-santo',
}

const geojson = (name) => JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8'))

describe('IPMA areas', () => {
	test('25 areas: 18 continental, 3 Açores, 4 Madeira', () => {
		expect(IPMA_AREA_CODES).toHaveLength(25)
		expect(CONTINENTAL_CODES).toHaveLength(18)
		expect(ACORES_CODES).toHaveLength(3)
		expect(MADEIRA_CODES).toHaveLength(4)
	})
	test('slugs are a URL contract', () => {
		expect(Object.fromEntries(IPMA_AREA_CODES.map((c) => [c, IPMA_AREAS[c].slug]))).toEqual(SLUGS)
		for (const [code, slug] of Object.entries(SLUGS)) expect(codeFromSlug(slug)).toBe(code)
		expect(codeFromSlug('xpto')).toBeNull()
	})
	test('every area has a name and coordinates in Portugal', () => {
		for (const c of IPMA_AREA_CODES) {
			const a = IPMA_AREAS[c]
			expect(a.name).toBeTruthy()
			expect(a.lat).toBeGreaterThan(30)
			expect(a.lat).toBeLessThan(43)
			expect(a.lng).toBeGreaterThan(-32)
			expect(a.lng).toBeLessThan(-6)
		}
		expect(areaName('XXX')).toBe('XXX')
	})
})

describe('GeoJSON ↔ areas', () => {
	test('every continental municipality resolves to a district code', () => {
		const features = geojson('pt-continental.geojson').features
		expect(features).toHaveLength(278)
		const codes = new Set(features.map((f) => codeForFeature(f, codeFromContinentalName)))
		expect(codes.has(null)).toBe(false)
		expect([...codes].sort()).toEqual([...CONTINENTAL_CODES].sort())
	})
	test('every island municipality resolves to an island zone (MRM has no polygon)', () => {
		const features = geojson('pt-arquipelagos.geojson').features
		expect(features).toHaveLength(30)
		const unmapped = features.filter((f) => codeForFeature(f, () => null) == null).map((f) => f.properties.con_name)
		expect(unmapped).toEqual([])
		const codes = new Set(features.map((f) => codeForFeature(f, () => null)))
		expect([...codes].sort()).toEqual([...ACORES_CODES, ...MADEIRA_CODES.filter((c) => c !== 'MRM')].sort())
	})
	test('features without properties are tolerated', () => {
		expect(codeForFeature({}, () => 'X')).toBeNull()
	})
})

test('every station maps to a known area', () => {
	const bad = Object.entries(STATION_AREAS).filter(([, code]) => !IPMA_AREAS[code])
	expect(bad).toEqual([])
	expect(Object.keys(STATION_AREAS).length).toBeGreaterThan(150)
})

describe('levels', () => {
	test('Leaflet needs hex colours; priorities are ordered', () => {
		for (const l of Object.values(LEVELS)) expect(l.fill).toMatch(/^#[0-9a-f]{6}$/i)
		expect(LEVELS.red.priority).toBeGreaterThan(LEVELS.orange.priority)
		expect(LEVELS.orange.priority).toBeGreaterThan(LEVELS.yellow.priority)
		expect(LEVELS.yellow.priority).toBeGreaterThan(LEVELS.green.priority)
	})
	test('worstLevelId / levelMeta', () => {
		expect(worstLevelId([{ awarenessLevelID: 'yellow' }, { awarenessLevelID: 'red' }, { awarenessLevelID: 'orange' }])).toBe('red')
		expect(worstLevelId([])).toBeNull()
		expect(levelMeta('purple')).toBe(LEVELS.green)
	})
})

describe('warning types', () => {
	test('known types have an icon and a label; unknown fall back', () => {
		for (const name of WARNING_TYPE_NAMES) {
			const m = warningTypeMeta(name)
			expect(m.icon).toMatch(/^fa-/)
			expect(m.label).toBe(name)
		}
		expect(warningTypeMeta('Granizo')).toEqual({ icon: 'fa-triangle-exclamation', label: 'Granizo' })
		expect(typeRank('Granizo')).toBeGreaterThan(typeRank('Nevoeiro'))
	})
})
