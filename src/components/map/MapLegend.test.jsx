import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import MapLegend from './MapLegend.jsx'

test('legend explains the sea band with its width', () => {
	render(<MapLegend />)
	expect(screen.getByText('Vermelho')).toBeInTheDocument()
	expect(screen.getByText(/Faixa no mar \(20 km\)/)).toHaveTextContent('agitação marítima')
})

test('showSpain adds the AEMET line; without it, no Spain line', () => {
	const { rerender } = render(<MapLegend showSpain />)
	expect(screen.getByText('Espanha: avisos da AEMET')).toBeInTheDocument()
	rerender(<MapLegend />)
	expect(screen.queryByText('Espanha: avisos da AEMET')).not.toBeInTheDocument()
})
