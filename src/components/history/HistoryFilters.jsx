import { ACORES_CODES, CONTINENTAL_CODES, IPMA_AREAS, MADEIRA_CODES } from '../../data/ipmaAreas.js'
import { WARNING_TYPE_NAMES, warningTypeMeta } from '../../data/warningTypes.js'
import { DEFAULT_PERIOD, HISTORY_KINDS, HISTORY_PERIODS } from '../../utils/history.js'
import { slugify } from '../../utils/share.js'

const AREA_GROUPS = [
	{ label: 'Continente', codes: CONTINENTAL_CODES },
	{ label: 'Açores', codes: ACORES_CODES },
	{ label: 'Madeira', codes: MADEIRA_CODES },
]

const selectClass =
	'min-w-0 max-w-full rounded-md border border-gray-200 bg-surface px-2 py-1.5 text-sm text-gray-900'

// Every filter lives in the URL (?periodo=&regiao=&tipo=&evento=), so a view
// of an episode can be shared. Setting a value to '' / [] removes it.
export default function HistoryFilters({ searchParams, onChange }) {
	const custom = searchParams.get('de') || searchParams.get('ate')
	const period = HISTORY_PERIODS.some((p) => p.id === searchParams.get('periodo'))
		? searchParams.get('periodo')
		: DEFAULT_PERIOD
	const kinds = (searchParams.get('evento') ?? '').split(',').filter((k) => k in HISTORY_KINDS)

	const toggleKind = (k) => {
		const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]
		onChange({ evento: next.join(',') })
	}

	return (
		<div className="mt-5 flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Período">
					{HISTORY_PERIODS.map((p) => {
						const active = !custom && p.id === period
						return (
							<button
								key={p.id}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => onChange({ periodo: p.id === DEFAULT_PERIOD ? '' : p.id, de: '', ate: '' })}
								className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-semibold transition ${
									active ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
								}`}
							>
								{p.label}
							</button>
						)
					})}
				</div>
				<label className="flex items-center gap-1.5 text-sm text-gray-600">
					<span className="sr-only">Região</span>
					<select
						className={selectClass}
						value={searchParams.get('regiao') ?? ''}
						onChange={(ev) => onChange({ regiao: ev.target.value })}
					>
						<option value="">Todas as regiões</option>
						{AREA_GROUPS.map((g) => (
							<optgroup key={g.label} label={g.label}>
								{g.codes.map((c) => (
									<option key={c} value={IPMA_AREAS[c].slug}>
										{IPMA_AREAS[c].name}
									</option>
								))}
							</optgroup>
						))}
					</select>
				</label>
				<label className="flex items-center gap-1.5 text-sm text-gray-600">
					<span className="sr-only">Tipo de aviso</span>
					<select
						className={selectClass}
						value={searchParams.get('tipo') ?? ''}
						onChange={(ev) => onChange({ tipo: ev.target.value })}
					>
						<option value="">Todos os tipos</option>
						{WARNING_TYPE_NAMES.map((n) => (
							<option key={n} value={slugify(n)}>
								{warningTypeMeta(n).label}
							</option>
						))}
					</select>
				</label>
			</div>
			<div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de alteração">
				{Object.entries(HISTORY_KINDS).map(([k, { label }]) => {
					const on = kinds.includes(k)
					return (
						<button
							key={k}
							type="button"
							aria-pressed={on}
							onClick={() => toggleKind(k)}
							className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition ${
								on
									? 'bg-gray-900 text-gray-50 border-gray-900'
									: 'bg-surface text-gray-600 border-gray-200 hover:border-gray-400'
							}`}
						>
							{label}
						</button>
					)
				})}
			</div>
		</div>
	)
}
