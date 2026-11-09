import { useCallback, useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'

// Warnings (blocking) + stations/observations (best effort), same contract
// as the index page: enrichment failures never break the page.
export function useWarningsData() {
	const [warnings, setWarnings] = useState(null)
	const [stations, setStations] = useState([])
	const [obs, setObs] = useState({})
	const [obsHour, setObsHour] = useState(null)
	const [error, setError] = useState(null)
	const [updatedAt, setUpdatedAt] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		const ctrl = new AbortController()
		fetchJson('/api/warnings', ctrl.signal)
			.then((data) => {
				setWarnings(data)
				setUpdatedAt(new Date())
			})
			.catch((err) => {
				if (err.name !== 'AbortError') setError(err.message)
			})
		fetchJson('/api/stations', ctrl.signal).then(setStations).catch(() => {})
		fetchJson('/api/observations', ctrl.signal)
			.then((data) => {
				setObs(data?.stations ?? {})
				setObsHour(data?.hour ?? null)
			})
			.catch(() => {})
		return () => ctrl.abort()
	}, [reloadKey])

	const retry = useCallback(() => {
		setError(null)
		setWarnings(null)
		setReloadKey((k) => k + 1)
	}, [])

	return { warnings, stations, obs, obsHour, error, updatedAt, retry }
}
