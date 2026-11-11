// Every test runs in Lisbon time — the site's whole time model is Europe/Lisbon
// wall-clock (see CLAUDE.md). Must be set before anything touches Intl/Date.
process.env.TZ = 'Europe/Lisbon'

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'node',
		environmentMatchGlobs: [['**/*.test.jsx', 'jsdom']],
		include: ['src/**/*.test.{js,jsx}', 'functions/**/*.test.js', 'tests/**/*.test.{js,jsx}'],
		setupFiles: ['tests/setup.js'],
		restoreMocks: true,
		unstubGlobals: true,
		coverage: {
			provider: 'v8',
			include: ['src/**', 'functions/**'],
			exclude: ['**/*.test.*', 'src/data/stationAreas.js'],
			reporter: ['text-summary', 'html'],
		},
	},
})
