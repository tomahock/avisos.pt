import { expect, test } from '@playwright/test'

// Simulated in the browser (page.route) — the local edge cache would keep
// serving the mock's data otherwise.
const fail = (page, glob) => page.route(glob, (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"upstream_error"}' }))
const empty = (page, glob) => page.route(glob, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

for (const path of ['/', '/cronologia', '/mapa', '/distrito/lisboa']) {
	test(`${path}: API down → error, and retry recovers`, async ({ page }) => {
		let down = true
		await page.route('**/api/warnings', (r) => (down ? r.fulfill({ status: 502, body: '{}' }) : r.continue()))
		await page.goto(path)
		await expect(page.getByRole('heading', { name: 'Não foi possível carregar os avisos' })).toBeVisible()
		down = false
		await page.getByRole('button', { name: /Tentar de novo/ }).click()
		await expect(page.getByRole('heading', { name: 'Não foi possível carregar os avisos' })).toBeHidden()
	})
}

for (const path of ['/', '/cronologia']) {
	test(`${path}: no warnings → empty state`, async ({ page }) => {
		await empty(page, '**/api/warnings')
		await page.goto(path)
		await expect(page.getByRole('heading', { name: 'Sem avisos meteorológicos' })).toBeVisible()
	})
}

test('/historico: API down and no events', async ({ page }) => {
	await fail(page, '**/api/warnings/history**')
	await page.goto('/historico')
	await expect(page.getByRole('heading', { name: 'O histórico ainda não está disponível' })).toBeVisible()
	await page.unroute('**/api/warnings/history**')
	await empty(page, '**/api/warnings/history**')
	await page.getByRole('button', { name: /Tentar de novo/ }).click()
	await expect(page.getByText('Ainda não há alterações registadas neste período')).toBeVisible()
})

test('/estacoes: catalog down', async ({ page }) => {
	await fail(page, '**/api/stations')
	await page.goto('/estacoes')
	await expect(page.getByRole('heading', { name: 'Não foi possível carregar as estações' })).toBeVisible()
})
