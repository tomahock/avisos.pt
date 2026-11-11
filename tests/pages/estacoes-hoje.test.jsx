// /estacoes "since 00:00" columns (#48): Máx., Mín., Vento máx., Chuva desde 0h,
// computed by the /api/observations function from the fixtures' 24 h.

import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'

// 14:00 UTC = 14:00 Lisbon (November) → today = 00:00…14:00 (15 h, rain 01:00…14:00).
const NOW = new Date('2026-11-11T14:00:00Z')
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const table = async () => {
	await screen.findByRole('heading', { level: 1 })
	const t = await screen.findByRole('table')
	await waitFor(() => expect(within(t).getAllByRole('row').length).toBeGreaterThan(5))
	return t
}
const header = (t, name) => within(t).getByRole('columnheader', { name: new RegExp(`^${name}`) })
const col = (t, name) => [...within(t).getAllByRole('columnheader')].indexOf(header(t, name))
const cell = (t, station, name) => {
	const row = within(t).getAllByRole('row').find((r) => r.querySelector('td a')?.textContent === station)
	return row.children[col(t, name)]
}

test('the four columns, with the gust caveat', async () => {
	mockApi({ now: NOW })
	renderRoute('/estacoes')
	const t = await table()
	expect(within(t).getAllByRole('columnheader').map((h) => h.textContent.trim())).toEqual([
		'Estação', 'Distrito / região', 'Temp.', 'Máx.', 'Mín.', 'Vento', 'Vento máx.', 'Chuva 1 h', 'Chuva desde 0h', 'Humidade', 'Pressão',
	])
	expect(header(t, 'Vento máx.')).toHaveAttribute('title', 'Maior vento médio horário desde as 00h — o IPMA não publica a rajada em tempo real')
	expect(screen.getByText(/o IPMA não publica a rajada em tempo real\. Ao ordenar/)).toBeInTheDocument()
	expect(t).not.toHaveTextContent(/rajada/i)
})

test('rain since 00:00: total of today, ≥ when hours are missing, — without readings', async () => {
	mockApi({ now: NOW })
	renderRoute('/estacoes')
	const t = await table()
	// Heavy-rain fixture: 11 mm now + 7 mm in each of the 6 hours before, 0 earlier.
	expect(cell(t, 'Lisboa, Chuva Forte (Teste)', 'Chuva desde 0h')).toHaveTextContent('53,0 mm')
	// Sines misses one hour (5 h ago) → lower bound with the count.
	const sines = cell(t, 'Sines', 'Chuva desde 0h')
	expect(sines).toHaveTextContent(/^≥ /)
	expect(sines.querySelector('[title]')).toHaveAttribute('title', '1 h sem leitura desde as 00h')
	// Évora reports -99 everywhere.
	expect(cell(t, 'Évora (Aeródromo)', 'Máx.')).toHaveTextContent('—')
	expect(cell(t, 'Évora (Aeródromo)', 'Chuva desde 0h')).toHaveTextContent('—')
})

test('Açores stations count from the Azores midnight', async () => {
	mockApi({ now: NOW })
	renderRoute('/estacoes')
	const t = await table()
	// Ponta Delgada wind fixture: 68 now, 58 + (hours ago % 5) × 2 before → max today 68.
	expect(cell(t, 'Ponta Delgada (Teste)', 'Vento máx.')).toHaveTextContent('68 km/h')
})

test('sortable like the others; ?ordem= in the URL', async () => {
	mockApi({ now: NOW })
	const { user, currentUrl } = renderRoute('/estacoes')
	const t = await table()
	await user.click(within(header(t, 'Máx.')).getByRole('button'))
	expect(currentUrl()).toBe('/estacoes?ordem=tmax')
	await waitFor(() => expect(within(t).getAllByRole('row')[1]).toHaveTextContent('Beja, Calor (Teste)'))
	expect(header(t, 'Máx.')).toHaveAttribute('aria-sort', 'descending')
	await user.click(within(header(t, 'Chuva desde 0h')).getByRole('button'))
	expect(currentUrl()).toBe('/estacoes?ordem=chuvaHoje')
	await waitFor(() => expect(within(t).getAllByRole('row')[1]).toHaveTextContent('Lisboa, Chuva Forte (Teste)'))
	// Mín. sorts coldest first by default.
	await user.click(within(header(t, 'Mín.')).getByRole('button'))
	expect(currentUrl()).toBe('/estacoes?ordem=tmin')
	expect(header(t, 'Mín.')).toHaveAttribute('aria-sort', 'ascending')
})

test('observations without `today` (older function) → dashes, page fine', async () => {
	mockApi({ now: NOW, overrides: { '/api/observations': { hour: '2026-11-11T14:00', stations: {} } } })
	renderRoute('/estacoes')
	const t = await table()
	expect(cell(t, 'Sines', 'Máx.')).toHaveTextContent('—')
})
