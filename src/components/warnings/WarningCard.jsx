import { Link } from 'react-router-dom'

import { levelMeta } from '../../data/levels.js'
import { warningTypeMeta } from '../../data/warningTypes.js'
import TypeIcon from './TypeIcon.jsx'
import { formatWhen } from '../../utils/format.js'
import { warningPath } from '../../utils/share.js'

export default function WarningCard({ warning }) {
	const level = levelMeta(warning.awarenessLevelID)
	const type = warningTypeMeta(warning.awarenessTypeName)

	return (
		<article className="flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
			<div className={`h-2 ${level.bar}`} aria-hidden />
			<div className="flex items-start gap-3 p-4">
				<div className={`shrink-0 w-11 h-11 rounded-md flex items-center justify-center ${level.chip}`}>
					<TypeIcon type={warning.awarenessTypeName} className="text-lg" />
				</div>
				<div className="min-w-0">
					<h3 className="text-lg font-semibold text-gray-900 leading-tight">
						<Link to={warningPath(warning)} className="text-inherit no-underline hover:underline">
							{type.label ?? warning.awarenessTypeName}
						</Link>
					</h3>
					<p className={`text-xs uppercase tracking-wide font-semibold mt-0.5 ${level.text}`}>
						Aviso {level.label}
					</p>
				</div>
			</div>
			<p className="px-4 text-sm text-gray-700 leading-relaxed">{warning.text}</p>
			<div className="flex items-center justify-between gap-2 px-4 py-3 mt-auto text-xs text-gray-500 border-t border-gray-100">
				<span className="tabular-nums">
					{formatWhen(warning.startTime)} → {formatWhen(warning.endTime)}
				</span>
				<Link
					to={warningPath(warning)}
					className="shrink-0 inline-flex items-center gap-1 font-semibold text-gray-600 no-underline hover:text-gray-900"
				>
					<i className="fas fa-share-nodes" aria-hidden />
					Partilhar
				</Link>
			</div>
		</article>
	)
}
