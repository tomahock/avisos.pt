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
	rules: {
		'react/prop-types': 'off',
		'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
	},
}
