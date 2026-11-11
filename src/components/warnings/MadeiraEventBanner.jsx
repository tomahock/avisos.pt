import { Link } from 'react-router-dom'

import { useMadeiraSrpc } from '../../hooks/useMadeiraSrpc.js'
import { useNow } from '../../hooks/useNow.js'
import { districtPath } from '../../utils/share.js'
import { activeEvent, eventAreaOccurrences, formatInstant, srpcFresh } from '../../utils/madeira.js'

// Home page, under the Madeira chips: one line when SRPC, IP-RAM has an
// adverse-weather event open, linking to the area with most occurrences.
// A copy that stopped refreshing for 15 min is dropped (the event may have
// closed upstream meanwhile); the clock ticks so it expires on an open tab.
export default function MadeiraEventBanner({ className = '' }) {
	const { event: raw, loadedAt, failed } = useMadeiraSrpc({ occurrences: false })
	const now = useNow().getTime()
	const event = srpcFresh(loadedAt.event, failed.event, now) ? activeEvent(raw) : null
	if (!event) return null
	const target = ['MCS', 'MCN', 'MPS'].reduce((best, c) => ((eventAreaOccurrences(event, c) ?? 0) > (eventAreaOccurrences(event, best) ?? 0) ? c : best), 'MCS')
	const n = event.kpi.occurrences
	const since = formatInstant(event.start)
	return (
		<Link
			to={districtPath(target)}
			className={`flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 no-underline hover:border-amber-400 ${className}`}
		>
			<i className="fas fa-house-crack mt-0.5" aria-hidden />
			<span>
				<span className="font-semibold">Proteção Civil da Madeira — {event.title ?? 'evento ativo'}</span>
				{`: ${n} ${n === 1 ? 'ocorrência' : 'ocorrências'}${since ? ` desde ${since}` : ''}.`}{' '}
				<span className="font-semibold underline">Ver ocorrências →</span>
			</span>
		</Link>
	)
}
