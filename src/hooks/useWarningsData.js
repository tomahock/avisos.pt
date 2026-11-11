import { useCallback, useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'
import { useActiveWarnings } from './useActiveWarnings.js'

// Warnings (blocking) + stations/observations (best effort), same contract
// as the index page: enrichment failures never break the page.
export function useWarningsData() {
	const [rawWarnings, setWarnings] = useState(null)
	const warnings = useActiveWarnings(rawWarnings)
	const [stations, setStations] = useState([])
	// Station-dependent pages need to tell "still loading" from "failed";
	// the warnings pages just ignore these.
	const [stationsStatus, setStationsStatus] = useState('loading')
	const [obs, setObs] = useState({})
	const [obsHour, setObsHour] = useState(null)
	// Since-00:00 aggregates per station (#48), from /api/observations.
	const [today, setToday] = useState({})
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
		setStationsStatus('loading')
		fetchJson('/api/stations', ctrl.signal)
			.then((data) => {
				setStations(Array.isArray(data) ? data : [])
				setStationsStatus('ready')
			})
			.catch((err) => {
				if (err.name !== 'AbortError') setStationsStatus('error')
			})
		fetchJson('/api/observations', ctrl.signal)
			.then((data) => {
				setObs(data?.stations ?? {})
				setObsHour(data?.hour ?? null)
				setToday(data?.today ?? {})
			})
			.catch(() => {})
		return () => ctrl.abort()
	}, [reloadKey])

	const retry = useCallback(() => {
		setError(null)
		setWarnings(null)
		setReloadKey((k) => k + 1)
	}, [])

	return { warnings, stations, stationsStatus, obs, obsHour, today, error, updatedAt, retry }
}
