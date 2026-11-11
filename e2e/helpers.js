import { expect } from '@playwright/test'

// Third-party assets (Font Awesome, Google Fonts, map tiles) may be slow or
// blocked in CI — only errors from our own code count.
const IGNORED = [/Failed to load resource/, /cdnjs|fonts\.g|tile\.openstreetmap|cartocdn/i]

/** Collects console errors and uncaught exceptions; call `assertClean()` at the end. */
export function watchErrors(page) {
	const errors = []
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
	page.on('console', (m) => {
		if (m.type() === 'error' && !IGNORED.some((re) => re.test(m.text()))) errors.push(`console: ${m.text()}`)
	})
	return {
		errors,
		assertClean: () => expect(errors, errors.join('\n')).toEqual([]),
	}
}

export async function noHorizontalScroll(page) {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1)
}

/** First active warning of an area, with its permalink. */
export async function warningPath(request, code = 'LSB') {
	const list = await (await request.get('/api/warnings')).json()
	const w = list.find((x) => x.idAreaAviso === code)
	const m = w.startTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
	const type = w.awarenessTypeName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
	return { warning: w, path: `/distrito/lisboa/aviso/${type}-${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` }
}
