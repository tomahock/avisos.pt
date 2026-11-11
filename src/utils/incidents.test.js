import { expect, test } from 'vitest'

import { districtIncidents, incidentDistrictCode, incidentKind, incidentUrl } from './incidents.js'

test('ANEPC district names match regardless of case and accents', () => {
	expect(incidentDistrictCode('Viana Do Castelo')).toBe('VCT')
	expect(incidentDistrictCode('SANTARÉM')).toBe('STM')
	expect(incidentDistrictCode('  evora ')).toBe('EVR')
	expect(incidentDistrictCode('Açores')).toBeNull()
	expect(incidentDistrictCode(undefined)).toBeNull()
})

test('natureza → kind by keyword', () => {
	expect(incidentKind('Inundação de via').label).toBe('Inundações')
	expect(incidentKind('Queda de árvore').label).toBe('Quedas de árvores')
	expect(incidentKind('Corte ou remoção de elementos em perigo de queda').label).toBe('Elementos em perigo de queda')
	expect(incidentKind('Queda de estrutura').label).toBe('Estruturas')
	expect(incidentKind('Algo novo').label).toBe('Outras ocorrências')
	expect(incidentKind(null).label).toBe('Outras ocorrências')
})

test('incidentUrl encodes the id', () => {
	expect(incidentUrl('2026 1/2')).toBe('https://fogos.pt/pt/fogo/2026%201%2F2/detalhe')
})

test('districtIncidents filters by IPMA code and tolerates null', () => {
	const list = [{ district: 'Lisboa' }, { district: 'Porto' }, { district: 'LISBOA' }]
	expect(districtIncidents(list, 'LSB')).toHaveLength(2)
	expect(districtIncidents(null, 'LSB')).toEqual([])
})
