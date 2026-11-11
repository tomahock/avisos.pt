import { Link } from 'react-router-dom'

import TypeIcon from '../warnings/TypeIcon.jsx'
import { IPMA_AREAS } from '../../data/ipmaAreas.js'
import { LEVELS } from '../../data/levels.js'
import { warningTypeMeta } from '../../data/warningTypes.js'
import { formatWhen, parseWarningTime } from '../../utils/format.js'
import { districtPath } from '../../utils/share.js'
import { HISTORY_KINDS } from '../../utils/history.js'

// Literal class strings (Tailwind JIT).
const KIND_STYLE = {
	agravado: { icon: 'fa-arrow-trend-up', badge: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
	desagravado: { icon: 'fa-arrow-trend-down', badge: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' },
	emitido: { icon: 'fa-plus', badge: 'bg-gray-100 text-gray-700' },
	prolongado: { icon: 'fa-clock', badge: 'bg-gray-100 text-gray-700' },
	encurtado: { icon: 'fa-clock-rotate-left', badge: 'bg-gray-100 text-gray-700' },
	retirado: { icon: 'fa-xmark', badge: 'bg-gray-100 text-gray-700' },
	terminado: { icon: 'fa-flag-checkered', badge: 'bg-gray-100 text-gray-700' },
}

function LevelChip({ level, struck = false }) {
	const l = LEVELS[level]
	if (!l) return null
	return (
		<span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${l.chip} ${struck ? 'line-through opacity-60' : ''}`}>
			{l.label}
		</span>
	)
}

function time(iso) {
	const ts = parseWarningTime(iso)
	return Number.isFinite(ts) ? new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'
}

function Detail({ event: e }) {
	switch (e.kind) {
		case 'agravado':
		case 'desagravado':
			return (
				<>
					<LevelChip level={e.fromLevel} />
					<i className="fas fa-arrow-right text-xs text-gray-400" aria-label="para" />
					<LevelChip level={e.toLevel} />
					<span className="text-gray-500">até {formatWhen(e.endTime)}</span>
				</>
			)
		case 'emitido':
			return (
				<>
					<LevelChip level={e.toLevel} />
					<span className="text-gray-500">
						{formatWhen(e.startTime)} – {formatWhen(e.endTime)}
					</span>
				</>
			)
		case 'prolongado':
		case 'encurtado':
			return (
				<>
					<LevelChip level={e.toLevel} />
					<span className="text-gray-500">
						fim {formatWhen(e.previousEndTime)} <i className="fas fa-arrow-right text-[10px]" aria-label="para" />{' '}
						{formatWhen(e.endTime)}
					</span>
				</>
			)
		case 'retirado':
			return (
				<>
					<LevelChip level={e.fromLevel} struck />
					<span className="text-gray-500">antes do fim previsto ({formatWhen(e.endTime)})</span>
				</>
			)
		case 'terminado':
			return <LevelChip level={e.fromLevel} />
		default:
			return null
	}
}

export default function HistoryEvent({ event: e, showArea = true }) {
	const style = KIND_STYLE[e.kind] ?? KIND_STYLE.emitido
	const area = IPMA_AREAS[e.area]
	return (
		<li className="flex gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
			<time className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-gray-900" dateTime={e.occurredAt}>
				{time(e.occurredAt)}
			</time>
			<div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
				<span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${style.badge}`}>
					<i className={`fas ${style.icon} text-[10px]`} aria-hidden />
					{HISTORY_KINDS[e.kind]?.label ?? e.kind}
				</span>
				{!showArea ? null : area ? (
					<Link to={districtPath(e.area)} className="font-semibold text-gray-900 no-underline hover:underline">
						{area.name}
					</Link>
				) : (
					<span className="font-semibold text-gray-900">{e.area}</span>
				)}
				<span className="inline-flex items-center gap-1 text-gray-700">
					<TypeIcon type={e.type} className="text-gray-500" />
					{warningTypeMeta(e.type).label}
				</span>
				<Detail event={e} />
			</div>
		</li>
	)
}
