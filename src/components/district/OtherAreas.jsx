import { Link } from 'react-router-dom'

import {
	ACORES_CODES,
	CONTINENTAL_CODES,
	IPMA_AREAS,
	MADEIRA_CODES,
	areaChip,
} from '../../data/ipmaAreas.js'
import { levelMeta, worstLevelId } from '../../data/levels.js'
import { areaWarnings, districtPath } from '../../utils/share.js'

// Internal links to every district page, coloured by current worst level.
export default function OtherAreas({ current, warnings }) {
	const groups = [
		['Portugal Continental', CONTINENTAL_CODES],
		['Açores', ACORES_CODES],
		['Madeira', MADEIRA_CODES],
	]
	return (
		<section className="mt-12">
			<h2 className="text-lg font-bold text-gray-900">Outros distritos e regiões</h2>
			<div className="mt-3 space-y-3">
				{groups.map(([title, codes]) => (
					<div key={title}>
						<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{title}</h3>
						<div className="flex flex-wrap gap-1.5">
							{codes.map((code) => {
								const worst = worstLevelId(areaWarnings(warnings, code))
								const cls = worst
									? `${levelMeta(worst).chip} hover:opacity-90`
									: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
								return (
									<Link
										key={code}
										to={districtPath(code)}
										aria-current={code === current ? 'page' : undefined}
										className={`px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide no-underline transition ${cls} ${
											code === current ? 'ring-2 ring-offset-2 ring-gray-900' : ''
										}`}
										title={IPMA_AREAS[code].name}
									>
										{areaChip(code)}
									</Link>
								)
							})}
						</div>
					</div>
				))}
			</div>
		</section>
	)
}
