import { useLayoutEffect, useRef, useState } from 'react'

import { useWidth } from '../../hooks/useWidth.js'
import { rainTotal } from '../../utils/stationMetrics.js'

// Small-multiple chart for one measure of one station (one series → no
// legend, the title names it). One hue for every chart; axis/labels in text
// tokens. Kinds:
//   line  — hourly temperature/wind/humidity, broken at missing readings
//   bar   — precipitation, from a zero baseline
//   range — daily min→max floating bars
// `hoverIdx`/`onHover` are lifted so sibling charts share one crosshair.

const COLOR = 'var(--chart-line)' // themed in index.css (indigo-600 light, indigo-400 dark)
const GRID = 'var(--chart-grid)'
const INK = 'var(--chart-ink)'
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
	// Unit for the coverage note of an incomplete total ('h' hourly, 'dias').
	gapUnit = 'h',
	hoverIdx = null,
	onHover = () => {},
}) {
	const [ref, width] = useWidth()
	// Tooltip is positioned from its real width so it never leaves the chart
	// (a fixed 60 px clamp cut long values/timestamps at the edges).
	const tipRef = useRef(null)
	const [tipW, setTipW] = useState(0)
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
		if (mode === 'total') {
			// Missing readings are unknown, not zero: a total with gaps is a
			// lower bound (same rule as the hourly summary and district cards).
			const { total, missing } = rainTotal(points.map((p) => p.v))
			statsText = missing > 0 ? `total ≥ ${format(total)} (${missing} ${gapUnit} sem dados)` : `total ${format(total)}`
		}
		else if (mode === 'max') statsText = `máx. ${format(max)}`
		else statsText = `máx. ${format(max)} · mín. ${format(min)}`
	}
	const latestText = showLatest && kind !== 'range' && last ? `agora ${format(last.v)}` : null
	const captionRight = [latestText, statsText].filter(Boolean).join(' · ')

	// Re-measure whenever the hovered point (and so the text) changes.
	useLayoutEffect(() => {
		setTipW(tipRef.current ? tipRef.current.offsetWidth : 0)
	}, [hoverIdx, hoveredText, width])

	return (
		<figure className="m-0 min-w-0">
			<figcaption className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
				<span className="font-semibold text-gray-900">{title}</span>
				{captionRight && (
					<span className={`text-gray-500 tabular-nums text-right transition-opacity ${hoverIdx == null ? '' : 'opacity-0'}`}>{captionRight}</span>
				)}
			</figcaption>
			<div ref={ref} className="relative mt-1 w-full min-w-0 select-none">
				{/* Clip only the SVG: it must never widen the measured container. The
				    tooltip lives outside this wrapper so it isn't clipped. */}
				<div className="w-full overflow-hidden">
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
							<line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} style={{ stroke: GRID }} strokeWidth="1" />
							<text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" style={{ fill: INK }} className="tabular-nums">
								{t.toLocaleString('pt-PT')}
							</text>
						</g>
					))}
					{xTicks.map(({ i, label }) => (
						<text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" style={{ fill: INK }}>
							{label}
						</text>
					))}

					{kind === 'line' && <path d={path} fill="none" style={{ stroke: COLOR }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
					{kind === 'bar' &&
						points.map((p, i) =>
							p.v > 0 ? (
								<path key={i} d={barPath(x(i) - barW / 2, y(p.v), barW, y(0) - y(p.v), 4, false)} style={{ fill: COLOR }} opacity={hoverIdx === i ? 0.75 : 1} />
							) : null
						)}
					{kind === 'range' &&
						points.map((p, i) =>
							p.lo != null && p.hi != null ? (
								<path key={i} d={barPath(x(i) - barW / 2, y(p.hi), barW, Math.max(2, y(p.lo) - y(p.hi)), 4, true)} style={{ fill: COLOR }} opacity={hoverIdx === i ? 0.75 : 1} />
							) : null
						)}

					{hovered && (
						<g pointerEvents="none">
							<line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={PAD.top + plotH} style={{ stroke: INK }} strokeWidth="1" />
							{kind === 'line' && hovered.v != null && (
								<circle cx={x(hoverIdx)} cy={y(hovered.v)} r="4.5" style={{ fill: COLOR }} data-ring strokeWidth="2" />
							)}
						</g>
					)}
					{kind === 'line' && last && hoverIdx == null && (
						<circle cx={x(points.lastIndexOf(last))} cy={y(last.v)} r="4" style={{ fill: COLOR }} data-ring strokeWidth="2" />
					)}
					{!hasData && (
						<text x={PAD.left + plotW / 2} y={PAD.top + plotH / 2} textAnchor="middle" fontSize="12" style={{ fill: INK }}>
							Sem dados
						</text>
					)}
				</svg>
				</div>
				{hovered && (
					<div
						ref={tipRef}
						className="pointer-events-none absolute top-0 rounded-md bg-surface/95 border border-gray-200 shadow-sm px-2 py-1 text-xs"
						style={{
							left: Math.min(Math.max(x(hoverIdx) - tipW / 2, 0), Math.max(0, width - tipW)),
							maxWidth: width,
							// Hidden until measured, so it never flashes at the wrong spot.
							visibility: tipW ? 'visible' : 'hidden',
						}}
					>
						<span className="font-semibold text-gray-900 tabular-nums">{hoveredText}</span>
						<span className="text-gray-500"> · {formatTime(hovered.t)}</span>
					</div>
				)}
			</div>
		</figure>
	)
}
