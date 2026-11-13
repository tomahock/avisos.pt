import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import { makeFixtures } from '../../tests/fixtures/data.js'
import { BORDER_ZONES } from '../data/borderZones.js'
import { borderGroups, borderRegions, parameterText, probabilityText, zonesMetaFrom } from './spain.js'

const zones = JSON.parse(readFileSync(new URL('../../public/data/es-zones.geojson', import.meta.url), 'utf8'))
const meta = zonesMetaFrom(zones)
const { aemetWarnings } = makeFixtures()

describe('parameterText', () => {
	test('empty_parameter_hidden: a parameter without value is absent', () => {
		expect(parameterText({ parameter: 'Costeros: ' })).toBeNull()
		expect(parameterText({ parameter: 'Costeros:' })).toBeNull()
		expect(parameterText({ parameter: '' })).toBeNull()
		expect(parameterText({ parameter: null })).toBeNull()
		expect(parameterText({})).toBeNull()
		expect(parameterText(null)).toBeNull()
	})

	test('a parameter with a value is returned unchanged', () => {
		expect(parameterText({ parameter: 'Rachas máximas: 90 km/h' })).toBe('Rachas máximas: 90 km/h')
	})
})

describe('probabilityText', () => {
	test('range typeset with en dash and spaced percent', () => {
		expect(probabilityText({ probability: '40%-70%' })).toBe('40–70 %')
		expect(probabilityText({ probability: '10%-40%' })).toBe('10–40 %')
	})

	test('missing probability is null', () => {
		expect(probabilityText({ probability: '' })).toBeNull()
		expect(probabilityText({})).toBeNull()
		expect(probabilityText(null)).toBeNull()
	})
})

describe('zonesMetaFrom', () => {
	test('map code → { name, province, ccaa } from the GeoJSON properties', () => {
		expect(meta).toBeInstanceOf(Map)
		expect(meta.get('674901')).toEqual({ name: 'Sanabria', province: '49', ccaa: '67' })
		expect(zonesMetaFrom(null).size).toBe(0)
	})
})

describe('borderGroups', () => {
	test('BGC groups in table order, Sanabria holds its orange warning', () => {
		const groups = borderGroups('BGC', aemetWarnings, meta)
		expect(groups.map((g) => g.code)).toEqual(BORDER_ZONES.BGC)
		const sanabria = groups.find((g) => g.code === '674901')
		expect(sanabria).toMatchObject({ name: 'Sanabria', province: 'Zamora' })
		expect(sanabria.warnings).toHaveLength(1)
		expect(sanabria.warnings[0]).toMatchObject({ awarenessLevelID: 'orange', awarenessTypeName: 'Vento' })
		for (const g of groups.filter((g) => g.code !== '674901')) expect(g.warnings).toEqual([])
		expect(groups.find((g) => g.code === '713203')).toMatchObject({ name: 'Sur de Ourense', province: 'Ourense' })
	})

	test('warnings inside a group are sorted chronologically', () => {
		const early = { ...aemetWarnings[0], startTime: '2026-11-13T08:00:00', awarenessTypeName: 'Neve' }
		const late = { ...aemetWarnings[0], startTime: '2026-11-13T20:00:00' }
		const [, sanabria] = borderGroups('BGC', [late, early], meta)
		expect(sanabria.warnings).toEqual([early, late])
	})

	test('without metadata: falls back to areaName, then to the code', () => {
		const groups = borderGroups('BGC', aemetWarnings, new Map())
		expect(groups.find((g) => g.code === '674901')).toMatchObject({ name: 'Sanabria', province: null })
		expect(groups.find((g) => g.code === '713204')).toMatchObject({ name: '713204', province: null })
		expect(borderGroups('BGC', aemetWarnings, null).map((g) => g.name)[0]).toBe('713204')
	})

	test('district without Spanish neighbours → []', () => {
		expect(borderGroups('LSB', aemetWarnings, meta)).toEqual([])
		expect(borderGroups('BGC', null, meta).every((g) => g.warnings.length === 0)).toBe(true)
	})
})

describe('borderRegions', () => {
	test('VCT borders only Galicia', () => {
		expect(borderRegions('VCT', meta)).toEqual(['Galiza'])
	})

	test('distinct regions in table order', () => {
		expect(borderRegions('BGC', meta)).toEqual(['Galiza', 'Castela e Leão'])
		expect(borderRegions('BJA', meta)).toEqual(['Estremadura', 'Andaluzia'])
	})

	test('no metadata or no neighbours → []', () => {
		expect(borderRegions('VCT', null)).toEqual([])
		expect(borderRegions('LSB', meta)).toEqual([])
	})
})
