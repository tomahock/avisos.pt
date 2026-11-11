import { expect, test } from '@playwright/test'

import { noHorizontalScroll, watchErrors } from './helpers.js'

// IPMA warning thresholds on station charts and district sparklines (#44).
// Fake FogosPT: station 9900010 (Lisboa) rains 11 mm now and 7 mm/h for the
// 6 h before; 9900002 (Ponta Delgada) has a 68 km/h mean wind.
const RAIN = '/estacao/9900010-lisboa-chuva-forte-teste'
const figure = (page, title) => page.locator('figure').filter({ has: page.locator('figcaption', { hasText: title }) }).first()

test('rain chart: threshold lines, 6 h sum and tooltip @responsive', async ({ page, isMobile }) => {
	const watch = watchErrors(page)
	await page.goto(RAIN)
	const rain = figure(page, 'Precipitação por hora')
	await expect(rain.locator('line[data-threshold]')).toHaveCount(5)
	await expect(rain.locator('path[data-overlay]')).toBeAttached()
	await expect(rain.getByText('amarelo 10')).toBeVisible()
	// Hover the latest hour, at the right edge of the plot. Not on touch
	// screens: a tap's pointerleave clears the crosshair right away (existing
	// StationChart behaviour, not part of this test).
	if (!isMobile) {
		const svg = rain.locator('svg')
		const box = await svg.boundingBox()
		await svg.hover({ position: { x: box.width - 16, y: box.height / 2 } })
		await expect(rain).toContainText('11,0 mm · 6 h: 46,0 mm · ≥ limiar laranja')
	}
	await noHorizontalScroll(page)
	watch.assertClean()
})

test('Açores mean wind compares directly; gusts are a reference note', async ({ page }) => {
	await page.goto('/estacao/9900002-ponta-delgada-teste')
	const wind = figure(page, 'Vento médio')
	await expect(wind.locator('line[data-threshold="yellow"]:not([data-reference])')).toHaveCount(1)
	await expect(wind).toContainText('rajada: limiar amarelo 85 km/h, fora da escala.')
})

test('"Mostrar limiares" hides them everywhere and is remembered', async ({ page }) => {
	await page.goto(RAIN)
	const toggle = page.getByRole('checkbox', { name: 'Mostrar limiares' })
	await expect(page.locator('line[data-threshold]').first()).toBeAttached()
	await toggle.uncheck()
	await expect(page.locator('line[data-threshold]')).toHaveCount(0)
	await page.goto('/distrito/lisboa')
	const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Estações meteorológicas em/ }) })
	await section.getByRole('tab', { name: 'Chuva' }).click()
	await expect(section.getByRole('link').filter({ hasText: 'Lisboa, Chuva Forte (Teste)' })).toBeVisible()
	await expect(section.locator('[data-level-chip]')).toHaveCount(0)
	await page.goto(RAIN)
	await expect(page.getByRole('checkbox', { name: 'Mostrar limiares' })).not.toBeChecked()
})

test('district sparklines: line and "≥ amarelo" chip on the heavy-rain station @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/distrito/lisboa')
	const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Estações meteorológicas em/ }) })
	await section.getByRole('tab', { name: 'Chuva' }).click()
	const card = section.getByRole('link').filter({ hasText: 'Lisboa, Chuva Forte (Teste)' })
	await expect(card.locator('[data-level-chip="yellow"]')).toHaveText('≥ amarelo')
	await expect(card.locator('line[data-threshold="yellow"]')).toHaveCount(1)
	await noHorizontalScroll(page)
	watch.assertClean()
})
