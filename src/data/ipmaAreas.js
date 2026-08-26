// IPMA area-of-warning codes → human name.
// Continental Portugal (18 distritos) confirmed. Island codes are best-guess
// until seen in the wild; unknown codes fall back to the raw code in the UI.
export const IPMA_AREA_NAMES = {
	AVR: 'Aveiro',
	BJA: 'Beja',
	BGA: 'Braga',
	BGC: 'Bragança',
	CBO: 'Castelo Branco',
	CBR: 'Coimbra',
	EVR: 'Évora',
	FAR: 'Faro',
	GDA: 'Guarda',
	LRA: 'Leiria',
	LSB: 'Lisboa',
	PTG: 'Portalegre',
	PTO: 'Porto',
	SRE: 'Santarém',
	STB: 'Setúbal',
	VCT: 'Viana do Castelo',
	VRL: 'Vila Real',
	VIS: 'Viseu',
}

export function areaName(code) {
	return IPMA_AREA_NAMES[code] ?? code
}
