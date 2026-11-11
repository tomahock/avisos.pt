import { expect, test } from '@playwright/test'

import { noHorizontalScroll, watchErrors } from './helpers.js'

// History section on district pages. Fixtures: LSB agravado (2 h ago) and
// emitido (8 h), MCN retirado (27 h) — all inside the default 7 days.
const section = (page) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Histórico de avisos' }) })

test('Lisboa shows its warning history and links to the full history @responsive', async ({ page }) => {
	const watch = watchErrors(page)
	await page.goto('/distrito/lisboa')
	const s = section(page)
	await expect(s.getByRole('listitem')).toHaveCount(2)
	await expect(s.getByRole('listitem').first()).toContainText('Agravado')
	await expect(s.getByRole('tab', { name: '7 dias' })).toHaveAttribute('aria-selected', 'true')
	await noHorizontalScroll(page)
	watch.assertClean()

	await s.getByRole('link', { name: 'Ver histórico completo' }).click()
	await expect(page).toHaveURL(/\/historico\?regiao=lisboa$/)
	await expect(page.getByRole('heading', { level: 1, name: 'Histórico de avisos' })).toBeVisible()
})

test('Madeira – Costa Norte has its own history; the period tabs refetch', async ({ page }) => {
	await page.goto('/distrito/madeira-costa-norte')
	const s = section(page)
	await expect(s.getByRole('listitem')).toHaveCount(1)
	await expect(s).toContainText('Retirado')
	await s.getByRole('tab', { name: '24 horas' }).click()
	await expect(s).toContainText('Sem alterações aos avisos de Madeira – Costa Norte nas últimas 24 horas.')
})

test('history endpoint down → message in the section, page fine', async ({ page }) => {
	await page.route('**/api/warnings/history**', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{}' }))
	await page.goto('/distrito/lisboa')
	await expect(section(page)).toContainText('Não foi possível carregar o histórico.')
	await expect(page.getByRole('heading', { level: 1, name: 'Avisos meteorológicos para Lisboa' })).toBeVisible()
})
