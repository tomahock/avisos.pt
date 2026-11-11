import { expect, test } from 'vitest'

import { rollingSum } from './rolling.js'

test('6 h rolling sum, only over complete windows', () => {
	const v = [1, 2, 3, 4, 5, 6, 7, null, 1, 1, 1, 1, 1, 1]
	expect(rollingSum(v, 6)).toEqual([null, null, null, null, null, 21, 27, null, null, null, null, null, null, 6])
})

test('rounds to 0.1 mm and tolerates short series', () => {
	expect(rollingSum([0.1, 0.2, 0.1], 3)).toEqual([null, null, 0.4])
	expect(rollingSum([1, 2], 6)).toEqual([null, null])
	expect(rollingSum([], 6)).toEqual([])
})
