// Maps concelho name (as it appears in the CAOP arquipelagos GeoJSON) to the
// IPMA warning area code. Only concelhos whose whole polygon sits inside a
// single IPMA warning area are listed here — MRM (Madeira Regiões Montanhosas)
// crosses concelho boundaries and is deliberately not mapped: MRM warnings
// still surface in the list/popups but no polygon gets an MRM color.

const ACORES_CONCELHOS = {
	// Grupo Ocidental — Flores + Corvo
	'Lajes das Flores': 'AOC',
	'Santa Cruz das Flores': 'AOC',
	'Corvo': 'AOC',

	// Grupo Central — Terceira, Graciosa, São Jorge, Pico, Faial
	'Angra do Heroísmo': 'ACE',
	'Praia da Vitória': 'ACE',
	'Santa Cruz da Graciosa': 'ACE',
	'Calheta de São Jorge': 'ACE',
	'Velas': 'ACE',
	'Lajes do Pico': 'ACE',
	'Madalena': 'ACE',
	'São Roque do Pico': 'ACE',
	'Horta': 'ACE',

	// Grupo Oriental — São Miguel + Santa Maria
	'Ponta delgada': 'AOR',
	'Ribeira Grande': 'AOR',
	'Lagoa': 'AOR',
	'Vila Franca do Campo': 'AOR',
	'Nordeste': 'AOR',
	'Povoação': 'AOR',
	'Vila do Porto': 'AOR',
}

const MADEIRA_CONCELHOS = {
	// Porto Santo (separate island)
	'Porto Santo': 'MPS',

	// Costa Norte
	'Porto Moniz': 'MCN',
	'São Vicente': 'MCN',
	'Santana': 'MCN',

	// Costa Sul — everything else on the main island
	'Câmara de Lobos': 'MCS',
	'Funchal': 'MCS',
	'Santa Cruz': 'MCS',
	'Machico': 'MCS',
	'Ribeira Brava': 'MCS',
	'Ponta do Sol': 'MCS',
	'Calheta': 'MCS', // (Madeira; the Açores one is "Calheta de São Jorge")
}

const ISLAND_CONCELHOS = { ...ACORES_CONCELHOS, ...MADEIRA_CONCELHOS }

// Given a CAOP GeoJSON feature, return the IPMA code (or null) that should
// drive its color. Continental features resolve by district name; island
// features by concelho name.
export function codeForFeature(feature, continentalResolver) {
	const props = feature.properties
	if (!props) return null
	if (props.dis_name === 'Açores' || props.dis_name === 'Madeira') {
		return ISLAND_CONCELHOS[props.con_name] ?? null
	}
	return continentalResolver(props.dis_name)
}
