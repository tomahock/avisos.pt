// FogosPT awarenessLevelID → visual + priority metadata.
// `green` never appears in FogosPT responses (filtered upstream) — kept here
// only as the "no active warning" baseline for the overview grid and map.
// `priority` is used to pick the worst level per district.
// Tailwind class strings are LITERAL so the JIT scanner picks them up.
// `fill` is the raw hex (Tailwind's palette) for Leaflet, which needs colors
// as strings, not class names.

export const LEVELS = {
	red: {
		priority: 3,
		label: 'Vermelho',
		bar: 'bg-red-600',
		chip: 'bg-red-600 text-white',
		border: 'border-red-600',
		text: 'text-red-700',
		fill: '#dc2626',
	},
	orange: {
		priority: 2,
		label: 'Laranja',
		bar: 'bg-orange-500',
		chip: 'bg-orange-500 text-white',
		border: 'border-orange-500',
		text: 'text-orange-700',
		fill: '#f97316',
	},
	yellow: {
		priority: 1,
		label: 'Amarelo',
		bar: 'bg-yellow-400',
		chip: 'bg-yellow-400 text-gray-900',
		border: 'border-yellow-400',
		text: 'text-yellow-700',
		fill: '#facc15',
	},
	green: {
		priority: 0,
		label: 'Sem aviso',
		bar: 'bg-gray-200',
		chip: 'bg-gray-200 text-gray-600',
		border: 'border-gray-200',
		text: 'text-gray-500',
		fill: '#e5e7eb',
	},
}

export function levelMeta(id) {
	return LEVELS[id] ?? LEVELS.green
}

// Pick the highest-priority level among a set of warnings for a district.
export function worstLevelId(warnings) {
	let worst = null
	let worstPri = -1
	for (const w of warnings) {
		const p = LEVELS[w.awarenessLevelID]?.priority ?? 0
		if (p > worstPri) {
			worstPri = p
			worst = w.awarenessLevelID
		}
	}
	return worst
}
