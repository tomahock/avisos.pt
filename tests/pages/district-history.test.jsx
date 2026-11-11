// The warnings history of one area on its district page (#42): same events,
// labels and day grouping as /historico, its own period tabs, a link to the
// full history, empty and error states. Fixtures (tests/fixtures/data.js):
// LSB agravado 2 h + emitido 8 h ago, MCN retirado 27 h ago, PTO desagravado 3 h.

import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'

// Fixed clock: history windows and day labels depend on it.
const NOW = new Date('2026-11-11T14:02:00Z')
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const section = async () => (await screen.findByRole('heading', { level: 2, name: 'Histórico de avisos' }, { timeout: 3000 })).closest('section')
const historyCalls = (calls) => calls.filter((c) => c.startsWith('/api/warnings/history'))

describe('district page history', () => {
	test('Lisboa: only its events, newest first, by day, last 7 days by default', async () => {
		const { calls } = mockApi({ now: NOW })
		renderRoute('/distrito/lisboa')
		const s = await section()
		await within(s).findByText('Agravado')
		const items = within(s).getAllByRole('listitem')
		expect(items.map((li) => li.querySelector('span').textContent)).toEqual(['Agravado', 'Emitido'])
		expect(s).not.toHaveTextContent('Desagravado') // Porto's
		// No area name in each row: they're all Lisboa's.
		expect(within(s).queryByRole('link', { name: 'Lisboa' })).not.toBeInTheDocument()
		expect(within(s).getByRole('heading', { level: 3, name: /quarta-feira, 11 de novembro de 2026/i })).toBeInTheDocument()
		expect(within(s).getByRole('tab', { name: '7 dias' })).toHaveAttribute('aria-selected', 'true')
		// Rounded "now" (5 min) and the area code, like /historico.
		const url = new URL(historyCalls(calls)[0], 'http://x')
		expect(url.searchParams.get('area')).toBe('LSB')
		expect(url.searchParams.get('to')).toBe('2026-11-11T14:00:00')
		expect(url.searchParams.get('from')).toBe('2026-11-04T14:00:00')
	})

	test('links to the full history of the area', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/lisboa')
		const s = await section()
		expect(within(s).getByRole('link', { name: 'Ver histórico completo' })).toHaveAttribute('href', '/historico?regiao=lisboa')
	})

	test('Madeira – Costa Norte: works for the islands; 24 h tab → empty state', async () => {
		const { calls } = mockApi({ now: NOW })
		const { user } = renderRoute('/distrito/madeira-costa-norte')
		const s = await section()
		expect(await within(s).findByText('Retirado')).toBeInTheDocument()
		await user.click(within(s).getByRole('tab', { name: '24 horas' }))
		expect(await within(s).findByText('Sem alterações aos avisos de Madeira – Costa Norte nas últimas 24 horas.')).toBeInTheDocument()
		expect(s).toHaveTextContent('O histórico começou a ser registado a 11 de novembro de 2026.')
		expect(new URL(historyCalls(calls).at(-1), 'http://x').searchParams.get('from')).toBe('2026-11-10T14:00:00')
	})

	test('history endpoint down → the section says so, the rest of the page is fine', async () => {
		mockApi({ now: NOW, overrides: { '/api/warnings/history': 502 } })
		renderRoute('/distrito/lisboa')
		const s = await section()
		expect(await within(s).findByText(/Não foi possível carregar o histórico/)).toBeInTheDocument()
		expect(within(s).getByRole('link', { name: 'Ver histórico completo' })).toBeInTheDocument()
		expect(screen.getAllByText('Aviso Laranja').length).toBeGreaterThan(0)
	})

	test('long histories collapse and expand', async () => {
		const { fx } = mockApi({ now: NOW })
		const base = fx.history[0]
		for (let i = 0; i < 14; i++) fx.history.push({ ...base, id: `extra-${i}`, kind: 'prolongado', occurredAt: base.occurredAt.replace(/T(\d\d)/, (_, h) => `T${String(Math.max(0, Number(h) - 1)).padStart(2, '0')}`) })
		const { user } = renderRoute('/distrito/lisboa')
		const s = await section()
		await waitFor(() => expect(within(s).getAllByRole('listitem')).toHaveLength(10))
		await user.click(within(s).getByRole('button', { name: 'Mostrar as 16 alterações' }))
		expect(within(s).getAllByRole('listitem')).toHaveLength(16)
	})
})
