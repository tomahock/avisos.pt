import { proxyFogos } from '../../_fogos.js'
import { activeWarnings } from '../../../src/utils/share.js'

// AEMET (Spain) warnings via FogosPT, already in the IPMA shape plus
// areaName/phenomenon/parameter/probability. `peninsula=1` leaves out the
// Canaries, Ceuta and Melilla.
export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/warnings/aemet?peninsula=1',
		cacheSeconds: 300,
		transform: (data) => activeWarnings(data),
		label: 'aemet-warnings',
	})
}
