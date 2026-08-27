import { useEffect } from 'react'

const DEFAULT = 'Avisos.pt — Avisos meteorológicos em vigor em Portugal'

export function usePageTitle(title) {
	useEffect(() => {
		const previous = document.title
		document.title = title || DEFAULT
		return () => {
			document.title = previous
		}
	}, [title])
}
