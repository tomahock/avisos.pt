import {
	ACORES_CODES,
	CONTINENTAL_CODES,
	IPMA_AREAS,
	MADEIRA_CODES,
	areaChip,
} from '../../data/ipmaAreas.js'
import { levelMeta, worstLevelId } from '../../data/levels.js'

function Chip({ code, warningsByArea }) {
	const list = warningsByArea.get(code)
	const worst = list ? worstLevelId(list) : null
	const level = levelMeta(worst)
	const isActive = worst !== null
	const cls = isActive
		? `${level.chip} hover:opacity-90`
		: 'bg-gray-100 text-gray-500 hover:bg-gray-200'
	const label = areaChip(code)
	if (isActive) {
		return (
			<a
				href={`#${code}`}
				className={`text-center text-xs font-semibold uppercase tracking-wide rounded-md px-2 py-2 transition ${cls}`}
				title={`${IPMA_AREAS[code].name} — aviso ${level.label.toLowerCase()}`}
			>
				{label}
			</a>
		)
	}
	return (
		<div
			className={`text-center text-xs font-semibold uppercase tracking-wide rounded-md px-2 py-2 transition ${cls}`}
			title={IPMA_AREAS[code].name}
		>
			{label}
		</div>
	)
}

function Section({ title, codes, warningsByArea, cols }) {
	return (
		<div>
			<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
				{title}
			</h3>
			<div className={`grid gap-2 ${cols}`}>
				{codes.map((code) => (
					<Chip key={code} code={code} warningsByArea={warningsByArea} />
				))}
			</div>
		</div>
	)
}

export default function DistrictOverview({ warningsByArea }) {
	return (
		<section className="mt-6 px-4 space-y-4">
			<Section
				title="Portugal Continental"
				codes={CONTINENTAL_CODES}
				warningsByArea={warningsByArea}
				cols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9"
			/>
			<Section
				title="Açores"
				codes={ACORES_CODES}
				warningsByArea={warningsByArea}
				cols="grid-cols-3"
			/>
			<Section
				title="Madeira"
				codes={MADEIRA_CODES}
				warningsByArea={warningsByArea}
				cols="grid-cols-2 sm:grid-cols-4"
			/>
		</section>
	)
}
