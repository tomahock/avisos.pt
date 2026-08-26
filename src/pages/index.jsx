import { useCallback, useEffect, useMemo, useState } from 'react'

import Layout from '../layouts/index.jsx'
import DistrictGroup from '../components/warnings/DistrictGroup.jsx'
import DistrictOverview from '../components/warnings/DistrictOverview.jsx'
import StateEmpty from '../components/warnings/StateEmpty.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import { IPMA_AREAS, IPMA_AREA_CODES, areaCentroid } from '../data/ipmaAreas.js'
import { nearestStationWithObs } from '../utils/geo.js'

async function fetchJson(url, signal) {
	const res = await fetch(url, { signal })
	if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
	return res.json()
}

function groupByArea(warnings) {
	const map = new Map()
	for (const w of warnings) {
		const list = map.get(w.idAreaAviso)
		if (list) list.push(w)
		else map.set(w.idAreaAviso, [w])
	}
	return map
}

export default function IndexPage() {
	const [warnings, setWarnings] = useState(null)
	const [stations, setStations] = useState([])
	const [obsByStation, setObsByStation] = useState({})
	const [error, setError] = useState(null)
	const [updatedAt, setUpdatedAt] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		const ctrl = new AbortController()

		// Warnings is the only blocking fetch. Stations + observations
		// enrich the UI but must not break the page if they fail.
		fetchJson('/api/warnings', ctrl.signal)
			.then((data) => {
				setWarnings(data)
				setUpdatedAt(new Date())
			})
			.catch((err) => {
				if (err.name !== 'AbortError') setError(err.message)
			})

		fetchJson('/api/stations', ctrl.signal)
			.then(setStations)
			.catch(() => {})

		fetchJson('/api/observations', ctrl.signal)
			.then((data) => setObsByStation(data?.stations ?? {}))
			.catch(() => {})

		return () => ctrl.abort()
	}, [reloadKey])

	const retry = useCallback(() => {
		setError(null)
		setWarnings(null)
		setReloadKey((k) => k + 1)
	}, [])

	const warningsByArea = useMemo(
		() => (warnings ? groupByArea(warnings) : new Map()),
		[warnings]
	)

	const orderedGroups = useMemo(() => {
		// Render in canonical N→S order (IPMA_AREA_CODES). Unknown codes
		// (islands, future additions) get appended in insertion order at the end.
		const seen = new Set()
		const groups = []
		for (const code of IPMA_AREA_CODES) {
			const list = warningsByArea.get(code)
			if (!list) continue
			seen.add(code)
			groups.push({ code, name: IPMA_AREAS[code].name, warnings: list })
		}
		for (const [code, list] of warningsByArea) {
			if (seen.has(code)) continue
			groups.push({ code, name: code, warnings: list })
		}
		return groups
	}, [warningsByArea])

	if (error) {
		return (
			<Layout>
				<StateError message={error} onRetry={retry} />
			</Layout>
		)
	}

	if (warnings === null) {
		return (
			<Layout>
				<StateLoading />
			</Layout>
		)
	}

	if (warnings.length === 0) {
		return (
			<Layout updatedAt={updatedAt}>
				<StateEmpty />
			</Layout>
		)
	}

	return (
		<Layout updatedAt={updatedAt}>
			<DistrictOverview warningsByArea={warningsByArea} />
			{orderedGroups.map((group) => {
				const station = nearestStationWithObs(
					areaCentroid(group.code),
					stations,
					obsByStation
				)
				return (
					<DistrictGroup
						key={group.code}
						id={group.code}
						name={group.name}
						warnings={group.warnings}
						station={station}
					/>
				)
			})}
		</Layout>
	)
}
