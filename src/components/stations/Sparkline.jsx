// 24 h temperature trend for station cards: a single 2px line plus an end
// dot, no axes (the card shows the current value as text next to it).
const COLOR = '#4f46e5'

export default function Sparkline({ values, width = 96, height = 28, label }) {
	const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null)
	if (pts.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden />
	const lo = Math.min(...pts.map(([, v]) => v))
	const hi = Math.max(...pts.map(([, v]) => v))
	const n = values.length - 1 || 1
	const x = (i) => 2 + (i / n) * (width - 6)
	const y = (v) => 3 + (hi === lo ? (height - 6) / 2 : (1 - (v - lo) / (hi - lo)) * (height - 6))
	let d = ''
	let prev = -2
	for (const [i, v] of pts) {
		d += `${i === prev + 1 ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
		prev = i
	}
	const [li, lv] = pts.at(-1)
	return (
		<svg width={width} height={height} role="img" aria-label={label} className="block shrink-0">
			<path d={d} fill="none" stroke={COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
			<circle cx={x(li)} cy={y(lv)} r="3" fill={COLOR} stroke="#fff" strokeWidth="1.5" />
		</svg>
	)
}
