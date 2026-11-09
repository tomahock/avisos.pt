// 24 h trend for station cards, no axes (the card shows the value as text).
//   line — 2px line + end dot (temperature, wind, humidity)
//   bar  — hourly bars from a zero baseline (rain); empty when it didn't rain
const COLOR = '#4f46e5'
const BASE = '#e2e8f0'

export default function Sparkline({ values, width = 96, height = 28, label, kind = 'line' }) {
	const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null)

	if (kind === 'bar') {
		const max = Math.max(1, ...pts.map(([, v]) => v))
		const slot = (width - 2) / Math.max(1, values.length)
		const w = Math.max(1, Math.min(4, slot - 1))
		return (
			<svg width={width} height={height} role="img" aria-label={label} className="block shrink-0">
				<line x1="1" x2={width - 1} y1={height - 1.5} y2={height - 1.5} stroke={BASE} strokeWidth="1" />
				{pts.map(([i, v]) =>
					v > 0 ? (
						<rect key={i} x={1 + i * slot + (slot - w) / 2} y={height - 2 - (v / max) * (height - 4)} width={w} height={(v / max) * (height - 4)} rx="1" fill={COLOR} />
					) : null
				)}
			</svg>
		)
	}

	if (pts.length < 2) return <span className="inline-block shrink-0" style={{ width, height }} aria-hidden />
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
