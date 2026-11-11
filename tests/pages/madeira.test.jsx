// Madeira area pages and the home page with SRPC, IP-RAM data (via the real
// /api/madeira/* Pages Functions and the fake FogosPT): the event panel, the
// occurrences of each area, MRM = whole island, empty/failing endpoints.

import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { makeFixtures } from '../fixtures/data.js'
import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'

// Fixed clock: the assertions read "há 20 min" and local times. 14:00 UTC =
// 14:00 in Lisbon (November, no DST).
const NOW = new Date('2026-11-11T14:00:00Z')

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const section = async () => {
	const h = await screen.findByRole('heading', { level: 2, name: 'Ocorrências SRPC-RAM' }, { timeout: 3000 })
	return h.closest('section')
}
const occurrenceList = async (name) => screen.findByRole('list', { name: `Ocorrências ${name}` }, { timeout: 3000 })

describe('Madeira – Costa Sul', () => {
	test('event panel: title, period, KPIs, roads, recommendations, communiqués', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/madeira-costa-sul')
		const s = await section()
		const panel = await within(s).findByRole('article', { name: 'Depressão Teste – Precipitação e vento forte' })
		const p = within(panel)
		expect(p.getByText('Evento ativo')).toBeInTheDocument()
		// start = now − 16 h (UTC instant) → 10/11 22:00 local; updated 5 min ago.
		expect(panel).toHaveTextContent('Desde 10/11, 22:00')
		expect(panel).toHaveTextContent('atualizado há 5 min (13:55)')
		expect(p.getByText('Ocorrências').nextSibling).toHaveTextContent('48')
		expect(p.getByText('Em Costa Sul').nextSibling).toHaveTextContent('30')
		expect(p.getByText('Pico').parentElement).toHaveTextContent('ocorrências às 08:00')
		expect(p.getByRole('heading', { name: /Estradas cortadas/ }).parentElement).toHaveTextContent('ER 101 — Cortada ao km 12 devido a derrocada')
		expect(p.getByRole('heading', { name: /Estradas condicionadas/ }).parentElement).toHaveTextContent('VR 1 — Condicionada a uma via')
		expect(p.getByText('Evite deslocações desnecessárias.')).toBeInTheDocument()
		expect(p.getByRole('link', { name: 'Aviso à população 18/2026 – Depressão Teste' })).toHaveAttribute('href', 'https://www.procivmadeira.pt/pt/10-noticias/aviso-18-2026.html')
		// A communiqué without a link is plain text.
		expect(p.getByText('Comunicado sem ligação').tagName).toBe('SPAN')
	})

	test('lists the area occurrences only, newest first, with copies and means', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/madeira-costa-sul')
		const s = await section()
		const list = await occurrenceList('em Madeira – Costa Sul')
		const items = within(list).getAllByRole('listitem')
		expect(items.map((li) => li.querySelector('.font-semibold').textContent)).toEqual([
			'Queda de Árvore',
			'Inundação de estruturas ou superfícies por precipitação intensa',
			'Movimento de massa',
			'Queda de elementos de construção em estruturas edificadas',
		])
		expect(items[0]).toHaveTextContent('Funchal · São Martinho')
		expect(items[0]).toHaveTextContent('há 20 min (13:40)')
		expect(items[0]).toHaveTextContent('2 operacionais · 1 veículo')
		expect(within(items[1]).getByText('×2')).toBeInTheDocument()
		// Copies count: 1 + 2 + 1 + 1.
		expect(s).toHaveTextContent('5 ocorrências nas últimas 24 h em Madeira – Costa Sul')
		expect(within(s).queryByText(/Santana ·/)).not.toBeInTheDocument()
		expect(within(s).queryByText(/Porto Santo ·/)).not.toBeInTheDocument()
		expect(s).toHaveTextContent('Uma ocorrência da Região não tem concelho indicado')
		expect(s).toHaveTextContent('Fonte: SRPC, IP-RAM, via Fogos.pt')
	})
})

test('Costa Norte and Porto Santo get their own occurrences', async () => {
	mockApi({ now: NOW })
	const { unmount } = renderRoute('/distrito/madeira-costa-norte')
	const norte = await occurrenceList('em Madeira – Costa Norte')
	expect(within(norte).getAllByRole('listitem')).toHaveLength(1)
	expect(norte).toHaveTextContent('Santana · Santana')
	expect(screen.getByText('Em Costa Norte').nextSibling).toHaveTextContent('10')
	unmount()

	renderRoute('/distrito/porto-santo')
	const ps = await occurrenceList('em Porto Santo')
	expect(ps).toHaveTextContent('Limpeza de Via e Sinalização de Perigo')
	expect(ps).toHaveTextContent('há 5 h')
})

test('Regiões Montanhosas shows the whole main island and says why', async () => {
	mockApi({ now: NOW })
	renderRoute('/distrito/madeira-regioes-montanhosas')
	const list = await occurrenceList('na ilha da Madeira')
	expect(within(list).getAllByRole('listitem')).toHaveLength(5) // 4 Costa Sul + 1 Costa Norte, not Porto Santo
	expect(list).not.toHaveTextContent('Porto Santo')
	expect(screen.getByText(/atravessam vários concelhos/)).toBeInTheDocument()
	expect(screen.getByText('Na ilha da Madeira').nextSibling).toHaveTextContent('40')
})

test('long lists collapse to 8 and expand', async () => {
	const fx = makeFixtures(NOW)
	const base = fx.madeiraOccurrences[0]
	fx.madeiraOccurrences = Array.from({ length: 11 }, (_, i) => ({ ...base, id: `f${i}` }))
	mockApi({ now: NOW, fx })
	const { user } = renderRoute('/distrito/madeira-costa-sul')
	const list = await occurrenceList('em Madeira – Costa Sul')
	expect(within(list).getAllByRole('listitem')).toHaveLength(8)
	await user.click(screen.getByRole('button', { name: 'Ver todas as 11 ocorrências' }))
	expect(within(list).getAllByRole('listitem')).toHaveLength(11)
})

describe('empty and failing SRPC data', () => {
	test('no event and no occurrences → the section says so, no panel', async () => {
		const fx = makeFixtures(NOW)
		fx.madeiraEvent = null
		fx.madeiraOccurrences = []
		mockApi({ now: NOW, fx })
		renderRoute('/distrito/madeira-costa-sul')
		const s = await section()
		expect(await within(s).findByText(/Sem ocorrências registadas pela proteção civil nas últimas 24 h em Madeira – Costa Sul/)).toBeInTheDocument()
		expect(within(s).queryByRole('article')).not.toBeInTheDocument()
	})
	test('a closed event is not shown', async () => {
		const fx = makeFixtures(NOW)
		fx.madeiraEvent = { ...fx.madeiraEvent, status: 'ENCERRADO', active: false }
		mockApi({ now: NOW, fx })
		renderRoute('/distrito/madeira-costa-sul')
		await occurrenceList('em Madeira – Costa Sul')
		expect(screen.queryByText('Evento ativo')).not.toBeInTheDocument()
	})
	test('occurrences endpoint down → the event panel still shows', async () => {
		mockApi({ now: NOW, overrides: { '/api/madeira/occurrences': 502 } })
		renderRoute('/distrito/madeira-costa-sul')
		expect(await screen.findByText('Evento ativo', {}, { timeout: 3000 })).toBeInTheDocument()
		expect(screen.queryByRole('list', { name: /Ocorrências em/ })).not.toBeInTheDocument()
	})
	test('both endpoints down → no section, the page still renders', async () => {
		const { calls } = mockApi({ now: NOW, overrides: { '/api/madeira/occurrences': 502, '/api/madeira/event': 502 } })
		renderRoute('/distrito/madeira-costa-sul')
		await screen.findByRole('heading', { level: 1, name: 'Avisos meteorológicos para Madeira – Costa Sul' }, { timeout: 3000 })
		await waitFor(() => expect(calls.filter((c) => c.startsWith('/api/madeira/')).length).toBe(2))
		expect(screen.queryByRole('heading', { name: 'Ocorrências SRPC-RAM' })).not.toBeInTheDocument()
	})
	test('continental and Açores pages never ask for SRPC data', async () => {
		const { calls } = mockApi({ now: NOW })
		renderRoute('/distrito/lisboa')
		await screen.findByText(/Queda de árvore/, {}, { timeout: 3000 })
		renderRoute('/distrito/acores-grupo-oriental')
		await screen.findByRole('heading', { level: 1, name: /Açores – Grupo Oriental/ }, { timeout: 3000 })
		expect(calls.filter((c) => c.startsWith('/api/madeira/'))).toEqual([])
		expect(screen.queryByRole('heading', { name: 'Ocorrências SRPC-RAM' })).not.toBeInTheDocument()
	})
})

describe('home page banner', () => {
	test('active event → one line under the Madeira chips, to the busiest area', async () => {
		mockApi({ now: NOW })
		renderRoute('/')
		const link = await screen.findByRole('link', { name: /Proteção Civil da Madeira — Depressão Teste/ }, { timeout: 3000 })
		expect(link).toHaveAttribute('href', '/distrito/madeira-costa-sul')
		expect(link).toHaveTextContent('48 ocorrências desde 10/11, 22:00')
	})
	test('also shown when there are no warnings at all', async () => {
		mockApi({ now: NOW, overrides: { '/api/warnings': [] } })
		renderRoute('/')
		await screen.findByRole('heading', { name: 'Sem avisos meteorológicos' })
		expect(await screen.findByRole('link', { name: /Proteção Civil da Madeira/ })).toBeInTheDocument()
	})
	test('no event → no banner', async () => {
		const fx = makeFixtures(NOW)
		fx.madeiraEvent = null
		const { calls } = mockApi({ now: NOW, fx })
		renderRoute('/')
		await screen.findAllByRole('link', { name: /Lisboa/ })
		await waitFor(() => expect(calls).toContain('/api/madeira/event'))
		await waitFor(() => expect(document.querySelector('.fa-spin')).toBeNull())
		expect(screen.queryByRole('link', { name: /Proteção Civil da Madeira/ })).not.toBeInTheDocument()
	})
})

// Review #37: a retained event must not be advertised forever when its
// refresh keeps failing (same 15-min cutoff as the occurrences).
describe('stale SRPC event after refresh failures', () => {
	// Fake the refresh/clock intervals too, so 16 minutes pass instantly.
	const withClock = () => {
		vi.useRealTimers()
		vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
		vi.setSystemTime(NOW)
	}
	// /api/madeira/event answers normally until `down()`, then 502 — the
	// other endpoints keep going through the real functions.
	const flakyEvent = () => {
		let down = false
		const { fetchMock } = mockApi({ now: NOW })
		const real = fetchMock.getMockImplementation()
		fetchMock.mockImplementation(async (input, init) => {
			const url = typeof input === 'string' ? input : input.url
			if (down && url.startsWith('/api/madeira/event')) return new Response('{}', { status: 502 })
			return real(input, init)
		})
		return { down: () => (down = true) }
	}

	test('home banner: kept through a short outage, gone after 15 min', async () => {
		withClock()
		const flaky = flakyEvent()
		renderRoute('/')
		expect(await screen.findByRole('link', { name: /Proteção Civil da Madeira/ }, { timeout: 3000 })).toBeInTheDocument()
		flaky.down()
		await act(async () => vi.advanceTimersByTime(4 * 60 * 1000))
		expect(screen.getByRole('link', { name: /Proteção Civil da Madeira/ })).toBeInTheDocument()
		await act(async () => vi.advanceTimersByTime(12 * 60 * 1000))
		await waitFor(() => expect(screen.queryByRole('link', { name: /Proteção Civil da Madeira/ })).not.toBeInTheDocument())
	})

	test('district panel: says the event could not be updated, then hides it', async () => {
		withClock()
		const flaky = flakyEvent()
		renderRoute('/distrito/madeira-costa-sul')
		expect(await screen.findByText('Evento ativo', {}, { timeout: 3000 })).toBeInTheDocument()
		flaky.down()
		await act(async () => vi.advanceTimersByTime(4 * 60 * 1000))
		expect(screen.getByText('Evento ativo')).toBeInTheDocument()
		expect(await screen.findByText(/Não foi possível atualizar o evento — dados das 14:00/)).toBeInTheDocument()
		await act(async () => vi.advanceTimersByTime(12 * 60 * 1000))
		await waitFor(() => expect(screen.queryByText('Evento ativo')).not.toBeInTheDocument())
		// The occurrences kept refreshing fine and stay.
		expect(screen.getByRole('list', { name: 'Ocorrências em Madeira – Costa Sul' })).toBeInTheDocument()
	})
})
