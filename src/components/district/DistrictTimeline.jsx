import { useMemo } from 'react'

import TimelineGrid from '../timeline/TimelineGrid.jsx'
import { typeRows } from '../timeline/typeRows.js'
import { buildHours } from '../../utils/timeline.js'

export default function DistrictTimeline({ list, now }) {
	const hourKey = Math.floor(now.getTime() / 3600000)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const hours = useMemo(() => buildHours(list, now), [list, hourKey])
	const rows = useMemo(() => typeRows(list), [list])
	return <TimelineGrid hours={hours} now={now} rows={rows} mode="level" />
}
