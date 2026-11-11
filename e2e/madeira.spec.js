import { expect, test } from '@playwright/test'

import { noHorizontalScroll, watchErrors } from './helpers.js'

// SRPC, IP-RAM (Madeira) data from the fake FogosPT (tests/fixtures/data.js):
// an active event, 7 occurrences (8 with copies) of the last 6 h — 4 parishes with
// coordinates (São Martinho ×3, Caniço, Santana, Porto Santo), one without
// concelho and one without coordinates.

test('Madeira – Costa Sul: event panel and the area occurrences @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/distrito/madeira-costa-sul')
	const section = page.locator('#ocorrencias-srpc')
	await expect(section.getByRole('heading', { level: 2, name: 'Ocorrências SRPC-RAM' })).toBeVisible()
	const panel = section.getByRole('article', { name: 'Depressão Teste – Precipitação e vento forte' })
	await expect(panel).toBeVisible()
	await expect(panel.getByText('Evento ativo')).toBeVisible()
	await expect(panel.getByText('ER 101')).toBeVisible()
	await expect(panel.getByRole('link', { name: /Aviso à população 18\/2026/ })).toHaveAttribute('href', /procivmadeira\.pt/)
	const list = section.getByRole('list', { name: 'Ocorrências em Madeira – Costa Sul' })
	await expect(list.getByRole('listitem')).toHaveCount(4)
	await expect(list).toContainText('Funchal · São Martinho')
	await expect(list).not.toContainText('Santana')
	await noHorizontalScroll(page)
	watch.assertClean()
})

test('home page links to the Madeira event', async ({ page }) => {
	await page.goto('/')
	const link = page.getByRole('link', { name: /Proteção Civil da Madeira — Depressão Teste/ })
	await expect(link).toBeVisible()
	await link.click()
	await expect(page).toHaveURL(/\/distrito\/madeira-costa-sul$/)
})

const madeiraMap = (page) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Madeira' }) })
const MARKER = '[data-madeira-parish]'

test('/mapa: one marker per parish on the Madeira map, approximate location in the popup @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/mapa')
	const madeira = madeiraMap(page)
	await expect(madeira.locator(MARKER)).toHaveCount(4)
	// Only Madeira's map gets the layer.
	await expect(page.locator(MARKER)).toHaveCount(4)
	await expect(madeira.getByTestId('madeira-occurrences-note')).toContainText('8 ocorrências da Proteção Civil da Madeira (SRPC, IP-RAM) nas últimas 24 h')
	await expect(madeira.getByTestId('madeira-occurrences-note')).toContainText('2 sem localização não aparecem no mapa')

	await madeira.locator(MARKER, { hasText: /^3$/ }).click()
	const popup = madeira.locator('.leaflet-popup')
	await expect(popup).toContainText('São Martinho')
	await expect(popup).toContainText('3 ocorrências nas últimas 24 h · localização aproximada (freguesia)')
	await expect(popup).toContainText('Inundação de estruturas ou superfícies por precipitação intensa ×2')
	watch.assertClean()
})

test('/mapa: the SRPC layer can be turned off, and future days have no occurrences', async ({ page }) => {
	await page.goto('/mapa')
	const madeira = madeiraMap(page)
	await expect(madeira.locator(MARKER)).toHaveCount(4)

	await madeira.locator('.leaflet-control-layers').hover()
	const toggle = madeira.getByLabel('Ocorrências SRPC-RAM')
	await toggle.uncheck()
	await expect(madeira.locator(MARKER)).toHaveCount(0)
	await toggle.check()
	await expect(madeira.locator(MARKER)).toHaveCount(4)

	// Tab 0 = Agora, 1 = today, 2 = tomorrow (fixture warnings last 30 h).
	await page.getByRole('group', { name: 'Período' }).getByRole('button').nth(2).click()
	await expect(page).toHaveURL(/\?dia=1$/)
	await expect(madeira.locator(MARKER)).toHaveCount(0)
	await expect(madeira.getByTestId('madeira-occurrences-note')).toContainText('não aparecem nos dias seguintes')
})

// Review #37: the layer must refresh while /mapa stays open, and a snapshot
// that stopped refreshing must not stay on the map. The browser clock is
// fast-forwarded; the API answers are swapped with page.route.
test('/mapa: SRPC occurrences refresh while the page is open, and a dead feed expires', async ({ page }) => {
	await page.clock.install()
	let mode = 'real'
	let extra = null
	await page.route('**/api/madeira/occurrences', async (route) => {
		if (mode === 'down') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"upstream_error"}' })
		const res = await route.fetch()
		const list = await res.json()
		if (extra) list.unshift(extra)
		return route.fulfill({ response: res, json: list })
	})
	await page.goto('/mapa')
	const madeira = madeiraMap(page)
	await expect(madeira.locator(MARKER)).toHaveCount(4)

	// A new occurrence in a new parish (Machico centroid), recorded "now".
	const now = await page.evaluate(() => Date.now())
	extra = { id: 'nova', copies: 1, start: new Date(now).toISOString(), natureCode: '3301', nature: 'Queda de Árvore', firefighters: 2, vehicles: 1, parishCode: '310403', parish: 'Machico', municipalityCode: '3104', municipality: 'Machico', lat: 32.718, lng: -16.766 }
	await page.clock.fastForward('02:05')
	await expect(madeira.locator(MARKER)).toHaveCount(5)

	mode = 'down'
	await page.clock.fastForward('16:00')
	await expect(madeira.locator(MARKER)).toHaveCount(0)
	await expect(madeira.getByTestId('madeira-occurrences-note')).toContainText('Não foi possível atualizar')
})
