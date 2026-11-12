import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import MapLegend from './MapLegend.jsx'

test('legend explains the sea band with its width', () => {
	render(<MapLegend />)
	expect(screen.getByText('Vermelho')).toBeInTheDocument()
	expect(screen.getByText(/Faixa no mar \(20 km\)/)).toHaveTextContent('agitação marítima')
})

test('strip legend (phones) has the same entries, in one row under the map', () => {
	render(<MapLegend variant="strip" />)
	const strip = screen.getByTestId('map-legend-strip')
	expect(strip).toHaveClass('sm:hidden')
	for (const label of ['Vermelho', 'Laranja', 'Amarelo', 'Sem aviso']) expect(screen.getByText(label)).toBeInTheDocument()
	expect(screen.getByText(/Faixa no mar \(20 km\): agitação marítima/)).toBeInTheDocument()
	expect(screen.queryByTestId('map-legend')).toBeNull()
})
