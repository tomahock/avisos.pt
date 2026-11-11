import { extent, outOfScaleText, thresholdDomain, thresholdLines, thresholdsSummary } from '../../utils/chartThresholds.js'

// 24 h trend for station cards, no axes (the card shows the value as text).
//   line — 2px line + end dot (temperature, wind, humidity)
//   bar  — hourly bars from a zero baseline (rain); empty when it didn't rain
// `thresholds` = IPMA criteria (utils/chartThresholds.js sets): thin lines in
// the level colours, same scale rule as StationChart, no labels (they don't
// fit) — the aria-label/title lists them.
const COLOR = 'var(--chart-line)' // themed in index.css (indigo-600 light, indigo-400 dark)
const BASE = 'var(--chart-grid)'
const WARN = { yellow: 'var(--chart-warn-yellow)', orange: 'var(--chart-warn-orange)', red: 'var(--chart-warn-red)' }

function describe(label, thresholds, fit) {
	if (!thresholds?.length) return label
	const out = outOfScaleText(fit.outOfScale, fit.lo, fit.hi)
	return [label, `Limiares: ${thresholdsSummary(thresholds)}`, out].filter(Boolean).join('. ')
}

function Lines({ lines, y, width }) {
	return lines.map((l) => (
		<line
			key={l.key}
			data-threshold={l.level}
			data-reference={l.reference || undefined}
			x1="1"
			x2={width - 1}
			y1={y(l.value)}
			y2={y(l.value)}
			style={{ stroke: WARN[l.level] }}
			strokeWidth="1"
			strokeDasharray={l.reference ? '1.5 2' : '3 2'}
		/>
	))
}

export default function Sparkline({ values, width = 96, height = 28, label, kind = 'line', thresholds = [] }) {
	const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null)

	if (kind === 'bar') {
		const dataMax = Math.max(1, ...pts.map(([, v]) => v))
		const fit = pts.length ? thresholdDomain(0, dataMax, thresholds) : { lo: 0, hi: dataMax, included: new Set(), outOfScale: [] }
		const max = fit.hi
		const lines = thresholdLines(thresholds, 0, max, { main: extent(values) })
		const slot = (width - 2) / Math.max(1, values.length)
		const w = Math.max(1, Math.min(4, slot - 1))
		const y = (v) => height - 2 - (v / max) * (height - 4)
		const text = describe(label, thresholds, fit)
		return (
			<svg width={width} height={height} role="img" aria-label={text} className="block shrink-0">
				<title>{text}</title>
				<line x1="1" x2={width - 1} y1={height - 1.5} y2={height - 1.5} style={{ stroke: BASE }} strokeWidth="1" />
				<Lines lines={lines} y={y} width={width} />
				{pts.map(([i, v]) =>
					v > 0 ? <rect key={i} x={1 + i * slot + (slot - w) / 2} y={y(v)} width={w} height={(v / max) * (height - 4)} rx="1" style={{ fill: COLOR }} /> : null
				)}
			</svg>
		)
	}

	if (pts.length < 2) return <span className="inline-block shrink-0" style={{ width, height }} aria-hidden />
	const dataLo = Math.min(...pts.map(([, v]) => v))
	const dataHi = Math.max(...pts.map(([, v]) => v))
	const fit = thresholdDomain(dataLo, dataHi, thresholds)
	const [lo, hi] = [fit.lo, fit.hi]
	const lines = thresholdLines(thresholds, lo, hi, { main: extent(values) })
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
	const text = describe(label, thresholds, fit)
	return (
		<svg width={width} height={height} role="img" aria-label={text} className="block shrink-0">
			<title>{text}</title>
			<Lines lines={lines} y={y} width={width} />
			<path d={d} fill="none" style={{ stroke: COLOR }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
			<circle cx={x(li)} cy={y(lv)} r="3" style={{ fill: COLOR }} data-ring strokeWidth="1.5" />
		</svg>
	)
}
