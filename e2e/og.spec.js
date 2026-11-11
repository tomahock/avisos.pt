// Share cards rendered by workers-og. Fonts come from jsDelivr at runtime —
// the only external call the suite allows, hence the retries.

import { expect, test } from '@playwright/test'

import { warningPath } from './helpers.js'

test.describe.configure({ retries: 2 })

const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) })

for (const path of ['/og/site.png', '/og/distrito/lisboa.png', '/og/distrito/porto-santo.png', '/og/estacao/1200535.png']) {
	test(path, async ({ request }) => {
		const res = await request.get(path)
		expect(res.status()).toBe(200)
		expect(res.headers()['content-type']).toBe('image/png')
		const body = await res.body()
		expect(body.subarray(1, 4).toString()).toBe('PNG')
		expect(pngSize(body)).toEqual({ width: 1200, height: 630 })
	})
}

test('warning card', async ({ request }) => {
	const { path } = await warningPath(request)
	const res = await request.get(`/og/aviso/${path.split('/distrito/')[1].replace('/aviso/', '/')}.png`)
	expect(res.status()).toBe(200)
	expect(res.headers()['content-type']).toBe('image/png')
})
