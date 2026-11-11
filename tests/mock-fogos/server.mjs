// Fake FogosPT API for E2E and local work: `npm run mock:fogos`, then
//   npx wrangler pages dev dist --binding FOGOS_API_KEY=test --binding FOGOS_API_BASE=http://127.0.0.1:8799
// Data comes from tests/fixtures/data.js, relative to when the server started.

import http from 'node:http'

import { makeFixtures } from '../fixtures/data.js'
import { fogosRoute } from '../fixtures/fogos.js'

const PORT = Number(process.env.MOCK_FOGOS_PORT ?? 8799)
const fx = makeFixtures(new Date())

http
	.createServer((req, res) => {
		const { status, body } = fogosRoute(fx, req.url)
		res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
		res.end(JSON.stringify(body))
	})
	.listen(PORT, '127.0.0.1', () => console.log(`mock FogosPT on http://127.0.0.1:${PORT}`))
