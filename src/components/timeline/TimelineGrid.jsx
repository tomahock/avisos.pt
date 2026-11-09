import { useMemo, useState } from 'react'

import { levelMeta } from '../../data/levels.js'
import { warningTypeMeta } from '../../data/warningTypes.js'
import {
	dayLabel,
	formatHour,
	groupDays,
	warningsAt,
	worstAt,
} from '../../utils/timeline.js'

// Pixel width of one hour. Fixed so the label column and the scrolling track
// can be laid out independently and still line up row by row.
const CELL = 24
const HOUR = 3600 * 1000

// Collapse per-hour levels into contiguous runs of the same level, so each
// run renders as one rounded bar instead of N little squares.
function runsOf(levels) {
	const runs = []
	levels.forEach((level, i) => {
		const last = runs[runs.length - 1]
		if (last && last.level === level && last.start + last.len === i) last.len++
		else if (level) runs.push({ start: i, len: 1, level })
	})
	return runs
}

function uniqueTypes(warnings) {
	return [...new Set(warnings.map((w) => w.awarenessTypeName))]
}

function Segment({ run, hours, warnings, mode }) {
	const level = levelMeta(run.level)
	const width = run.len * CELL
	const from = hours[run.start]
	const to = new Date(hours[run.start + run.len - 1].getTime() + HOUR)
	const inRun = warnings.filter(
		(w) =>
			new Date(w.startTime) < to &&
			new Date(w.endTime) > from &&
			w.awarenessLevelID === run.level
	)
	const types = uniqueTypes(inRun)
	const title = `${level.label} · ${formatHour(from)}h → ${formatHour(to)}h\n${types.join(', ')}`

	let content = null
	if (mode === 'types') {
		const max = Math.floor((width - 8) / 16)
		if (max >= 1) {
			content = types.slice(0, max).map((t) => (
				<i key={t} className={`fas ${warningTypeMeta(t).icon} text-[11px]`} aria-hidden />
			))
		}
	} else if (width >= 64) {
		content = (
			<span className="truncate">
				{level.label}
				{width >= 120 && (
					<span className="font-normal opacity-80"> · até {formatHour(to)}h</span>
				)}
			</span>
		)
	}

	return (
		<div
			className={`absolute top-1.5 bottom-1.5 rounded-md shadow-sm flex items-center justify-center gap-1 px-1 text-[11px] font-semibold overflow-hidden ${level.chip}`}
			style={{ left: run.start * CELL + 1, width: width - 2 }}
			title={title}
		>
			{content}
		</div>
	)
}

function Inspector({ hour, isNow, rows }) {
	const active = []
	for (const row of rows) {
		if (row.type === 'section') continue
		const list = warningsAt(row.warnings, hour)
		if (list.length === 0) continue
		active.push({ row, level: worstAt(row.warnings, hour), types: uniqueTypes(list) })
	}
	const to = new Date(hour.getTime() + HOUR)
	const when = hour.toLocaleDateString('pt-PT', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
	})

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-gray-100 bg-gray-50 min-h-[3.25rem]">
			<span className="text-sm font-semibold text-gray-900 tabular-nums">
				{isNow && (
					<span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-gray-900 text-white text-[10px] uppercase tracking-wider align-middle">
						Agora
					</span>
				)}
				{when}, {formatHour(hour)}:00–{formatHour(to)}:00
			</span>
			{active.length === 0 ? (
				<span className="text-sm text-gray-500">Sem avisos nesta hora</span>
			) : (
				active.map(({ row, level, types }) => {
					const meta = levelMeta(level)
					return (
						<span
							key={row.key}
							className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-full pl-1 pr-2.5 py-0.5"
						>
							<span className={`w-2.5 h-2.5 rounded-full ${meta.bar}`} aria-hidden />
							{row.inspectorLabel ?? row.label}
							<span className="text-gray-400 flex gap-1">
								{types.map((t) => (
									<i key={t} className={`fas ${warningTypeMeta(t).icon}`} title={t} aria-hidden />
								))}
							</span>
						</span>
					)
				})
			)}
		</div>
	)
}

/**
 * Hour-by-hour warning timeline.
 *
 * rows: [{ type: 'section', key, label }
 *        | { key, label, icon?, warnings, onClick?, inspectorLabel? }]
 * mode: 'types' shows type icons inside bars (overview), 'level' shows the
 *       level name (single-district view, one row per type).
 */
export default function TimelineGrid({ hours, rows, now, mode = 'level' }) {
	const [hoverIdx, setHoverIdx] = useState(null)

	const days = useMemo(() => groupDays(hours), [hours])
	const levelsByRow = useMemo(
		() =>
			rows.map((row) =>
				row.type === 'section' ? null : hours.map((h) => worstAt(row.warnings, h))
			),
		[rows, hours]
	)

	const trackWidth = hours.length * CELL
	const nowLeft = ((now - hours[0]) / HOUR) * CELL
	const idx = hoverIdx ?? 0

	function pick(e) {
		const rect = e.currentTarget.getBoundingClientRect()
		const i = Math.floor((e.clientX - rect.left) / CELL)
		setHoverIdx(i >= 0 && i < hours.length ? i : null)
	}

	// Day boundaries (midnight) excluding the very first column.
	const dayStarts = []
	let acc = 0
	for (const d of days) {
		if (acc > 0) dayStarts.push(acc)
		acc += d.span
	}

	return (
		<div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
			<Inspector hour={hours[idx]} isNow={hoverIdx === null || hoverIdx === 0} rows={rows} />

			<div className="flex">
				{/* Fixed label column */}
				<div className="shrink-0 w-32 sm:w-44 border-r border-gray-100 bg-white z-10">
					<div className="h-9" />
					<div className="h-6 border-b border-gray-100" />
					{rows.map((row) =>
						row.type === 'section' ? (
							<div
								key={row.key}
								className="h-8 flex items-end px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
							>
								{row.label}
							</div>
						) : (
							<RowLabel key={row.key} row={row} />
						)
					)}
				</div>

				{/* Scrolling track */}
				<div className="overflow-x-auto flex-1">
					<div
						className="relative"
						style={{ width: trackWidth }}
						onMouseMove={pick}
						onMouseLeave={() => setHoverIdx(null)}
						onClick={pick}
					>
						{/* Day header */}
						<div className="flex h-9">
							{days.map((d) => {
								const label = dayLabel(d.date, now)
								return (
									<div
										key={d.key}
										className="shrink-0 px-2 flex items-baseline gap-1.5 pt-2 overflow-hidden whitespace-nowrap border-l border-gray-300 first:border-l-0"
										style={{ width: d.span * CELL }}
									>
										<span className="text-sm font-bold text-gray-900">{label.main}</span>
										{d.span * CELL > 110 && (
											<span className="text-xs text-gray-500">{label.sub}</span>
										)}
									</div>
								)
							})}
						</div>

						{/* Hour ticks */}
						<div className="relative h-6 border-b border-gray-100">
							{hours.map((h, i) =>
								h.getHours() % 3 === 0 ? (
									<span
										key={i}
										className={`absolute top-0.5 text-[10px] tabular-nums -translate-x-1/2 ${
											h.getHours() === 0 ? 'font-bold text-gray-700' : 'text-gray-400'
										}`}
										style={{ left: i * CELL + CELL / 2 }}
									>
										{formatHour(h)}
									</span>
								) : null
							)}
						</div>

						{/* Rows */}
						{rows.map((row, r) =>
							row.type === 'section' ? (
								<div key={row.key} className="h-8" />
							) : (
								<div
									key={row.key}
									className="relative h-9 border-b border-gray-50"
									style={{
										backgroundImage:
											'repeating-linear-gradient(to right, transparent 0 23px, rgb(241 245 249) 23px 24px)',
									}}
								>
									{runsOf(levelsByRow[r]).map((run) => (
										<Segment
											key={run.start}
											run={run}
											hours={hours}
											warnings={row.warnings}
											mode={mode}
										/>
									))}
								</div>
							)
						)}

						{/* Overlays: midnight lines, hover column, now marker */}
						{dayStarts.map((i) => (
							<div
								key={i}
								className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
								style={{ left: i * CELL }}
							/>
						))}
						{hoverIdx !== null && (
							<div
								className="absolute top-9 bottom-0 bg-gray-900/5 ring-1 ring-inset ring-gray-900/10 pointer-events-none"
								style={{ left: hoverIdx * CELL, width: CELL }}
							/>
						)}
						<div
							className="absolute top-9 bottom-0 w-0.5 bg-secondary-500 pointer-events-none"
							style={{ left: nowLeft }}
						>
							<span className="absolute -top-1 -left-[3px] w-2 h-2 rounded-full bg-secondary-500" />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function RowLabel({ row }) {
	const inner = (
		<>
			{row.icon && (
				<i className={`fas ${row.icon} w-4 text-center text-gray-500`} aria-hidden />
			)}
			<span className="truncate">{row.label}</span>
		</>
	)
	const cls =
		'h-9 w-full flex items-center gap-2 px-3 text-sm text-gray-800 border-b border-gray-50 text-left'
	if (row.onClick) {
		return (
			<button
				type="button"
				onClick={row.onClick}
				className={`${cls} font-medium hover:bg-gray-50 hover:text-primary-700`}
			>
				{inner}
			</button>
		)
	}
	return <div className={`${cls} font-medium`}>{inner}</div>
}
