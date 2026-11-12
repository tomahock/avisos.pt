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

// Phones: the legend is a strip under the continental map, never over it, so
// a popup's close button can't end up under it. Wider screens keep the
// overlay legend on every map, as before.
test('a popup close button is never covered by the legend @responsive', async ({ page }) => {
	await page.goto('/mapa')
	const continental = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Portugal Continental' }) })
	const map = continental.locator('.leaflet-container')
	await expect(map).toBeVisible()
	// Overlay legend on each map (sm+), strip only under the continental one.
	await expect(page.getByTestId('map-legend')).toHaveCount(3)
	await expect(page.getByTestId('map-legend-strip')).toHaveCount(1)

	const mobile = (page.viewportSize()?.width ?? 1280) < 640
	await expect(continental.getByTestId('map-legend-strip')).toBeVisible({ visible: mobile })
	await expect(continental.getByTestId('map-legend')).toBeVisible({ visible: !mobile })

	// Open a popup in the north-east (Mirandela, district of Bragança), the
	// part of the country under the overlay legend's corner. Offset from the
	// map centre (39.6, -8.2) at zoom 7, so it holds at any map size.
	const box = await map.boundingBox()
	await map.click({ position: { x: Math.round(box.width / 2 + 93), y: Math.round(box.height / 2 - 225) } })
	const close = map.locator('.leaflet-popup-close-button')
	await expect(close).toBeVisible()
	// Polled: the popup may open past the map's edge and Leaflet auto-pans it
	// into view — what matters is where the button settles.
	await expect
		.poll(
			() =>
				close.evaluate((el) => {
					const r = el.getBoundingClientRect()
					const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
					return hit === el || el.contains(hit)
				}),
			{ message: 'close button is under another element' }
		)
		.toBe(true)
	if (mobile) expect((await close.boundingBox()).width).toBeGreaterThanOrEqual(40)

	await close.click()
	await expect(map.locator('.leaflet-popup')).toHaveCount(0)
})
