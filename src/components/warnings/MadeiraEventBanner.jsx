import { Link } from 'react-router-dom'

import { useMadeiraSrpc } from '../../hooks/useMadeiraSrpc.js'
import { districtPath } from '../../utils/share.js'
import { activeEvent, eventAreaOccurrences, formatInstant } from '../../utils/madeira.js'

// Home page, under the Madeira chips: one line when SRPC, IP-RAM has an
// adverse-weather event open, linking to the area with most occurrences.
export default function MadeiraEventBanner({ className = '' }) {
	const { event: raw } = useMadeiraSrpc({ occurrences: false })
	const event = activeEvent(raw)
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
