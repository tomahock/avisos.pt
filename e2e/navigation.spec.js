import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers.js'

test('the menu reaches every page without full reloads breaking', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/')
	const nav = page.getByRole('navigation')
	for (const [name, url, h1] of [
		['Cronologia', '/cronologia', 'Cronologia dos avisos'],
		['Histórico', '/historico', 'Histórico de avisos'],
		['Mapa', '/mapa', 'Mapa dos avisos meteorológicos em Portugal'],
		['Estações', '/estacoes', 'Estações meteorológicas IPMA'],
		['Critérios', '/criterios', 'Critérios de emissão de avisos'],
		['Avisos', '/', 'Avisos meteorológicos em vigor em Portugal'],
	]) {
		await nav.getByRole('link', { name, exact: true }).click()
		await expect(page).toHaveURL(url)
		await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeAttached()
	}
	watch.assertClean()
})

test('index → district → warning → back', async ({ page }) => {
	await page.goto('/')
	await page.locator('a[href="/distrito/lisboa"]').first().click()
	await expect(page.getByRole('heading', { level: 1, name: 'Avisos meteorológicos para Lisboa' })).toBeVisible()
	await page.locator('a[href^="/distrito/lisboa/aviso/"]').first().click()
	await expect(page).toHaveURL(/\/distrito\/lisboa\/aviso\//)
	await page.goBack()
	await expect(page).toHaveURL('/distrito/lisboa')
})

test('filters live in the URL and survive a reload', async ({ page }) => {
	await page.goto('/historico')
	await page.getByRole('combobox', { name: 'Região' }).selectOption('lisboa')
	await page.getByRole('button', { name: 'Agravado', exact: true }).click()
	await expect(page).toHaveURL(/regiao=lisboa/)
	await expect(page).toHaveURL(/evento=agravado/)
	await page.reload()
	await expect(page.getByRole('combobox', { name: 'Região' })).toHaveValue('lisboa')
	await expect(page.getByRole('button', { name: 'Agravado', exact: true })).toHaveAttribute('aria-pressed', 'true')

	await page.goto('/estacoes')
	await page.getByRole('tab', { name: 'Madeira' }).click()
	await page.reload()
	await expect(page.getByRole('tab', { name: 'Madeira' })).toHaveAttribute('aria-selected', 'true')

	await page.goto('/cronologia?d=PTO')
	await expect(page.getByRole('heading', { level: 1, name: 'Porto' })).toBeVisible()
})

test('a renamed station URL is replaced by the current one', async ({ page }) => {
	await page.goto('/estacao/1200535-nome-antigo')
	await expect(page).toHaveURL('/estacao/1200535-lisboa-geofisico')
})
