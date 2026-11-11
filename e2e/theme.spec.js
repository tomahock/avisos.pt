import { expect, test } from '@playwright/test'

test('dark mode follows the system, and the toggle choice persists without a flash', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' })
	await page.goto('/criterios')
	await expect(page.locator('html')).toHaveClass(/dark/)

	await page.emulateMedia({ colorScheme: 'light' })
	await page.goto('/criterios')
	await expect(page.locator('html')).not.toHaveClass(/dark/)
	const toggle = page.getByRole('button', { name: /Mudar tema/ })
	await toggle.click() // system → light
	await toggle.click() // light → dark
	await expect(page.locator('html')).toHaveClass(/dark/)

	// Applied by the inline script before React — present at DOMContentLoaded.
	await page.reload({ waitUntil: 'domcontentloaded' })
	expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
})
