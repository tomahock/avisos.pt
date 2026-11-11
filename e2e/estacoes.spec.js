import { expect, test } from '@playwright/test'

import { noHorizontalScroll, watchErrors } from './helpers.js'

// /estacoes (#46): on phones the station names were painted out of step with
// their readings (sticky table cells inside a horizontal scroller, offset by
// some mobile browsers while scrolling) and over the table header.

const tileStation = async (page, label) => (await page.getByRole('link').filter({ hasText: label }).locator('p').last().textContent()).trim()

test('phones: no sticky cells; each station name shares its element with its readings @responsive', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'phone layout')
	const watch = watchErrors(page)
	await page.goto('/estacoes?ordem=intensidadeVentoKM')
	const list = page.getByRole('list', { name: 'Estações' })
	await expect(list.getByRole('listitem').first()).toBeVisible()
	// Root cause: nothing on the page may rely on position: sticky.
	const sticky = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => getComputedStyle(el).position === 'sticky').length)
	expect(sticky).toBe(0)
	// The strongest-wind tile names the first station of the wind-sorted list.
	const first = list.getByRole('listitem').first()
	expect(await first.locator('[data-station-name]').textContent()).toBe(await tileStation(page, 'Vento mais forte'))
	await expect(first.locator('[data-primary]')).toContainText(/km\/h/)
	// Every name sits inside the box of the row that holds its values.
	for (const item of await list.getByRole('listitem').all()) {
		const row = await item.boundingBox()
		for (const part of ['[data-station-name]', '[data-primary]']) {
			const b = await item.locator(part).boundingBox()
			expect(b.y).toBeGreaterThanOrEqual(row.y - 1)
			expect(b.y + b.height).toBeLessThanOrEqual(row.y + row.height + 1)
		}
	}
	await noHorizontalScroll(page)
	watch.assertClean()
})

test('phones: sort select and direction live in the URL @responsive', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'phone layout')
	await page.goto('/estacoes')
	await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('precAcumulada')
	await expect(page).toHaveURL(/\?ordem=precAcumulada$/)
	const list = page.getByRole('list', { name: 'Estações' })
	expect(await list.getByRole('listitem').first().locator('[data-station-name]').textContent()).toBe(await tileStation(page, 'Mais chuva na última hora'))
	await page.getByRole('button', { name: /Ordem: descendente/ }).click()
	await expect(page).toHaveURL(/\?ordem=precAcumulada&dir=asc$/)
})

test('wider screens: table rows hold name and values on one line; header corner stacks above the names', async ({ page }) => {
	await page.setViewportSize({ width: 700, height: 900 })
	await page.goto('/estacoes?ordem=intensidadeVentoKM')
	const table = page.getByRole('table')
	const rows = table.locator('tbody tr')
	await expect(rows.first()).toBeVisible()
	for (const row of (await rows.all()).slice(0, 6)) {
		const cells = await row.locator('td:visible').evaluateAll((tds) => tds.map((td) => { const r = td.getBoundingClientRect(); return [r.top, r.bottom] }))
		for (const [top, bottom] of cells) expect([top, bottom]).toEqual(cells[0])
	}
	const z = await page.evaluate(() => {
		const zi = (el) => Number(getComputedStyle(el).zIndex) || 0
		return { head: zi(document.querySelector('thead th')), body: zi(document.querySelector('tbody td')) }
	})
	expect(z.head).toBeGreaterThan(z.body)
	expect(await table.locator('tbody tr').first().locator('td a').first().textContent()).toBe(await tileStation(page, 'Vento mais forte'))
})
