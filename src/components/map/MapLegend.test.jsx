import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import MapLegend from './MapLegend.jsx'

test('legend explains the sea band with its width', () => {
	render(<MapLegend />)
	expect(screen.getByText('Vermelho')).toBeInTheDocument()
	expect(screen.getByText(/Faixa no mar \(20 km\)/)).toHaveTextContent('agitação marítima')
})
