import { useCallback, useEffect, useState } from 'react'

// "Mostrar limiares" on the station charts and district sparklines: on by
// default, remembered in localStorage (like the theme) and shared by every
// component on the page through a window event. Private mode (storage
// throws) just keeps the in-memory value.
const KEY = 'limiares'
const EVENT = 'avisos:limiares'

function read() {
	try {
		return localStorage.getItem(KEY) !== '0'
	} catch {
		return true
	}
}

export function useShowThresholds() {
	const [show, setShow] = useState(read)

	useEffect(() => {
		const sync = (e) => setShow(e.detail ?? read())
		window.addEventListener(EVENT, sync)
		return () => window.removeEventListener(EVENT, sync)
	}, [])

	const set = useCallback((value) => {
		try {
			if (value) localStorage.removeItem(KEY)
			else localStorage.setItem(KEY, '0')
		} catch {
			// private mode: in-memory only
		}
		window.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
	}, [])

	return [show, set]
}
