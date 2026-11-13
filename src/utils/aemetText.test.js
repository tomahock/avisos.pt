import { describe, expect, test } from 'vitest'

import { displayText, parameterText, probabilityText } from './aemetText.js'

// Real shapes of AEMET's land warnings: `text` starts with `parameter`.
describe('displayText', () => {
	test('drops the leading threshold, keeps the rest', () => {
		expect(
			displayText({ parameter: 'Rachas máximas: 80 km/h', text: 'Rachas máximas: 80 km/h. Viento del suroeste.' }),
		).toBe('Viento del suroeste.')
	})

	test('a text that is only the threshold is null', () => {
		const parameter = 'Precipitación acumulada en 12 horas: 40 mm'
		expect(displayText({ parameter, text: `${parameter}.` })).toBeNull()
		expect(displayText({ parameter, text: parameter })).toBeNull()
		expect(displayText({ parameter, text: `${parameter}.  ` })).toBeNull()
	})

	test('coastal (value-less parameter): text unchanged', () => {
		const text = 'Mar combinada del noroeste de 4 a 5 metros.'
		expect(displayText({ parameter: 'Costeros: ', text })).toBe(text)
	})

	test('a text not starting with the parameter is unchanged', () => {
		const text = 'Viento del suroeste. Rachas máximas: 80 km/h.'
		expect(displayText({ parameter: 'Rachas máximas: 80 km/h', text })).toBe(text)
	})

	test('missing text is null', () => {
		expect(displayText({ parameter: 'Rachas máximas: 80 km/h' })).toBeNull()
		expect(displayText({ text: '' })).toBeNull()
		expect(displayText(null)).toBeNull()
	})
})

test('re-exported helpers keep their behaviour', () => {
	expect(parameterText({ parameter: 'Costeros: ' })).toBeNull()
	expect(probabilityText({ probability: '40%-70%' })).toBe('40–70 %')
})
