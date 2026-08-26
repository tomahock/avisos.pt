/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'

export default {
	content: ['./index.html', './src/**/*.{js,jsx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Fira Sans', ...defaultTheme.fontFamily.sans],
			},
			screens: {
				xs: '420px',
			},
			// Extend (not replace) the default palette so red/orange/yellow/green
			// stay available — the warning UI depends on them.
			colors: {
				gray: colors.slate,
				primary: colors.indigo,
				secondary: colors.rose,
				tertiary: colors.teal,
			},
		},
	},
	plugins: [],
}
