// /mapa period picker counts Spain (#56): days come from PT + AEMET
// warnings, each tab's badge = worst level over both countries + separate
// counts. Fixtures (tests/fixtures/data.js `aemetWarnings`): Miño de
// Ourense yellow +54 h → +60 h, a day with no Portuguese warning (PT's last
// end is FAR at +30 h); "Agora"/today also have Sanabria orange, the
// Pontevedra coast and Huelva yellow.

import { screen, waitFor, within } from '@testing-library/react'
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
		const { fx, calls } = mockApi({ now: NOW, overrides: { '/api/aemet/warnings': 502 } })
		renderRoute('/mapa')
		const g = await picker()
		await waitFor(() => expect(calls.some((u) => u.includes('/api/aemet/warnings'))).toBe(true))
		await new Promise((r) => setTimeout(r, 50))
		const expected = mapPeriods(fx.warnings, NOW).map((p) => p.main)
		const got = tabs(g)
		expect(got).toHaveLength(expected.length)
		got.forEach((t, i) => expect(t.textContent.startsWith(expected[i])).toBe(true))
		expect(g.textContent).not.toMatch(/Espanha/)
	})
})
