import { useEffect, useState } from 'react'

// Current time, ticking every minute ("agora" markers, começa/termina em).
export function useNow() {
	const [now, setNow] = useState(() => new Date())
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 60 * 1000)
		return () => clearInterval(id)
	}, [])
	return now
}
