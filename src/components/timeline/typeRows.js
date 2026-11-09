import { typeRank, warningTypeMeta } from '../../data/warningTypes.js'

// <TimelineGrid> rows for a single area: one row per warning type, in IPMA
// legend order.
export function typeRows(warnings) {
	const byType = new Map()
	for (const w of warnings) {
		const list = byType.get(w.awarenessTypeName)
		if (list) list.push(w)
		else byType.set(w.awarenessTypeName, [w])
	}
	return [...byType.keys()]
		.sort((a, b) => typeRank(a) - typeRank(b))
		.map((name) => {
			const meta = warningTypeMeta(name)
			return { key: name, label: meta.label ?? name, iconType: name, warnings: byType.get(name) }
		})
}
