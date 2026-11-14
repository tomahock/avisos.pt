import { expect, test } from '@playwright/test'

import { RAIN_STATION_ID } from '../tests/fixtures/data.js'
import { watchErrors } from './helpers.js'

// Rain accumulated since 00:00 on the station page (#58).
test('station page shows the accumulated rain with its own period picker @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto(`/estacao/${RAIN_STATION_ID}-lisboa-chuva-forte-teste`)
	const s = page.locator('section', { has: page.getByRole('heading', { name: 'Chuva acumulada' }) })
	await expect(s.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')
	await s.getByRole('tab', { name: '7 dias' }).click()
	await expect(s.getByText(/Total/)).toBeVisible()
	await expect(s.locator('figure path').first()).toBeAttached()
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
	watch.assertClean()
})
