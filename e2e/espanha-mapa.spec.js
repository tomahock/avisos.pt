import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers.js'

// AEMET (Spain) zones on the continental map (#56). Fixtures: Sanabria
// 674901 orange (Agora), 713603C coastal yellow (−2 h → +20 h), 713202 Miño
// de Ourense yellow on a Spain-only day (+54 h → +60 h), 612103 «Polvo en
// suspensión» yellow. PT FAR has a yellow sea band too: Spanish coastal zones
// live in their own `es-sea` pane and every Spanish path carries the
// `es-zone es-zone-<code>` classes.
const ES = '.leaflet-es-zones-pane path'
const SEA = '.leaflet-sea-bands-pane path'
const ES_SEA = '.leaflet-es-sea-pane path'
const section = (page, name) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })
const tabs = (page) => page.getByRole('group', { name: 'Período' }).getByRole('button')

test('spanish zones are drawn under the Portuguese polygons @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator(`${ES}[fill="#f97316"]`)).toHaveCount(1)
	const z = await cont.locator('.leaflet-es-zones-pane').evaluate((el) => Number(getComputedStyle(el).zIndex))
	expect(z).toBeGreaterThan(390)
	expect(z).toBeLessThan(400)
	expect(await cont.locator(ES).count()).toBeGreaterThanOrEqual(150)
	await expect(cont.locator(`${ES}.es-zone-674901`)).toHaveAttribute('fill', '#f97316')
	await expect(cont.getByText('Espanha: avisos da AEMET')).toBeVisible()
	// Spain only on the continental map.
	await expect(page.locator('.leaflet-es-zones-pane')).toHaveCount(1)
	watch.assertClean()
})

test('popup says Espanha and AEMET', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await cont.locator(`${ES}[fill="#f97316"]`).dispatchEvent('click')
	const popup = cont.locator('.leaflet-popup')
	await expect(popup).toContainText('Sanabria (Espanha)')
	await expect(popup).toContainText('Vento')
	await expect(popup).toContainText('Limiar: Rachas máximas: 90 km/h')
	await expect(popup).toContainText('Probabilidade: 40–70 %')
	await expect(popup).toContainText('Fonte: AEMET')
	await expect(popup).not.toContainText('Ver página de')
})

test('layer toggle', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator(`${ES}[fill="#f97316"]`)).toHaveCount(1)
	await cont.locator('.leaflet-control-layers').hover()
	const toggle = cont.getByLabel('Avisos em Espanha')
	await toggle.uncheck()
	await expect(cont.locator(ES)).toHaveCount(0)
	await expect(cont.locator(ES_SEA)).toHaveCount(0)
	// Portuguese polygons and the PT sea band are untouched.
	await expect(cont.locator('.leaflet-overlay-pane path.leaflet-interactive[fill="#f97316"]').first()).toBeAttached()
	await expect(cont.locator(SEA)).toHaveCount(1)
	await toggle.check()
	await expect(cont.locator(`${ES}[fill="#f97316"]`)).toHaveCount(1)
})

test('coastal warning paints the sea', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator(`${ES_SEA}.es-zone-713603C`)).toHaveAttribute('fill', '#facc15')
	// Only coastal zones with a warning are drawn, at the sea bands' level.
	await expect(cont.locator(ES_SEA)).toHaveCount(1)
	const z = (sel) => cont.locator(sel).evaluate((el) => Number(getComputedStyle(el).zIndex))
	expect(await z('.leaflet-es-sea-pane')).toBe(await z('.leaflet-sea-bands-pane'))
	// PT FAR's band is still the only path in the Portuguese sea pane.
	await expect(cont.locator(SEA)).toHaveCount(1)
	await expect(cont.locator(`${SEA}.es-zone`)).toHaveCount(0)
	await cont.locator(`${ES_SEA}.es-zone-713603C`).dispatchEvent('click')
	await expect(cont.locator('.leaflet-popup')).toContainText('(Espanha)')
	await expect(cont.locator('.leaflet-popup')).toContainText('Fonte: AEMET')
})

test('period picker drives Spain', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator(`${ES}[fill="#f97316"]`)).toHaveCount(1)
	// Miño de Ourense (+54 h → +60 h) is the latest warning: the last tab.
	await tabs(page).last().click()
	await expect(cont.locator(`${ES}.es-zone-713202`)).toHaveAttribute('fill', '#facc15')
	await expect(cont.locator(`${ES}[fill="#f97316"]`)).toHaveCount(0)
	await expect(cont.locator(ES_SEA)).toHaveCount(0)
})

test('map_without_spain_when_aemet_fails', async ({ page }) => {
	await page.goto('/mapa')
	await expect(section(page, 'Portugal Continental').locator(`${ES}[fill="#f97316"]`)).toHaveCount(1)
	const withSpain = await tabs(page).count()

	await page.route('**/api/aemet/warnings', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{}' }))
	await page.reload()
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator('.leaflet-overlay-pane path.leaflet-interactive[fill="#f97316"]').first()).toBeAttached()
	await cont.locator('.leaflet-control-layers').hover()
	await expect(cont.getByLabel('Agitação marítima (mar)')).toBeAttached()
	await expect(cont.getByLabel('Avisos em Espanha')).toHaveCount(0)
	await expect(page.locator(ES)).toHaveCount(0)
	await expect(cont.getByText('Espanha: avisos da AEMET')).toHaveCount(0)
	// The picker is Portugal's: no Spain-only day, no Spanish counts.
	expect(await tabs(page).count()).toBeLessThan(withSpain)
	await expect(page.getByRole('group', { name: 'Período' })).not.toContainText('em Espanha')
})

// Spanish pills need both «Avisos em Espanha» and «Ícones dos avisos» on.
test('spanish icon pills follow both toggles', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	const sanabria = cont.locator('.leaflet-marker-pane .es-pill-674901')
	await expect(sanabria).toHaveCount(1)
	await sanabria.dispatchEvent('mouseover')
	await expect(cont.locator('.leaflet-tooltip')).toContainText('Sanabria (Espanha)')
	await sanabria.dispatchEvent('mouseout')

	await cont.locator('.leaflet-control-layers').hover()
	const spain = cont.getByLabel('Avisos em Espanha')
	const icons = cont.getByLabel('Ícones dos avisos')

	// Spain on, icons off.
	await icons.uncheck()
	await expect(cont.locator('.es-pill')).toHaveCount(0)
	await expect(cont.locator(`${ES}[fill="#f97316"]`)).toHaveCount(1)

	// Icons on, Spain off: Portuguese pills only.
	await icons.check()
	await spain.uncheck()
	await expect(cont.locator('.es-pill')).toHaveCount(0)
	await expect(cont.locator('.leaflet-marker-pane .leaflet-marker-icon').first()).toBeAttached()

	// Both on again.
	await spain.check()
	await expect(sanabria).toHaveCount(1)
})
