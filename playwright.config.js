import { defineConfig, devices } from '@playwright/test'

// E2E against the production build served by Cloudflare's own runtime
// (wrangler pages dev: Pages Functions, middleware, OG images) and a fake
// FogosPT (tests/mock-fogos). Run `npm run build` first.
const PORT = 8788
const MOCK_PORT = 8799

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
	timeout: 30_000,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		locale: 'pt-PT',
		timezoneId: 'Europe/Lisbon',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@responsive/ },
		{ name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' }, grep: /@responsive/ },
	],
	webServer: [
		{
			command: 'node tests/mock-fogos/server.mjs',
			url: `http://127.0.0.1:${MOCK_PORT}/v2/warnings/ipma`,
			// Never reuse: fixture times are relative to the mock's start.
			reuseExistingServer: false,
		},
		{
			// Fresh local state each run: the functions' Cache API would otherwise
			// serve the previous run's fixtures (different times → different ids).
			command: `rm -rf .wrangler/e2e && npx wrangler pages dev dist --port ${PORT} --ip 127.0.0.1 --persist-to .wrangler/e2e --binding FOGOS_API_KEY=test --binding FOGOS_API_BASE=http://127.0.0.1:${MOCK_PORT}`,
			url: `http://127.0.0.1:${PORT}/`,
			reuseExistingServer: false,
			timeout: 120_000,
			env: { WRANGLER_SEND_METRICS: 'false' },
		},
	],
})
