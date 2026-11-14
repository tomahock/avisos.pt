// Rain accumulated since 00:00 on the station page (#58). Fixture: the heavy
// rain station in Lisboa — 11 mm in the last hour, 7 mm in each of the 6
// before, nothing earlier (tests/fixtures/data.js). Now = 14:00 in Lisbon.

import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { RAIN_STATION_ID } from '../fixtures/data.js'
import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'

const NOW = new Date('2026-11-11T14:00:00Z')
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterEach(() => {
	vi.useRealTimers()
	localStorage.clear()
})

async function section() {
	const heading = await screen.findByRole('heading', { name: 'Chuva acumulada' }, { timeout: 3000 })
	return heading.closest('section')
}

test('today by default: total since 00:00 and a line chart', async () => {
	mockApi({ now: NOW })
	renderRoute(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
	const s = await section()
	expect(within(s).getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')
	// 11 + 6 × 7 = 53 mm since 00:00.
	await waitFor(() => expect(within(s).getByText(/53,0 mm/)).toBeInTheDocument())
	expect(within(s).getByText(/desde as 00:00 de quarta, 11 de novembro/i)).toBeInTheDocument()
	expect(s.querySelector('figure path')).not.toBeNull()
})

test('choosing 3 dias fetches 72 h and keeps accumulating', async () => {
	const api = mockApi({ now: NOW })
	const { user } = renderRoute(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
	const s = await section()
	await user.click(within(s).getByRole('tab', { name: '3 dias' }))
	await waitFor(() => expect(api.calls.some((u) => u.includes(`/stations/${RAIN_STATION_ID}/observations?hours=72`))).toBe(true))
	expect(within(s).getByRole('tab', { name: '3 dias' })).toHaveAttribute('aria-selected', 'true')
	await waitFor(() => expect(within(s).getByText(/desde as 00:00 de segunda, 9 de novembro/i)).toBeInTheDocument())
	// The 72 h fixture drops every 11th hour, including the last one (11 mm):
	// 6 × 7 mm read, 5 hours without a reading in the period → a lower bound.
	expect(within(s).getByText('≥ 42,0 mm')).toBeInTheDocument()
	expect(within(s).getByText(/5 h sem dados/)).toBeInTheDocument()
})

test('without the series endpoint only "Hoje" is offered', async () => {
	mockApi({ now: NOW, overrides: { [`/api/stations/${RAIN_STATION_ID}/observations`]: 502 } })
	renderRoute(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
	const s = await section()
	await waitFor(() => expect(within(s).getByText(/53,0 mm/)).toBeInTheDocument())
	expect(within(s).queryByRole('tab')).toBeNull()
})

test('just after midnight: waiting for the first reading of the day, not "no data"', async () => {
	const early = new Date('2026-11-11T00:20:00Z')
	vi.setSystemTime(early)
	mockApi({ now: early })
	renderRoute(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
	const s = await section()
	await waitFor(() => expect(within(s).getByText(/a primeira leitura do dia é a das 01:00/i)).toBeInTheDocument())
	expect(within(s).queryByText(/Sem leituras de chuva neste período/)).toBeNull()
})
