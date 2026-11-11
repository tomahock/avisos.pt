import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers.js'

// Sea bands for "Agitação Marítima" (public/data/sea-bands.geojson). Fixtures:
// FAR yellow from −3 h to +30 h (every tab up to tomorrow) and MPS orange
// from +5 h (never "Agora", always one of the day tabs).
const BANDS = '.leaflet-sea-bands-pane path'
const section = (page, name) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })

test('Faro gets a yellow sea band under the land polygons @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator(`${BANDS}[fill="#facc15"]`)).toHaveCount(1)
	// Only areas with a sea-state warning get a band (no Lisboa/Porto at sea).
	await expect(cont.locator(BANDS)).toHaveCount(1)
	// The band pane sits below the overlay pane (land polygons on top).
	const z = await cont.locator('.leaflet-sea-bands-pane').evaluate((el) => Number(getComputedStyle(el).zIndex))
	expect(z).toBeLessThan(400)
	await expect(cont.getByText('Faixa no mar (20 km):')).toBeVisible()
	watch.assertClean()
})

test('the band popup lists the area sea-state warning', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await cont.locator(BANDS).first().dispatchEvent('click')
	const popup = cont.locator('.leaflet-popup')
	await expect(popup).toContainText('Faro — mar')
	await expect(popup).toContainText('Agitação Marítima')
	await expect(popup).toContainText('Ondas de sudoeste com 4 a 5 metros.')
})

test('the sea layer can be turned off and on', async ({ page }) => {
	await page.goto('/mapa')
	const cont = section(page, 'Portugal Continental')
	await expect(cont.locator(BANDS)).toHaveCount(1)
	await cont.locator('.leaflet-control-layers').hover()
	const toggle = cont.getByLabel('Agitação marítima (mar)')
	await toggle.uncheck()
	await expect(cont.locator(BANDS)).toHaveCount(0)
	// Land polygons are untouched.
	await expect(cont.locator('path.leaflet-interactive[fill="#f97316"]').first()).toBeAttached()
	await toggle.check()
	await expect(cont.locator(BANDS)).toHaveCount(1)
})

test('the period picker drives the sea bands like the polygons', async ({ page }) => {
	await page.goto('/mapa')
	const madeira = section(page, 'Madeira')
	const orange = madeira.locator(`${BANDS}[fill="#f97316"]`)
	await expect(madeira.locator('.leaflet-container')).toBeVisible()
	await expect(orange).toHaveCount(0)

	const tabs = page.getByRole('group', { name: 'Período' }).getByRole('button')
	const count = await tabs.count()
	let shaded = false
	for (let i = 1; i < count && !shaded; i++) {
		await tabs.nth(i).click()
		await expect(page).toHaveURL(new RegExp(`\\?dia=${i - 1}$`))
		shaded = (await orange.count()) === 1
	}
	expect(shaded, 'no day tab shaded the Porto Santo sea').toBe(true)

	await tabs.first().click()
	await expect(orange).toHaveCount(0)
})
