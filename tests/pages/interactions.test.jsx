// What a visitor does on each page: filters, sorting, toggles, links — and
// pages fed with odd data (unknown types/areas, -99 everywhere, broken
// catalog entries) must keep rendering.

import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { BROKEN_STATION_ID, STATION_ID, makeFixtures } from '../fixtures/data.js'
import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'

afterEach(() => {
	localStorage.clear()
	document.documentElement.classList.remove('dark')
})

describe('navigation', () => {
	test('the menu links to every main page', async () => {
		mockApi()
		renderRoute('/')
		const nav = await screen.findByRole('navigation')
		const hrefs = within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))
		expect(hrefs).toEqual(['/', '/cronologia', '/historico', '/mapa', '/estacoes', '/criterios'])
	})
	test('district page links to cronologia, histórico and every other area', async () => {
		mockApi()
		renderRoute('/distrito/lisboa')
		expect(await screen.findByRole('link', { name: 'Cronologia hora a hora' })).toHaveAttribute('href', '/cronologia?d=LSB')
		expect(screen.getByRole('link', { name: 'Ver histórico' })).toHaveAttribute('href', '/historico?regiao=lisboa')
		expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/distrito/')).length).toBeGreaterThanOrEqual(24)
	})
	test('clicking a district on the index opens it', async () => {
		mockApi()
		const { user, currentUrl } = renderRoute('/')
		const link = (await screen.findAllByRole('link', { name: /Porto/ })).find((a) => a.getAttribute('href') === '/distrito/porto')
		await user.click(link)
		await waitFor(() => expect(currentUrl()).toBe('/distrito/porto'))
	})
})

describe('theme toggle', () => {
	test('cycles system → light → dark → system and remembers the choice', async () => {
		mockApi()
		const { user } = renderRoute('/criterios')
		const button = () => screen.getByRole('button', { name: /Mudar tema/ })
		await screen.findByRole('heading', { level: 1 })
		expect(button()).toHaveAccessibleName(/automático/)
		await user.click(button())
		expect(localStorage.getItem('theme')).toBe('light')
		expect(document.documentElement).not.toHaveClass('dark')
		await user.click(button())
		expect(localStorage.getItem('theme')).toBe('dark')
		expect(document.documentElement).toHaveClass('dark')
		await user.click(button())
		expect(localStorage.getItem('theme')).toBeNull()
	})
	test('works without localStorage (private mode)', async () => {
		mockApi()
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied')
		})
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied')
		})
		const { user } = renderRoute('/criterios')
		await screen.findByRole('heading', { level: 1 })
		await user.click(screen.getByRole('button', { name: /Mudar tema/ }))
		expect(screen.getByRole('button', { name: /Tema claro/ })).toBeInTheDocument()
	})
})

describe('share buttons', () => {
	test('point to the canonical district URL', async () => {
		mockApi()
		renderRoute('/distrito/lisboa')
		const fb = await screen.findByRole('link', { name: 'Partilhar no Facebook' })
		expect(fb.getAttribute('href')).toContain(encodeURIComponent('https://avisos.pt/distrito/lisboa'))
		expect(screen.getByRole('link', { name: 'Partilhar no WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
	})
	test('copy link writes the URL to the clipboard', async () => {
		mockApi()
		const { user } = renderRoute('/distrito/lisboa')
		const writeText = vi.fn().mockResolvedValue()
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
		await user.click(await screen.findByRole('button', { name: 'Copiar link' }))
		expect(writeText).toHaveBeenCalledWith('https://avisos.pt/distrito/lisboa')
	})
})

describe('/estacoes', () => {
	test('region tabs, sorting and search live in the URL', async () => {
		mockApi()
		const { user, currentUrl } = renderRoute('/estacoes')
		await screen.findByRole('heading', { level: 1 })
		await user.click(screen.getByRole('tab', { name: 'Madeira' }))
		expect(currentUrl()).toBe('/estacoes?regiao=madeira')
		expect(screen.getAllByRole('link', { name: /Funchal \(Teste\)/ }).length).toBeGreaterThan(0)
		expect(screen.queryByRole('link', { name: /^Sines$/ })).not.toBeInTheDocument()
		await user.click(screen.getByRole('tab', { name: 'Todas' }))
		await user.click(screen.getByRole('button', { name: /Pressão/ }))
		expect(currentUrl()).toBe('/estacoes?ordem=pressao')
		await user.type(screen.getByPlaceholderText('Procurar estação ou distrito'), 'braganca')
		await waitFor(() => expect(currentUrl()).toContain('q=braganca'))
		const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
		expect(rows).toHaveLength(1)
		expect(rows[0]).toHaveTextContent('Bragança (Aeródromo)')
	})
	test('a station with -99 everywhere shows dashes and sorts last', async () => {
		mockApi()
		renderRoute('/estacoes')
		await screen.findByRole('heading', { level: 1 })
		const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
		expect(rows.at(-1)).toHaveTextContent('Évora (Aeródromo)')
		expect(rows.at(-1)).not.toHaveTextContent('-99')
	})
})

describe('/historico filters', () => {
	test('period, region, type and event chips update the URL and the query', async () => {
		const { calls } = mockApi()
		const { user, currentUrl } = renderRoute('/historico')
		await screen.findAllByText('Agravado')
		await user.click(screen.getByRole('tab', { name: '24 horas' }))
		expect(currentUrl()).toBe('/historico?periodo=24h')
		await user.selectOptions(screen.getByRole('combobox', { name: 'Região' }), 'lisboa')
		expect(currentUrl()).toContain('regiao=lisboa')
		await user.click(screen.getByRole('button', { name: 'Agravado', pressed: false }))
		expect(currentUrl()).toContain('evento=agravado')
		await waitFor(() => expect(calls.at(-1)).toMatch(/area=LSB.*kind=agravado/))
		await waitFor(() => {
			const items = [...document.querySelectorAll('main ol > li')]
			expect(items.length).toBeGreaterThan(0)
			expect(items.every((li) => /Agravado/.test(li.textContent))).toBe(true)
		})
	})
	test('district names link to the district page', async () => {
		mockApi()
		renderRoute('/historico')
		const links = await screen.findAllByRole('link', { name: 'Lisboa' })
		expect(links[0]).toHaveAttribute('href', '/distrito/lisboa')
	})
})

describe('/cronologia', () => {
	test('picking an area updates ?d= and back to the overview', async () => {
		mockApi()
		const { user, currentUrl } = renderRoute('/cronologia')
		await screen.findByRole('heading', { level: 1, name: 'Cronologia dos avisos' })
		const lisboa = screen.getAllByRole('button').find((b) => /^Lisboa/.test(b.textContent.trim()))
		await user.click(lisboa)
		expect(currentUrl()).toBe('/cronologia?d=LSB')
		expect(await screen.findByRole('heading', { name: 'Avisos por ordem cronológica' })).toBeInTheDocument()
	})
})

describe('/criterios', () => {
	test('region tabs switch the thresholds and are linkable', async () => {
		mockApi()
		const { user, currentUrl } = renderRoute('/criterios')
		await screen.findByRole('heading', { level: 1 })
		const tabs = screen.getAllByRole('tab')
		expect(tabs.length).toBeGreaterThanOrEqual(3)
		await user.click(tabs[1])
		expect(currentUrl()).toMatch(/^\/criterios\?regiao=/)
		expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
	})
})

describe('station page', () => {
	test('range picker and daily section use the series endpoints', async () => {
		const { calls } = mockApi()
		const { user } = renderRoute(`/estacao/${STATION_ID}-lisboa-geofisico`)
		await screen.findByRole('heading', { name: 'Hora a hora' })
		expect(await screen.findByRole('heading', { name: 'Últimos 30 dias' })).toBeInTheDocument()
		const range = screen.getAllByRole('tab').find((t) => /7/.test(t.textContent))
		await user.click(range)
		await waitFor(() => expect(calls).toContain(`/api/stations/${STATION_ID}/observations?hours=168`))
	})
	test('a station that only reports -99 still renders', async () => {
		mockApi()
		renderRoute(`/estacao/${BROKEN_STATION_ID}-evora-aerodromo`)
		expect(await screen.findByRole('heading', { level: 1, name: 'Évora (Aeródromo)' })).toBeInTheDocument()
		expect(document.body).not.toHaveTextContent('-99')
	})
})

describe('district stations section', () => {
	test('metric switcher defaults from the warnings and can be changed', async () => {
		mockApi()
		const { user } = renderRoute('/distrito/lisboa')
		const group = await screen.findByRole('tablist', { name: 'Medida' })
		// Lisboa has an orange wind warning in force → Vento.
		expect(within(group).getByRole('tab', { name: 'Vento' })).toHaveAttribute('aria-selected', 'true')
		await user.click(within(group).getByRole('tab', { name: 'Chuva' }))
		expect(within(group).getByRole('tab', { name: 'Chuva' })).toHaveAttribute('aria-selected', 'true')
	})
})

describe('every page has exactly one h1 (SEO + screen readers)', () => {
	test.each(['/', '/mapa', '/cronologia', '/historico', '/criterios', '/estacoes', '/distrito/lisboa', `/estacao/${STATION_ID}-lisboa-geofisico`, '/xpto'])(
		'%s',
		async (path) => {
			mockApi()
			renderRoute(path)
			await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })
			expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
		}
	)
})

describe('odd data never breaks a page', () => {
	const odd = () => {
		const fx = makeFixtures(new Date())
		fx.warnings.push(
			{ ...fx.warnings[0], awarenessTypeName: 'Granizo' }, // unknown type
			{ ...fx.warnings[0], idAreaAviso: 'XYZ' }, // unknown area
			{ ...fx.warnings[0], text: null }
		)
		fx.history.push({ ...fx.history[0], id: 'x', area: 'XYZ', type: 'Granizo', fromLevel: 'purple', toLevel: null })
		return fx
	}
	test.each(['/', '/cronologia', '/historico', '/distrito/lisboa', '/estacoes'])('%s', async (path) => {
		mockApi({ fx: odd() })
		renderRoute(path)
		expect(await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })).toBeInTheDocument()
		expect(screen.queryByText(/Não foi possível/)).not.toBeInTheDocument()
	})
})
