import { afterEach, vi } from 'vitest'

// jsdom-only setup; the node environment (utils, functions) skips it.
if (typeof window !== 'undefined') {
	await import('@testing-library/jest-dom/vitest')
	const { cleanup } = await import('@testing-library/react')
	afterEach(() => cleanup())

	window.matchMedia ??= (query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	})
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	window.scrollTo = vi.fn()
}
