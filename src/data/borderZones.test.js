// Integrity of the generated public/data/es-zones.geojson and
// src/data/borderZones.js (scripts/build-spain-zones.mjs): every AEMET zone
// present with valid geometry, land zones clipped off Portugal, sea zones off
// the Portuguese sea bands, and the reviewed table of Spanish neighbours of
// each border district.

import { readFileSync } from 'node:fs'

import * as turf from '@turf/turf'
import { beforeAll, describe, expect, test } from 'vitest'

import { BORDER_ZONES, borderZones } from './borderZones.js'
import { ccaaName, provinceName, zoneLabel } from './spainNames.js'

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'))
const zones = read('public/data/es-zones.geojson')
const km2 = (g) => (g ? turf.area(g) / 1e6 : 0)

// The table the script generated, reviewed by hand against the spec's
// expected list (docs/superpowers/specs/2026-11-13-avisos-espanha-design.md,
// §2). Same zones as the spec, with these differences:
// - BORDER_KM is 2, not the spec's starting 5 km: at 5 km VCT also got Rias
//   Baixas (+ its coast; 4.4 km off Vila Nova de Cerveira, beyond A Guarda)
//   and Interior de Pontevedra (2.6 km off Melgaço), and VRL got Montaña de
//   Ourense (3.8 km off Chaves) — none of them reaches the border. Every zone
//   below overlaps the Portuguese outline (distance 0).
// - VCT: Miño de Ourense comes first — the order is by centroid latitude and
//   its centroid is north of Miño de Pontevedra's (the spec listed Pontevedra
//   first).
// - BGC also borders Sur de Ourense (Vilardevós–Vinhais) and Meseta de
//   Salamanca (the Douro, Freixo de Espada à Cinta–Mogadouro); BRG and VRL
//   border only Sur de Ourense (the spec grouped BRG/VRL/BGC together).
// - The spec's "CBR" is Castelo Branco (CBO): Norte de Cáceres, Tajo y Alagón
//   and Meseta cacereña; PTG gets Meseta cacereña (Valencia de Alcántara) and
//   Vegas del Guadiana; EVR Vegas del Guadiana and Sur de Badajoz.
const EXPECTED = {
	VCT: ['713202', '713603', '713603C', '713203'],
	BRG: ['713203'],
	BGC: ['713204', '674901', '713203', '674902', '673701'],
	VRL: ['713203'],
	GDA: ['673701', '701001'],
	CBO: ['701001', '701002', '701003'],
	PTG: ['701003', '700601'],
	EVR: ['700601', '700604'],
	BJA: ['700604', '612101', '612102'],
	FAR: ['612102', '612103', '612103C'],
}

describe('border table', () => {
	test('pins the neighbours of every border district', () => {
		expect(BORDER_ZONES).toEqual(EXPECTED)
		for (const code of ['LSB', 'PTO', 'STB', 'SRT']) expect(BORDER_ZONES[code]).toBeUndefined()
	})

	test('every listed zone exists; coastal zones follow their land twin', () => {
		const codes = new Set(zones.features.map((f) => f.properties.code))
		for (const list of Object.values(BORDER_ZONES)) {
			for (const z of list) expect(codes.has(z), z).toBe(true)
			for (const z of list.filter((c) => c.endsWith('C'))) expect(list).toContain(z.slice(0, -1))
		}
	})

	test('borderZones() reads the table and is empty for unknown codes', () => {
		expect(borderZones('VCT')).toEqual(BORDER_ZONES.VCT)
		expect(borderZones('LSB')).toEqual([])
		expect(borderZones('nope')).toEqual([])
		expect(borderZones(undefined)).toEqual([])
	})
})

describe('es-zones.geojson', () => {
	test('geometry is valid, every zone present', () => {
		expect(zones.features).toHaveLength(192)
		const codes = zones.features.map((f) => f.properties.code)
		expect(new Set(codes).size).toBe(codes.length)
		for (const f of zones.features) {
			expect(['Polygon', 'MultiPolygon'], f.properties.code).toContain(f.geometry.type)
			expect(turf.booleanValid(f), f.properties.code).toBe(true)
			const { name, province, ccaa, coastal, anchor } = f.properties
			expect(typeof name).toBe('string')
			expect(provinceName(province), province).toBeTruthy()
			expect(ccaaName(ccaa), ccaa).toBeTruthy()
			expect(coastal).toBe(f.properties.code.endsWith('C'))
			expect(anchor).toHaveLength(2)
			expect(turf.booleanPointInPolygon(turf.point([anchor[1], anchor[0]]), f), f.properties.code).toBe(true)
		}
	})

	describe('clipped_zones_leave_portugal', () => {
		const land = zones.features.filter((f) => !f.properties.coastal)
		const concelhos = read('public/data/pt-continental.geojson').features
		const hits = ([lng, lat]) => land.filter((f) => turf.booleanPointInPolygon(turf.point([lng, lat]), f)).map((f) => f.properties.code)
		const inPortugal = (p) => concelhos.some((f) => turf.booleanPointInPolygon(turf.point(p), f))
		// Each point is 0.5–1.3 km from the border line of the concelho GeoJSON
		// (Elvas 7.8 km, Badajoz 5.5 km).
		test.each([
			['Valença', [-8.645, 42.028]],
			['Melgaço', [-8.26, 42.11]],
			['Miranda do Douro', [-6.274, 41.494]],
			['Elvas', [-7.163, 38.881]],
			['Vila Real de Santo António', [-7.418, 37.194]],
		])('%s is in no Spanish land zone', (_, p) => {
			expect(inPortugal(p)).toBe(true)
			expect(hits(p)).toEqual([])
		})
		test.each([
			['Tui', [-8.645, 42.047], '713603'],
			['Badajoz', [-6.97, 38.879], '700601'],
		])('%s is in exactly one Spanish land zone', (_, p, code) => {
			expect(inPortugal(p)).toBe(false)
			expect(hits(p)).toEqual([code])
		})

		// AEMET's outlines overlap Portugal by up to 27 km² per zone (Sur de
		// Ourense); after clipping only rounding noise is left.
		let ptLand
		beforeAll(() => {
			ptLand = turf.union(turf.featureCollection(concelhos))
		})
		test('no land zone overlaps Portuguese land', () => {
			const box = turf.bboxPolygon(turf.bbox(ptLand))
			for (const f of land) {
				if (!turf.booleanIntersects(box, turf.bboxPolygon(turf.bbox(f)))) continue
				expect(km2(turf.intersect(turf.featureCollection([f, ptLand]))), f.properties.code).toBeLessThan(0.5)
			}
		})
	})

	test('Spanish land zones neither overlap nor leave gaps between them', () => {
		const land = zones.features.filter((f) => !f.properties.coastal)
		const boxes = land.map((f) => turf.bbox(f))
		const meet = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]
		for (let i = 0; i < land.length; i++) {
			for (let j = i + 1; j < land.length; j++) {
				if (!meet(boxes[i], boxes[j])) continue
				const [a, b] = [land[i], land[j]]
				expect(km2(turf.intersect(turf.featureCollection([a, b]))), `${a.properties.code} × ${b.properties.code}`).toBeLessThan(0.5)
			}
		}
		const union = turf.union(turf.featureCollection(land))
		const polys = union.geometry.type === 'Polygon' ? [union.geometry.coordinates] : union.geometry.coordinates
		for (const hole of polys.flatMap((p) => p.slice(1))) expect(km2(turf.polygon([hole]))).toBeLessThan(0.5)
	})

	describe('sea zones never overlap Portuguese sea bands', () => {
		let bands
		beforeAll(() => {
			bands = read('public/data/sea-bands.geojson').features
		})
		const coastal = zones.features.filter((f) => f.properties.coastal)
		test.each(coastal.map((f) => [f.properties.code, f]))('%s', (_, f) => {
			const box = turf.bboxPolygon(turf.bbox(f))
			for (const b of bands) {
				if (!turf.booleanIntersects(box, turf.bboxPolygon(turf.bbox(b)))) continue
				expect(km2(turf.intersect(turf.featureCollection([f, b]))), b.properties.code).toBeLessThan(1)
			}
		})
	})
})

test('names', () => {
	expect(ccaaName('71')).toBe('Galiza')
	expect(ccaaName('67')).toBe('Castela e Leão')
	expect(provinceName('36')).toBe('Pontevedra')
	expect(provinceName('41')).toBe('Sevilha')
	expect(ccaaName('99')).toBeNull()
	expect(provinceName('99')).toBeNull()
	expect(zoneLabel({ properties: { name: 'Costa - Miño de Pontevedra' } })).toBe('Costa — Miño de Pontevedra')
	expect(zoneLabel({ properties: { name: 'Sanabria' } })).toBe('Sanabria')
})
