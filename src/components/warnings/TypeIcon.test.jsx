import { render } from '@testing-library/react'
import { expect, test } from 'vitest'

import TypeIcon from './TypeIcon.jsx'
import { typeIconHtml } from '../../data/warningTypes.js'

test('Agitação Marítima is a solid wave in the text colour, not an emoji', () => {
	const { container } = render(<TypeIcon type="Agitação Marítima" className="text-sm" title="Onda" />)
	const svg = container.querySelector('svg')
	expect(svg).not.toBeNull()
	expect(svg.getAttribute('fill')).toBe('currentColor')
	expect(svg.getAttribute('class')).toContain('text-sm')
	expect(svg.getAttribute('aria-hidden')).toBe('true')
	expect(container.textContent).not.toContain('🌊')
})

test('other types stay Font Awesome glyphs', () => {
	const { container } = render(<TypeIcon type="Vento" className="text-sm" />)
	expect(container.querySelector('i.fas.fa-wind.text-sm')).not.toBeNull()
	expect(container.querySelector('svg')).toBeNull()
})

test('typeIconHtml gives the same icon for Leaflet HTML', () => {
	expect(typeIconHtml('Agitação Marítima')).toMatch(/^<svg [^>]*fill="currentColor"/)
	expect(typeIconHtml('Agitação Marítima')).not.toContain('🌊')
	expect(typeIconHtml('Vento')).toBe('<i class="fas fa-wind"></i>')
	expect(typeIconHtml('Desconhecido')).toBe('<i class="fas fa-triangle-exclamation"></i>')
})
