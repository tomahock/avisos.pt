import { expect, test } from '@playwright/test'

import { noHorizontalScroll, watchErrors } from './helpers.js'

// «Do outro lado da fronteira» (#56): AEMET warnings of the Spanish zones
// bordering a district. Fixture: Sanabria (BGC) orange Vento.
const section = (page) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: /Do outro lado da fronteira/ }) })

test('Bragança shows the Sanabria card in «Do outro lado da fronteira» @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/distrito/braganca')
	const s = section(page)
	await expect(s).toBeVisible()
	const g = s.getByRole('group', { name: /^Sanabria/ })
	await expect(g.getByRole('article')).toHaveCount(1)
	await expect(g).toContainText('Vento')
	await expect(g).toContainText('Aviso Laranja')
	await expect(g).toContainText('Limiar: Rachas máximas: 90 km/h')
	await expect(g).toContainText('Viento del noroeste.')
	await expect(g.getByText(/Rachas máximas/)).toHaveCount(1)
	await expect(g).toContainText('Fonte: AEMET')
	await expect(g).toContainText('Zamora')
	await expect(s).not.toContainText('Partilhar')
	await noHorizontalScroll(page)
	watch.assertClean()
})

test('Lisboa has no «Do outro lado da fronteira»', async ({ page }) => {
	await page.goto('/distrito/lisboa')
	await expect(page.getByRole('heading', { level: 1, name: 'Avisos meteorológicos para Lisboa' })).toBeVisible()
	await expect(page.getByRole('heading', { name: /Do outro lado da fronteira/ })).toHaveCount(0)
})

test('AEMET down → message in the section, page fine', async ({ page }) => {
	await page.route('**/api/aemet/warnings**', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{}' }))
	await page.goto('/distrito/braganca')
	await expect(section(page)).toContainText('Não foi possível carregar os avisos de Espanha.')
	await expect(section(page).getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
	await expect(page.getByRole('heading', { level: 1, name: 'Avisos meteorológicos para Bragança' })).toBeVisible()
})
