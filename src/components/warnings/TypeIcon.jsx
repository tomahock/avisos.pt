import { warningTypeMeta } from '../../data/warningTypes.js'

// Icon for a warning type: emoji when the type defines one (🌊 Agitação
// Marítima), otherwise the Font Awesome glyph. `className` sizes/colours it
// the same way in both cases (font-size applies to the emoji too).
export default function TypeIcon({ type, className = '', title }) {
	const meta = warningTypeMeta(type)
	if (meta.emoji) {
		return (
			<span className={`inline-block not-italic leading-none ${className}`} title={title} aria-hidden>
				{meta.emoji}
			</span>
		)
	}
	return <i className={`fas ${meta.icon} ${className}`} title={title} aria-hidden />
}
