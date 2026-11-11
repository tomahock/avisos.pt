import { proxyFogos } from '../_fogos.js'
import { activeWarnings } from '../../src/utils/share.js'

export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/warnings/ipma',
		cacheSeconds: 300,
		// Belt and braces: FogosPT already drops ended warnings.
		transform: (data) => activeWarnings(data),
		label: 'warnings',
	})
}
