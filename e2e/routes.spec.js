import { expect, test } from '@playwright/test'

import { noHorizontalScroll, warningPath, watchErrors } from './helpers.js'

const ROUTES = [
	['/', 'Avisos meteorológicos em vigor em Portugal'],
	['/cronologia', 'Cronologia dos avisos'],
	['/historico', 'Histórico de avisos'],
	['/mapa', 'Mapa dos avisos meteorológicos em Portugal'],
	['/estacoes', 'Estações meteorológicas IPMA'],
	['/criterios', 'Critérios de emissão de avisos'],
	['/distrito/lisboa', 'Avisos meteorológicos para Lisboa'],
	['/distrito/madeira-costa-sul', 'Avisos meteorológicos para Madeira – Costa Sul'],
	['/estacao/1200535-lisboa-geofisico', 'Lisboa (Geofísico)'],
]

for (const [path, title] of ROUTES) {
	test(`${path} renders cleanly @responsive`, async ({ page }) => {
		const watch = watchErrors(page)
		await page.goto(path)
		await expect(page.getByRole('heading', { level: 1, name: title })).toBeAttached()
		await page.waitForLoadState('networkidle')
		await noHorizontalScroll(page)
		watch.assertClean()
	})
}

test('warning permalink renders cleanly @responsive', async ({ page, request }) => {
	const watch = watchErrors(page)
	const { path } = await warningPath(request)
	await page.goto(path)
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Lisboa')
	await page.waitForLoadState('networkidle')
	await noHorizontalScroll(page)
	watch.assertClean()
})

test('unknown URL shows the 404 page', async ({ page }) => {
	await page.goto('/isto-nao-existe')
	await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
})
