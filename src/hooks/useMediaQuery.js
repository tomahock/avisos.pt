import { useEffect, useState } from 'react'

// matchMedia as state — for the few places where a size has to be a JS
// number (SVG width attributes) rather than a Tailwind breakpoint class.
export function useMediaQuery(query) {
	const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
	const [matches, setMatches] = useState(get)
	useEffect(() => {
		const mql = window.matchMedia(query)
		const on = () => setMatches(mql.matches)
		on()
		mql.addEventListener('change', on)
		return () => mql.removeEventListener('change', on)
	}, [query])
	return matches
}
