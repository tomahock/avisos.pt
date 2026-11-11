import { expect, test } from '@playwright/test'

import { noHorizontalScroll, watchErrors } from './helpers.js'

// "Since 00:00" columns on /estacoes (#48). Values depend on the time of day
// (fixtures are relative to the mock's start), so only structure, sorting and
// the URL contract are asserted here; exact values are in the page tests.

test('desktop: the four new columns, sortable, with the gust caveat', async ({ page, isMobile }) => {
	test.skip(isMobile, 'table layout')
	const watch = watchErrors(page)
	await page.goto('/estacoes')
	const table = page.getByRole('table')
	for (const name of ['Máx.', 'Mín.', 'Vento máx.', 'Chuva desde 0h']) await expect(table.getByRole('columnheader', { name, exact: true })).toBeVisible()
	await expect(table.getByRole('columnheader', { name: 'Vento máx.', exact: true })).toHaveAttribute('title', /o IPMA não publica a rajada em tempo real/)
	await table.getByRole('button', { name: 'Chuva desde 0h' }).click()
	await expect(page).toHaveURL(/\?ordem=chuvaHoje$/)
	await expect(table.getByRole('columnheader', { name: 'Chuva desde 0h', exact: true })).toHaveAttribute('aria-sort', 'descending')
	await table.getByRole('button', { name: 'Mín.' }).click()
	await expect(page).toHaveURL(/\?ordem=tmin$/)
	await expect(table.getByRole('columnheader', { name: 'Mín.', exact: true })).toHaveAttribute('aria-sort', 'ascending')
	watch.assertClean()
})

test('phones: "Hoje" line under each station and the new sorts in the select @responsive', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'phone layout')
	const watch = watchErrors(page)
	await page.goto('/estacoes')
	const list = page.getByRole('list', { name: 'Estações' })
	await expect(list.locator('[data-today]').first()).toContainText(/^Hoje /)
	await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('ventoMax')
	await expect(page).toHaveURL(/\?ordem=ventoMax$/)
	await expect(list.getByRole('listitem').first().locator('[data-primary]')).toContainText(/km\/h/)
	await noHorizontalScroll(page)
	watch.assertClean()
})
