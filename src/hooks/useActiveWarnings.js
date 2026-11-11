import { useMemo } from 'react'

import { activeWarnings } from '../utils/share.js'
import { useNow } from './useNow.js'

// The fetched list minus anything that has ended since (re-checked every
// minute) — a tab left open, or a cached response, never shows an expired
// warning. `null` while loading stays `null`.
export function useActiveWarnings(raw) {
	const now = useNow()
	return useMemo(() => (raw == null ? raw : activeWarnings(raw, now.getTime())), [raw, now])
}
