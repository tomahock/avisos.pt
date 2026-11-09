import { useWidth } from '../../hooks/useWidth.js'

// Small-multiple chart for one measure of one station (one series → no
// legend, the title names it). One hue for every chart; axis/labels in text
// tokens. Kinds:
//   line  — hourly temperature/wind/humidity, broken at missing readings
//   bar   — precipitation, from a zero baseline
//   range — daily min→max floating bars
// `hoverIdx`/`onHover` are lifted so sibling charts share one crosshair.

const COLOR = '#4f46e5' // primary-600
const GRID = '#e2e8f0' // gray-200
const INK = '#64748b' // gray-500
const PAD = { top: 10, right: 12, bottom: 22, left: 40 }
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]

function niceTicks(lo, hi, max = 4) {
	if (!(hi > lo)) {
		const pad = Math.abs(lo) > 1 ? Math.abs(lo) * 0.1 : 1
		lo -= pad
		hi += pad
	}
	const step = STEPS.find((s) => (hi - lo) / s <= max) ?? STEPS.at(-1)
	const start = Math.floor(lo / step) * step
	const end = Math.ceil(hi / step) * step
	const ticks = []
	for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
	return ticks
}

function barPath(x, y, w, h, r, floating) {
	if (h <= 0) return ''
	r = Math.min(r, w / 2, h / (floating ? 2 : 1))
	const b = y + h
	// Rounded top always; rounded bottom only for floating (range) bars —
	// bars that grow from the baseline stay square there.
	const bottom = floating
		? `L${x + w},${b - r} Q${x + w},${b} ${x + w - r},${b} L${x + r},${b} Q${x},${b} ${x},${b - r}`
		: `L${x + w},${b} L${x},${b}`
	return `M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} ${bottom} Z`
}

export default function StationChart({
	title,
	points,
	kind = 'line',
	format,
	formatTime,
	xLabel,
	height = 140,
	showLatest = true,
	// 'minmax' | 'max' | 'total' | null — extremes of the plotted period,
	// shown next to the title. Default: minmax for line/range, total for bar.
	stats,
	hoverIdx = null,
	onHover = () => {},
}) {
	const [ref, width] = useWidth()
	const n = points.length
	const plotW = width - PAD.left - PAD.right
	const plotH = height - PAD.top - PAD.bottom

	const values = []
	for (const p of points) {
		if (kind === 'range') {
			if (p.lo != null) values.push(p.lo)
			if (p.hi != null) values.push(p.hi)
		} else if (p.v != null) {
			values.push(p.v)
		}
	}
	const hasData = values.length > 0
	let lo = hasData ? Math.min(...values) : 0
	let hi = hasData ? Math.max(...values) : 1
	if (kind === 'bar') {
		lo = 0
		hi = Math.max(hi, 1)
	}
	const ticks = niceTicks(lo, hi)
	const yMin = ticks[0]
	const yMax = ticks.at(-1)
	const y = (v) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH

	const slot = n > 0 ? plotW / n : plotW
	const x = (i) => PAD.left + slot * (i + 0.5)
	const barW = Math.max(1, Math.min(24, slot - 2))

	// Line, broken at gaps.
	let path = ''
	if (kind === 'line') {
		let pen = false
		points.forEach((p, i) => {
			if (p.v == null) {
				pen = false
				return
			}
			path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`
			pen = true
		})
	}

	function pick(e) {
		if (!n) return
		const rect = e.currentTarget.getBoundingClientRect()
		const i = Math.floor((e.clientX - rect.left - PAD.left) / slot)
		onHover(i >= 0 && i < n ? i : null)
	}

	const hovered = hoverIdx != null && hoverIdx < n ? points[hoverIdx] : null
	const hoveredText = hovered
		? kind === 'range'
			? hovered.lo != null || hovered.hi != null
				? `${format(hovered.lo)} – ${format(hovered.hi)}`
				: 'Sem dados'
			: hovered.v != null
				? format(hovered.v)
				: 'Sem leitura'
		: null

	// X labels: provided by caller (e.g. every 6 h / day starts).
	const xTicks = points.map((p, i) => ({ i, label: xLabel?.(p, i) })).filter((t) => t.label)

	const last = [...points].reverse().find((p) => p.v != null)

	const mode = stats === undefined ? (kind === 'bar' ? 'total' : 'minmax') : stats
	let statsText = null
	if (mode && hasData) {
		const vs = kind === 'range' ? null : points.map((p) => p.v).filter((v) => v != null)
		const max = kind === 'range' ? Math.max(...points.map((p) => p.hi).filter((v) => v != null)) : Math.max(...vs)
		const min = kind === 'range' ? Math.min(...points.map((p) => p.lo).filter((v) => v != null)) : Math.min(...vs)
		if (mode === 'total') statsText = `total ${format(vs.reduce((a, v) => a + v, 0))}`
		else if (mode === 'max') statsText = `máx. ${format(max)}`
		else statsText = `máx. ${format(max)} · mín. ${format(min)}`
	}
	const latestText = showLatest && kind !== 'range' && last ? `agora ${format(last.v)}` : null
	const captionRight = [latestText, statsText].filter(Boolean).join(' · ')

	return (
		<figure className="m-0">
			<figcaption className="flex items-baseline justify-between gap-2 text-sm">
				<span className="font-semibold text-gray-900">{title}</span>
				{captionRight && (
					<span className={`text-gray-500 tabular-nums text-right transition-opacity ${hoverIdx == null ? '' : 'opacity-0'}`}>{captionRight}</span>
				)}
			</figcaption>
			<div ref={ref} className="relative mt-1 select-none">
				<svg
					width={width}
					height={height}
					role="img"
					aria-label={title}
					onPointerMove={pick}
					onPointerDown={pick}
					onPointerLeave={() => onHover(null)}
					className="block touch-pan-y"
				>
					{ticks.map((t) => (
						<g key={t}>
							<line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
							<text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={INK} className="tabular-nums">
								{t.toLocaleString('pt-PT')}
							</text>
						</g>
					))}
					{xTicks.map(({ i, label }) => (
						<text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill={INK}>
							{label}
						</text>
					))}

					{kind === 'line' && <path d={path} fill="none" stroke={COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
					{kind === 'bar' &&
						points.map((p, i) =>
							p.v > 0 ? (
								<path key={i} d={barPath(x(i) - barW / 2, y(p.v), barW, y(0) - y(p.v), 4, false)} fill={COLOR} opacity={hoverIdx === i ? 0.75 : 1} />
							) : null
						)}
					{kind === 'range' &&
						points.map((p, i) =>
							p.lo != null && p.hi != null ? (
								<path key={i} d={barPath(x(i) - barW / 2, y(p.hi), barW, Math.max(2, y(p.lo) - y(p.hi)), 4, true)} fill={COLOR} opacity={hoverIdx === i ? 0.75 : 1} />
							) : null
						)}

					{hovered && (
						<g pointerEvents="none">
							<line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={PAD.top + plotH} stroke={INK} strokeWidth="1" />
							{kind === 'line' && hovered.v != null && (
								<circle cx={x(hoverIdx)} cy={y(hovered.v)} r="4.5" fill={COLOR} stroke="#fff" strokeWidth="2" />
							)}
						</g>
					)}
					{kind === 'line' && last && hoverIdx == null && (
						<circle cx={x(points.lastIndexOf(last))} cy={y(last.v)} r="4" fill={COLOR} stroke="#fff" strokeWidth="2" />
					)}
					{!hasData && (
						<text x={PAD.left + plotW / 2} y={PAD.top + plotH / 2} textAnchor="middle" fontSize="12" fill={INK}>
							Sem dados
						</text>
					)}
				</svg>
				{hovered && (
					<div
						className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-white/95 border border-gray-200 shadow-sm px-2 py-1 text-xs whitespace-nowrap"
						style={{ left: Math.min(Math.max(x(hoverIdx), 60), width - 60) }}
					>
						<span className="font-semibold text-gray-900 tabular-nums">{hoveredText}</span>
						<span className="text-gray-500"> · {formatTime(hovered.t)}</span>
					</div>
				)}
			</div>
		</figure>
	)
}
