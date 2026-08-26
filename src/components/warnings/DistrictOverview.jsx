import { IPMA_AREAS, IPMA_AREA_CODES } from '../../data/ipmaAreas.js'
import { levelMeta, worstLevelId } from '../../data/levels.js'

// Chip grid at the top of the page: one per continental district, colored by
// the worst active warning level for that district. Gray if no warning.
// Chips are anchors — clicking scrolls to the district's group below.
export default function DistrictOverview({ warningsByArea }) {
	return (
		<section className="mt-6 px-4">
			<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
				{IPMA_AREA_CODES.map((code) => {
					const list = warningsByArea.get(code)
					const worst = list ? worstLevelId(list) : null
					const level = levelMeta(worst)
					const isActive = worst !== null
					const chipClass = isActive
						? `${level.chip} hover:opacity-90`
						: 'bg-gray-100 text-gray-500 hover:bg-gray-200'
					const Tag = isActive ? 'a' : 'div'
					const props = isActive
						? { href: `#${code}`, 'aria-label': `${IPMA_AREAS[code].name} — aviso ${level.label.toLowerCase()}` }
						: {}
					return (
						<Tag
							key={code}
							{...props}
							className={`text-center text-xs font-semibold uppercase tracking-wide rounded-md px-2 py-2 transition ${chipClass}`}
							title={IPMA_AREAS[code].name}
						>
							{IPMA_AREAS[code].name}
						</Tag>
					)
				})}
			</div>
		</section>
	)
}
