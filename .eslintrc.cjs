module.exports = {
	root: true,
	env: { browser: true, es2022: true },
	extends: [
		'eslint:recommended',
		'plugin:react/recommended',
		'plugin:react/jsx-runtime',
		'plugin:react-hooks/recommended',
	],
	settings: { react: { version: '18.3' } },
	parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
	plugins: ['react-refresh'],
	ignorePatterns: ['dist/', 'coverage/', 'playwright-report/', 'test-results/'],
	overrides: [
		{
			// Cloudflare Pages Functions run on workerd: HTMLRewriter, caches…
			files: ['functions/**'],
			env: { browser: true, worker: true },
			globals: { HTMLRewriter: 'readonly' },
		},
		{
			files: ['scripts/**', 'tests/**', 'e2e/**', '*.config.js', '.eslintrc.cjs'],
			env: { node: true },
		},
	],
	rules: {
		'react/prop-types': 'off',
		'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
	},
}
