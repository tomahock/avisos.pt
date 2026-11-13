import { useCallback, useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'
import { useActiveWarnings } from './useActiveWarnings.js'

export const REFRESH_MS = 5 * 60 * 1000

// AEMET (Spain) warnings in the IPMA shape, from /api/aemet/warnings,
// refetched every 5 min and filtered by useActiveWarnings. `warnings` is
// null while loading; a failed refresh keeps the last good list and sets
// `error`; retry() clears the error and refetches now.
export function useAemetWarnings() {
	const [raw, setRaw] = useState(null)
	const warnings = useActiveWarnings(raw)
	const [error, setError] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		let ctrl
		const load = () => {
			ctrl?.abort()
			ctrl = new AbortController()
			fetchJson('/api/aemet/warnings', ctrl.signal)
				.then((data) => {
					setRaw(Array.isArray(data) ? data : [])
					setError(null)
				})
				.catch((err) => {
					if (err.name !== 'AbortError') setError(err.message)
				})
		}
		load()
		const id = setInterval(load, REFRESH_MS)
		return () => {
			clearInterval(id)
			ctrl?.abort()
		}
	}, [reloadKey])

	const retry = useCallback(() => {
		setError(null)
		setReloadKey((k) => k + 1)
	}, [])

	return { warnings, error, retry }
}
