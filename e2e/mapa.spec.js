import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers.js'

const YELLOW = 'path.leaflet-interactive[fill="#facc15"]'

test('three maps with coloured areas @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/mapa')
	await expect(page.locator('.leaflet-container')).toHaveCount(3)
	// Lisboa (orange) and Porto (red) municipalities are filled.
	await expect(page.locator('path.leaflet-interactive[fill="#f97316"]').first()).toBeAttached()
	await expect(page.locator('path.leaflet-interactive[fill="#dc2626"]').first()).toBeAttached()
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
	watch.assertClean()
})

// Fixtures: the only Açores warning (AOR Trovoada, yellow) starts in 4 h, so
// "Agora" leaves the Açores blank and one of the day tabs colours them —
// whatever the time of day.
test('the period picker really filters what the polygons show', async ({ page }) => {
	await page.goto('/mapa')
	const acores = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Açores' }) })
	const picker = page.getByRole('group', { name: 'Período' })
	const tabs = picker.getByRole('button')
	await expect(acores.locator('.leaflet-container')).toBeVisible()
	await expect(acores.locator(YELLOW)).toHaveCount(0)

	const count = await tabs.count()
	expect(count).toBeGreaterThan(1)
	let coloured = false
	for (let i = 1; i < count && !coloured; i++) {
		await tabs.nth(i).click()
		await expect(page).toHaveURL(new RegExp(`\\?dia=${i - 1}$`))
		coloured = (await acores.locator(YELLOW).count()) > 0
	}
	expect(coloured, 'no day tab coloured the Açores').toBe(true)

	await tabs.first().click()
	await expect(acores.locator(YELLOW)).toHaveCount(0)
})
