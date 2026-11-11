import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers.js'

test('three maps with coloured areas, period picker in the URL @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/mapa')
	await expect(page.locator('.leaflet-container')).toHaveCount(3)
	// Lisboa (orange) and Porto (red) municipalities are filled.
	await expect(page.locator('path.leaflet-interactive[fill="#f97316"]').first()).toBeAttached()
	await expect(page.locator('path.leaflet-interactive[fill="#dc2626"]').first()).toBeAttached()
	const picker = page.getByRole('group', { name: 'Período' })
	const buttons = picker.getByRole('button')
	expect(await buttons.count()).toBeGreaterThan(1)
	await buttons.nth(1).click()
	await expect(page).toHaveURL(/\?dia=0/)
	watch.assertClean()
})
