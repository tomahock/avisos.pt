// IPMA warning-emission criteria, transcribed from
// https://www.ipma.pt/pt/enciclopedia/otempo/sam/index.html?page=criterios.xml
// and the usage guide (…/sam/index.html). Consulted 2026-11-09 — when IPMA
// revises the table, update the values here and CRITERIA_CONSULTED_AT.
//
// Values are kept as IPMA writes them (strings like "70 a 90", "> 130", or
// the odd descending range "3 a 1" for minimum temperatures) — don't turn
// them into numbers, the source isn't consistent enough for that.
// Each threshold row is { yellow, orange, red, unit, note? }.

export const CRITERIA_SOURCE_URL =
	'https://www.ipma.pt/pt/enciclopedia/otempo/sam/index.html?page=criterios.xml'
export const CRITERIA_GUIDE_URL = 'https://www.ipma.pt/pt/enciclopedia/otempo/sam/index.html'
export const CRITERIA_CONSULTED_AT = '2026-11-09'

// What each colour means, per IPMA's usage guide.
export const LEVEL_MEANING = {
	green: {
		meaning: 'Não se prevê nenhuma situação meteorológica de risco.',
		action: null,
	},
	yellow: {
		meaning: 'Situação de risco para determinadas atividades dependentes da situação meteorológica.',
		action: 'Acompanhar a evolução das condições meteorológicas.',
	},
	orange: {
		meaning: 'Situação meteorológica de risco moderado a elevado.',
		action: 'Manter-se ao corrente da evolução das condições meteorológicas e seguir as orientações da ANEPC.',
	},
	red: {
		meaning: 'Situação meteorológica de risco extremo.',
		action: 'Manter-se regularmente ao corrente da evolução das condições meteorológicas e seguir as orientações da ANEPC.',
	},
}

const SNOW = {
	type: 'Neve',
	parameter: 'Queda de neve com acumulação',
	rows: [
		{ yellow: '1 a 5', orange: '6 a 15', red: '> 15', unit: 'cm', note: 'Cota abaixo de 1000 m' },
		{ yellow: '1 a 10', orange: '11 a 30', red: '> 30', unit: 'cm', note: 'Cota de 1000 a 1600 m' },
		{ yellow: '5 a 25', orange: '26 a 50', red: '> 50', unit: 'cm', note: 'Cota acima de 1600 m' },
	],
}

const THUNDER = {
	type: 'Trovoada',
	parameter: 'Descargas elétricas, aguaceiros, granizo e rajada máxima do vento',
	thunder: true,
}

const FOG = {
	type: 'Nevoeiro',
	parameter: 'Visibilidade — nevoeiro persistente, pela duração',
	rows: [{ yellow: '≥ 48', orange: '≥ 72', red: '≥ 96', unit: 'h', note: 'Duração' }],
}

const HEAT = {
	type: 'Tempo Quente',
	parameter: 'Temperatura máxima, com duração ≥ 48 horas',
	temperature: 'max',
}

const COLD = {
	type: 'Tempo Frio',
	parameter: 'Temperatura mínima, com duração ≥ 48 horas',
	temperature: 'min',
}

const RAIN_1H = { yellow: '10 a 20', orange: '21 a 40', red: '> 40', unit: 'mm/1h', note: 'Milímetros numa hora' }

export const CRITERIA_REGIONS = [
	{
		key: 'continente',
		title: 'Portugal Continental',
		short: 'Continente',
		areaLabel: 'Distrito',
		types: [
			{
				type: 'Vento',
				parameter: 'Rajada máxima do vento',
				rows: [
					{ yellow: '70 a 90', orange: '91 a 130', red: '> 130', unit: 'km/h' },
					{ yellow: '90 a 110', orange: '111 a 130', red: '> 130', unit: 'km/h', note: 'Nas terras altas' },
				],
			},
			{
				type: 'Precipitação',
				parameter: 'Chuva / aguaceiros',
				rows: [
					RAIN_1H,
					{ yellow: '30 a 40', orange: '41 a 60', red: '> 60', unit: 'mm/6h', note: 'Milímetros em 6 horas' },
				],
			},
			SNOW,
			THUNDER,
			FOG,
			HEAT,
			COLD,
			{
				type: 'Agitação Marítima',
				parameter: 'Altura significativa das ondas',
				rows: [
					{ yellow: '4 a 5', orange: '5 a 7', red: '> 7', unit: 'm' },
					{ yellow: '2 a 3', orange: '3 a 5', red: '> 5', unit: 'm', note: 'Com ondulação de sueste na costa sul do Algarve' },
				],
			},
		],
		// [name, min yellow/orange/red, max yellow/orange/red]
		temperatures: [
			['Viana do Castelo', ['-1 a -3', '-4 a -5', '< -5'], ['32 a 36', '37 a 38', '> 38']],
			['Braga', ['-1 a -3', '-4 a -5', '< -5'], ['34 a 36', '37 a 38', '> 38']],
			['Porto', ['1 a -1', '-2 a -3', '< -3'], ['32 a 36', '37 a 38', '> 38']],
			['Vila Real', ['-2 a -3', '-4 a -5', '< -5'], ['34 a 37', '38 a 39', '> 39']],
			['Bragança', ['-4 a -7', '-8 a -10', '< -10'], ['34 a 36', '37 a 38', '> 38']],
			['Viseu', ['-2 a -4', '-5 a -7', '< -7'], ['35 a 38', '39 a 40', '> 40']],
			['Guarda', ['-3 a -6', '-7 a -10', '< -10'], ['31 a 33', '34 a 36', '> 36']],
			['Castelo Branco', ['0 a -2', '-3 a -4', '< -4'], ['37 a 39', '40 a 41', '> 41']],
			['Aveiro', ['3 a 1', '0 a -1', '< -1'], ['31 a 35', '36 a 38', '> 38']],
			['Coimbra', ['-1 a -3', '-4 a -5', '< -5'], ['35 a 38', '39 a 40', '> 40']],
			['Leiria', ['-1 a -3', '-4 a -6', '< -6'], ['31 a 35', '36 a 40', '> 40']],
			['Lisboa', ['3 a 1', '0 a -1', '< -1'], ['34 a 37', '38 a 40', '> 40']],
			['Setúbal', ['1 a -2', '-3 a -4', '< -4'], ['35 a 39', '40 a 42', '> 42']],
			['Santarém', ['1 a -1', '-2 a -3', '< -3'], ['38 a 41', '42 a 43', '> 43']],
			['Portalegre', ['1 a -1', '-2 a -5', '< -5'], ['36 a 39', '40 a 41', '> 41']],
			['Évora', ['1 a -1', '-2 a -4', '< -4'], ['37 a 40', '41 a 43', '> 43']],
			['Beja', ['1 a -1', '-2 a -4', '< -4'], ['37 a 40', '41 a 43', '> 43']],
			['Faro', ['4 a 1', '0 a -1', '< -1'], ['33 a 37', '38 a 41', '> 41']],
		],
	},
	{
		key: 'madeira',
		title: 'Arquipélago da Madeira',
		short: 'Madeira',
		areaLabel: 'Região',
		types: [
			{
				type: 'Vento',
				parameter: 'Rajada máxima do vento',
				rows: [
					{ yellow: '70 a 90', orange: '91 a 130', red: '> 130', unit: 'km/h' },
					{ yellow: '90 a 110', orange: '111 a 130', red: '> 130', unit: 'km/h', note: 'Nas terras altas' },
				],
			},
			{
				type: 'Precipitação',
				parameter: 'Chuva / aguaceiros',
				rows: [
					RAIN_1H,
					{ yellow: '30 a 40', orange: '41 a 60', red: '> 60', unit: 'mm/6h', note: 'Milímetros em 6 horas' },
				],
			},
			SNOW,
			THUNDER,
			FOG,
			HEAT,
			COLD,
			{
				type: 'Agitação Marítima',
				parameter: 'Altura significativa das ondas',
				rows: [{ yellow: '4 a 5', orange: '5 a 7', red: '> 7', unit: 'm' }],
			},
		],
		temperatures: [
			['Costa Norte', ['7 a 8', '5 a 6', '< 5'], ['24 a 26', '27 a 30', '> 30']],
			['Regiões Montanhosas', ['-2 a -1', '-4 a -2', '< -4'], ['25 a 27', '28 a 29', '> 29']],
			['Costa Sul', ['10 a 11', '8 a 9', '< 8'], ['27 a 29', '30 a 35', '> 35']],
			['Porto Santo', ['10 a 11', '8 a 9', '< 8'], ['26 a 27', '28 a 31', '> 31']],
		],
	},
	{
		key: 'acores',
		title: 'Arquipélago dos Açores',
		short: 'Açores',
		areaLabel: 'Grupo',
		types: [
			{
				type: 'Vento',
				parameter: 'Velocidade média e rajada máxima do vento',
				rows: [
					{ yellow: '65 a 74', orange: '75 a 87', red: '> 87', unit: 'km/h', note: 'Velocidade média' },
					{ yellow: '85 a 100', orange: '101 a 130', red: '> 130', unit: 'km/h', note: 'Rajada máxima' },
				],
			},
			{
				type: 'Precipitação',
				parameter: 'Chuva / aguaceiros',
				rows: [
					RAIN_1H,
					{ yellow: '25 a 40', orange: '41 a 60', red: '> 60', unit: 'mm/6h', note: 'Milímetros em 6 horas' },
				],
			},
			SNOW,
			THUNDER,
			FOG,
			HEAT,
			COLD,
			{
				type: 'Agitação Marítima',
				parameter: 'Altura significativa das ondas',
				rows: [{ yellow: '6 a 7', orange: '7 a 9', red: '> 9', unit: 'm' }],
			},
		],
		temperatures: [
			['Grupo Oriental', ['8 a 5', '4 a 0', '< 0'], ['28 a 29', '30 a 31', '> 31']],
			['Grupo Central', ['8 a 5', '4 a 0', '< 0'], ['28 a 29', '30 a 31', '> 31']],
			['Grupo Ocidental', ['8 a 5', '4 a 0', '< 0'], ['28 a 29', '30 a 31', '> 31']],
		],
	},
]

// Expected phenomena per thunderstorm warning level (same for all regions).
export const THUNDER_PHENOMENA = {
	yellow:
		'Condições favoráveis para ocorrência de fenómenos meteorológicos localizados, como: trovoada; precipitação localmente forte, com acumulação entre 10 a 20 mm em 1 h; granizo com diâmetro < 2 cm; rajadas entre 70 e 90 km/h.',
	orange:
		'Condições favoráveis para ocorrência de fenómenos meteorológicos severos localizados, como: trovoada; precipitação localmente muito forte, com acumulação entre 20 a 40 mm em 1 h; granizo com diâmetro ≥ 2 cm; rajadas iguais ou superiores a 90 km/h.',
	red:
		'Condições favoráveis para ocorrência de fenómenos meteorológicos extremos localizados com potencial para impactos elevados, como: trovoada; precipitação muito forte, com acumulação ≥ 40 mm em 1 h; granizo de grandes dimensões; rajadas muito destrutivas.',
}

// IPMA only publishes "probable impacts" for snow.
export const SNOW_IMPACTS = {
	yellow:
		'Perturbação causada por queda de neve com acumulação e possível formação de gelo (p. ex., vias condicionadas ou interditas, danos em estruturas ou árvores, abastecimentos locais prejudicados).',
	orange:
		'Perturbação moderada causada por queda de neve com acumulação e possível formação de gelo (p. ex., vias condicionadas ou interditas, danos em estruturas ou árvores, abastecimentos locais prejudicados).',
	red:
		'Perturbação grave causada por queda de neve com acumulação e possível formação de gelo (p. ex., vias interditas, danos em estruturas ou árvores, abastecimentos locais prejudicados).',
}
