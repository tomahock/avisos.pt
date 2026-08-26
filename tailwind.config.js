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
		},
		colors: {
			inherit: 'inherit',
			transparent: 'transparent',
			current: 'currentColor',
			black: '#000',
			white: '#fff',
			gray: colors.slate,
			primary: colors.indigo,
			secondary: colors.rose,
			tertiary: colors.teal,
		},
	},
	plugins: [],
}
