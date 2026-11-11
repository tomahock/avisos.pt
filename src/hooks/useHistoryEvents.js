import { useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'

// Events of /api/warnings/history for an API query string (see
// historyApiSearch). `events` is null while loading; `reloadKey` refetches.
export function useHistoryEvents(search, reloadKey = 0) {
	const [events, setEvents] = useState(null)
	const [error, setError] = useState(null)

	useEffect(() => {
		const ctrl = new AbortController()
		setEvents(null)
		setError(null)
		fetchJson(`/api/warnings/history?${search}`, ctrl.signal)
			.then((data) => setEvents(Array.isArray(data) ? data : []))
			.catch((err) => {
				if (err.name !== 'AbortError') setError(err.message)
			})
		return () => ctrl.abort()
	}, [search, reloadKey])

	return { events, error }
}
