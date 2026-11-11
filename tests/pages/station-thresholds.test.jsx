// IPMA warning thresholds on the station charts and district sparklines
// (#44). Fixtures near the thresholds (tests/fixtures/data.js): heavy rain in
// Lisboa (11 mm now, 6 h sum 46 mm), strong mean wind in the Açores (68 km/h).

import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { RAIN_STATION_ID, STATION_ID, WIND_STATION_ID } from '../fixtures/data.js'
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

// The <figure> of the chart titled `title`, once its data are drawn.
async function chart(title) {
	await screen.findByRole('heading', { name: 'Hora a hora' }, { timeout: 3000 })
	const fig = (await screen.findAllByText(title, { selector: 'figcaption span' }, { timeout: 3000 }))[0].closest('figure')
	await waitFor(() => expect(within(fig).queryByText('Sem dados')).toBeNull())
	return fig
}
const lines = (el) => [...el.querySelectorAll('line[data-threshold]')].map((l) => `${l.dataset.threshold}${l.dataset.reference ? ' ref' : ''}`)

describe('station page', () => {
	test('heavy rain: mm/1h lines on the bars, 6 h sum line vs mm/6h', async () => {
		mockApi({ now: NOW })
		renderRoute(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
		const fig = await chart('Precipitação por hora')
		await waitFor(() => expect(fig.querySelector('path[data-overlay]')).not.toBeNull())
		// 1 h: yellow reached (11 mm), orange next. 6 h: yellow + orange reached (46 mm), red next.
		expect(lines(fig)).toEqual(['yellow', 'orange', 'yellow', 'orange', 'red'])
		expect(within(fig).getByText('amarelo 10')).toBeInTheDocument()
		expect(within(fig).getByText('6 h 41')).toBeInTheDocument()
		expect(fig).toHaveTextContent('Linha tracejada verde: chuva das últimas 6 h')
		expect(screen.getByText(/Linhas tracejadas: limiares de aviso do IPMA para Lisboa/)).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'critérios' })).toHaveAttribute('href', '/criterios?regiao=continente')
	})

	test('far from the thresholds: the chart is not squashed, the caption says so', async () => {
		mockApi({ now: NOW })
		renderRoute(`/estacao/${STATION_ID}-lisboa-geofisico`)
		const rain = await chart('Precipitação por hora')
		expect(lines(rain)).toEqual([])
		expect(rain.querySelector('[data-out-of-scale]')).toHaveTextContent('limiar amarelo 10 mm/h, fora da escala · 6 h: limiar amarelo 30 mm/6h, fora da escala.')
		const wind = await chart('Vento médio')
		expect(lines(wind)).toEqual([])
		expect(wind).toHaveTextContent('rajada: limiar amarelo 70 km/h, fora da escala.')
		expect(wind).toHaveTextContent('as linhas de rajada são referência')
		const temp = await chart('Temperatura')
		expect(temp).toHaveTextContent('Tempo Quente: limiar amarelo 34 °C, fora da escala')
		expect(temp).toHaveTextContent('Os avisos de Tempo Quente/Frio exigem ≥ 48 h.')
	})

	test('Açores: mean-wind criterion lines compare directly; gust stays a reference note', async () => {
		mockApi({ now: NOW })
		renderRoute(`/estacao/${WIND_STATION_ID}-ponta-delgada-teste`)
		const wind = await chart('Vento médio')
		// 65 reached (68); orange 75 is the next target but above the scale (top 70).
		expect(lines(wind)).toEqual(['yellow'])
		expect(within(wind).getByText('amarelo 65')).toBeInTheDocument()
		expect(wind).toHaveTextContent('rajada: limiar amarelo 85 km/h, fora da escala.')
		expect(wind).toHaveTextContent('(as de vento médio comparam diretamente)')
		expect(within(wind).getByRole('link', { name: 'ver critérios' })).toHaveAttribute('href', '/criterios?regiao=acores')
	})

	test('"Mostrar limiares" turns every line off and is remembered', async () => {
		mockApi({ now: NOW })
		const { user } = renderRoute(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
		const fig = await chart('Precipitação por hora')
		await waitFor(() => expect(lines(fig).length).toBeGreaterThan(0))
		await user.click(screen.getByRole('checkbox', { name: 'Mostrar limiares' }))
		expect(document.querySelectorAll('line[data-threshold], path[data-overlay], [data-out-of-scale]')).toHaveLength(0)
		expect(screen.getByText('Limiares de aviso escondidos')).toBeInTheDocument()
		expect(localStorage.getItem('limiares')).toBe('0')
		await user.click(screen.getByRole('checkbox', { name: 'Mostrar limiares' }))
		expect(lines(fig).length).toBeGreaterThan(0)
		expect(localStorage.getItem('limiares')).toBeNull()
	})
})

describe('district sparklines', () => {
	const card = async (name) => (await screen.findByText(name, {}, { timeout: 3000 })).closest('a')

	test('Lisboa, rain: threshold line and "≥ amarelo" chip on the heavy-rain station only', async () => {
		mockApi({ now: NOW })
		const { user } = renderRoute('/distrito/lisboa')
		const tabs = await screen.findByRole('tablist', { name: 'Medida' })
		await user.click(within(tabs).getByRole('tab', { name: 'Chuva' }))
		const wet = await card('Lisboa, Chuva Forte (Teste)')
		// Bars up to 11 mm: yellow 10 drawn, orange 21 above the sparkline's scale.
		await waitFor(() => expect(lines(wet)).toEqual(['yellow']))
		expect(within(wet).getByText('≥ amarelo')).toBeInTheDocument()
		expect(within(wet).getByRole('img').getAttribute('aria-label')).toContain('Limiares: mm/1h: amarelo 10, laranja 21, vermelho > 40 mm/h')
		const dry = await card('Lisboa (Geofísico)')
		expect(lines(dry)).toEqual([])
		expect(dry.querySelector('[data-level-chip]')).toBeNull()
	})

	test('Açores, wind: chip from the mean-wind criterion', async () => {
		mockApi({ now: NOW })
		const { user } = renderRoute('/distrito/acores-grupo-oriental')
		const tabs = await screen.findByRole('tablist', { name: 'Medida' })
		await user.click(within(tabs).getByRole('tab', { name: 'Vento' }))
		const c = await card('Ponta Delgada (Teste)')
		await waitFor(() => expect(c.querySelector('[data-level-chip="yellow"]')).not.toBeNull())
	})

	test('never a chip from the gust reference lines (Madeira wind)', async () => {
		mockApi({ now: NOW })
		const { user } = renderRoute('/distrito/madeira-costa-sul')
		const tabs = await screen.findByRole('tablist', { name: 'Medida' })
		await user.click(within(tabs).getByRole('tab', { name: 'Vento' }))
		const c = await card('Funchal (Teste)')
		expect(c.querySelector('[data-level-chip]')).toBeNull()
	})

	test('the switch (remembered from the station page) hides lines and chips', async () => {
		localStorage.setItem('limiares', '0')
		mockApi({ now: NOW })
		const { user } = renderRoute('/distrito/lisboa')
		const tabs = await screen.findByRole('tablist', { name: 'Medida' })
		await user.click(within(tabs).getByRole('tab', { name: 'Chuva' }))
		const wet = await card('Lisboa, Chuva Forte (Teste)')
		await waitFor(() => expect(within(wet).getByText('53,0 mm')).toBeInTheDocument())
		expect(lines(wet)).toEqual([])
		expect(wet.querySelector('[data-level-chip]')).toBeNull()
	})
})
