/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const scale = (name) => Object.fromEntries(STEPS.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]))

export default {
	darkMode: 'class',
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
			// gray/primary/secondary come from CSS variables (src/index.css) so the
			// dark theme (.dark on <html>) swaps them without dark: variants
			// everywhere. Light values are Tailwind's slate/indigo/rose.
			colors: {
				gray: scale('gray'),
				primary: scale('primary'),
				secondary: scale('secondary'),
				tertiary: colors.teal,
				surface: 'rgb(var(--surface) / <alpha-value>)',
			},
		},
	},
	plugins: [],
}
