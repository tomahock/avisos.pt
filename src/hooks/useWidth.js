import { useEffect, useRef, useState } from 'react'

// Rendered width of an element, kept in sync with ResizeObserver — SVG charts
// draw in real pixels so text never stretches.
export function useWidth(initial = 320) {
	const ref = useRef(null)
	const [width, setWidth] = useState(initial)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))))
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	return [ref, width]
}
