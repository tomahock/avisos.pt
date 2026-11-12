import { warningTypeMeta } from '../../data/warningTypes.js'

// Icon for a warning type: inline SVG when the type defines one (the wave of
// Agitação Marítima), otherwise the Font Awesome glyph. `className` sizes and
// colours it the same way in both cases (1em tall, currentColor).
export default function TypeIcon({ type, className = '', title }) {
	const meta = warningTypeMeta(type)
	if (meta.svg) {
		const [, , w, h] = meta.svg.viewBox.split(' ').map(Number)
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox={meta.svg.viewBox}
				width={`${(w / h).toFixed(3)}em`}
				height="1em"
				fill="currentColor"
				className={`inline-block align-[-0.125em] ${className}`}
				aria-hidden
			>
				{title && <title>{title}</title>}
				<path d={meta.svg.path} />
			</svg>
		)
	}
	return <i className={`fas ${meta.icon} ${className}`} title={title} aria-hidden />
}
