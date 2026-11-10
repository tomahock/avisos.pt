import { useEffect, useState } from 'react'

// Theme: 'system' (follow the OS), 'light' or 'dark'. The class on <html> is
// set before first paint by the inline script in index.html; this keeps it in
// sync afterwards. Choice lives in localStorage (a per-visitor convenience —
// private mode just falls back to 'system').
const KEY = 'theme'
const OPTIONS = {
	system: { next: 'light', icon: 'fa-circle-half-stroke', label: 'Tema automático (segue o sistema)' },
	light: { next: 'dark', icon: 'fa-sun', label: 'Tema claro' },
	dark: { next: 'system', icon: 'fa-moon', label: 'Tema escuro' },
}

function read() {
	try {
		const v = localStorage.getItem(KEY)
		return v === 'light' || v === 'dark' ? v : 'system'
	} catch {
		return 'system'
	}
}

function apply(theme) {
	const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
	document.documentElement.classList.toggle('dark', dark)
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState(read)

	useEffect(() => {
		apply(theme)
		try {
			if (theme === 'system') localStorage.removeItem(KEY)
			else localStorage.setItem(KEY, theme)
		} catch {
			// storage unavailable — the choice just isn't remembered
		}
		if (theme !== 'system') return
		const mql = window.matchMedia('(prefers-color-scheme: dark)')
		const on = () => apply('system')
		mql.addEventListener('change', on)
		return () => mql.removeEventListener('change', on)
	}, [theme])

	const opt = OPTIONS[theme]
	return (
		<button
			type="button"
			onClick={() => setTheme(opt.next)}
			title={`${opt.label} — mudar`}
			aria-label={`${opt.label}. Mudar tema`}
			className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
		>
			<i className={`fas ${opt.icon}`} aria-hidden />
		</button>
	)
}
