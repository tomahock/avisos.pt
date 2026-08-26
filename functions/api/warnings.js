import { proxyFogos } from '../_fogos.js'

export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/warnings/ipma',
		cacheSeconds: 300,
		label: 'warnings',
	})
}
