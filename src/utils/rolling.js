// Rolling sums over an hourly series (one entry per hour, null = no reading).
// DOM/React-free.

/**
 * Sum of the last `hours` values at each index, only where all of them were
 * measured — a missing hour makes the window unknown (null), never a smaller
 * total. The first `hours - 1` entries have no full window → null.
 */
export function rollingSum(values, hours = 6) {
	const out = new Array(values.length).fill(null)
	for (let i = hours - 1; i < values.length; i++) {
		let sum = 0
		let ok = true
		for (let j = i - hours + 1; j <= i; j++) {
			const v = values[j]
			if (v == null || !Number.isFinite(v)) {
				ok = false
				break
			}
			sum += v
		}
		if (ok) out[i] = Math.round(sum * 10) / 10
	}
	return out
}
