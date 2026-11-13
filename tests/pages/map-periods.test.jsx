// /mapa period picker counts Spain (#56): days come from PT + AEMET
// warnings, each tab's badge = worst level over both countries + separate
// counts. Fixtures (tests/fixtures/data.js `aemetWarnings`): Miño de
// Ourense yellow +54 h → +60 h, a day with no Portuguese warning (PT's last
// end is FAR at +30 h); "Agora"/today also have Sanabria orange, the
// Pontevedra coast and Huelva yellow.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'
import { mapPeriods } from '../../src/utils/timeline.js'

const NOW = new Date('2026-11-13T10:02:00Z')
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

// Not `new URL(…, import.meta.url)`: Vite rewrites it (see tests/helpers/api.js).
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../public/data')
const geojson = (name) =>
	new Response(readFileSync(join(DATA_DIR, name), 'utf8'), {
		headers: { 'content-type': 'application/json' },
	})
const jsonResponse = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// `res` plus a promise settled once the page has consumed it: fetchJson
// reads `ok` and throws on an error status, or awaits `json()`.
function watched(res) {
	let done
	const consumed = new Promise((r) => (done = r))
	const proxy = new Proxy(res, {
		get(target, key) {
			if (key === 'ok' && !target.ok) done()
			if (key === 'json') return async () => {
				const body = await target.json()
				done()
				return body
			}
			const v = Reflect.get(target, key)
			return typeof v === 'function' ? v.bind(target) : v
		},
	})
	return [proxy, consumed]
}

// Overrides that hold the continental GeoJSON (the picker only renders
// once it has loaded) until every response in `responses` has been
// consumed: when the picker appears, those results are already in state.
function gated(responses) {
	const overrides = {}
	const consumed = []
	for (const [path, res] of Object.entries(responses)) {
		const [proxy, p] = watched(res)
		overrides[path] = () => proxy
		consumed.push(p)
	}
	overrides['/data/pt-continental.geojson'] = async () => {
		await Promise.all(consumed)
		return geojson('pt-continental.geojson')
	}
	return overrides
}

const picker = () => screen.findByRole('group', { name: 'Período' }, { timeout: 3000 })
const tabs = (g) => within(g).getAllByRole('button')

describe('/mapa period picker with Spain', () => {
	test('spain_only_day_has_a_tab', async () => {
		const { fx } = mockApi({ now: NOW })
		renderRoute('/mapa')
		const g = await picker()
		const mino = fx.aemetWarnings.find((w) => w.idAreaAviso === '713202')
		const day = new Date(mino.startTime)
		const label = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`
		const tab = await within(g).findByRole('button', { name: new RegExp(label) }, { timeout: 3000 })
		expect(tab).toHaveTextContent('1 zona em Espanha')
		expect(tab).toHaveTextContent('amarelo')
		expect(tab.textContent).not.toMatch(/região/)
	})

	test('today badge counts both', async () => {
		mockApi({ now: NOW })
		renderRoute('/mapa')
		const g = await picker()
		const today = await within(g).findByRole('button', { name: /^Hoje.*zonas em Espanha/ }, { timeout: 3000 })
		expect(today).toHaveTextContent(/\d+ regiões · \d+ zonas em Espanha · vermelho/)
	})

	test('picker falls back to PT when AEMET fails', async () => {
		const { fx, calls } = mockApi({ now: NOW, overrides: gated({ '/api/aemet/warnings': jsonResponse({ error: 'test' }, 502) }) })
		renderRoute('/mapa')
		const g = await picker()
		expect(calls.some((u) => u.includes('/api/aemet/warnings'))).toBe(true)
		const expected = mapPeriods(fx.warnings, NOW).map((p) => p.main)
		const got = tabs(g)
		expect(got).toHaveLength(expected.length)
		got.forEach((t, i) => expect(t.textContent.startsWith(expected[i])).toBe(true))
		expect(g.textContent).not.toMatch(/Espanha/)
	})

	test('es-zones.geojson fails → no Spain counts (the map draws no Spain)', async () => {
		const { fx } = mockApi({ now: NOW })
		// AEMET loaded, its zones not: Spain is not drawn, so not counted either.
		mockApi({
			now: NOW,
			overrides: gated({
				'/api/aemet/warnings': jsonResponse(fx.aemetWarnings),
				'/data/es-zones.geojson': jsonResponse({ error: 'test' }, 404),
			}),
		})
		renderRoute('/mapa')
		const g = await picker()
		const expected = mapPeriods(fx.warnings, NOW).map((p) => p.main)
		const got = tabs(g)
		expect(got).toHaveLength(expected.length)
		got.forEach((t, i) => expect(t.textContent.startsWith(expected[i])).toBe(true))
		expect(g.textContent).not.toMatch(/Espanha/)
		expect(screen.queryByText('Espanha: avisos da AEMET')).not.toBeInTheDocument()
	})

	test('control: with zones and AEMET gated the same way, Spain is counted', async () => {
		const { fx } = mockApi({ now: NOW })
		mockApi({ now: NOW, overrides: gated({ '/api/aemet/warnings': jsonResponse(fx.aemetWarnings), '/data/es-zones.geojson': geojson('es-zones.geojson') }) })
		renderRoute('/mapa')
		const g = await picker()
		expect(g.textContent).toMatch(/zonas? em Espanha/)
	})
})
