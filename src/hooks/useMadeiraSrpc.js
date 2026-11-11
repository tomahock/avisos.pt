import { useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'

const REFRESH_MS = 2 * 60 * 1000

// SRPC, IP-RAM data (via FogosPT): the current adverse-weather event and/or
// the occurrences of the last 24 h (`event` / `occurrences` flags). Refetched
// every 2 min. Each part fails on its own: `event`/`occurrences` keep the
// last good value, `failed.<part>` says the latest refresh failed and
// `loadedAt.<part>` when it last succeeded (null = never). Callers must gate
// what they show with srpcFresh() (utils/madeira.js) and a ticking clock.
export function useMadeiraSrpc({ enabled = true, event: withEvent = true, occurrences: withOccurrences = true } = {}) {
	const [event, setEvent] = useState(null)
	const [occurrences, setOccurrences] = useState(null)
	const [loadedAt, setLoadedAt] = useState({ event: null, occurrences: null })
	const [failed, setFailed] = useState({ event: false, occurrences: false })

	useEffect(() => {
		if (!enabled) return
		let ctrl
		const part = (name, url, set, pick) =>
			fetchJson(url, ctrl.signal)
				.then((data) => {
					set(pick(data))
					setLoadedAt((l) => ({ ...l, [name]: new Date() }))
					setFailed((f) => ({ ...f, [name]: false }))
				})
				.catch((err) => {
					if (err.name !== 'AbortError') setFailed((f) => ({ ...f, [name]: true }))
				})
		const load = () => {
			ctrl?.abort()
			ctrl = new AbortController()
			if (withEvent) part('event', '/api/madeira/event', setEvent, (d) => d?.event ?? null)
			if (withOccurrences) part('occurrences', '/api/madeira/occurrences', setOccurrences, (d) => (Array.isArray(d) ? d : []))
		}
		load()
		const id = setInterval(load, REFRESH_MS)
		return () => {
			clearInterval(id)
			ctrl?.abort()
		}
	}, [enabled, withEvent, withOccurrences])

	return { event, occurrences, loadedAt, failed }
}
