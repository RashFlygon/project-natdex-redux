import {FormatsData as BaseFormatsData} from '../../formats-data';
import {FormatsData as ChampionsFormatsData} from '../champions/formats-data';

type FormatsDataTable = import('../../../sim/dex-species').ModdedSpeciesFormatsDataTable;
type StringFormatsDataTable = {[id: string]: FormatsDataTable[keyof FormatsDataTable]};

export const FormatsData: FormatsDataTable = {};

const ids = new Set([...Object.keys(BaseFormatsData), ...Object.keys(ChampionsFormatsData)]);
const baseTable = BaseFormatsData as StringFormatsDataTable;
const championsTable = ChampionsFormatsData as StringFormatsDataTable;
const targetTable = FormatsData as StringFormatsDataTable;
const usableTier = (tier?: string) => tier && !['Illegal', 'Unreleased'].includes(tier);
for (const id of ids) {
	const baseData = baseTable[id] || {};
	const championsData = championsTable[id] || {};
	const baseTier = baseData.natDexTier || baseData.tier;
	const championsTier = championsData.natDexTier || championsData.tier;
	const tier = usableTier(baseTier) ? baseTier : championsTier || baseTier || "Illegal";
	const doublesTier = usableTier(baseData.doublesTier) ? baseData.doublesTier :
		championsData.doublesTier || championsTier || tier;
	targetTable[id] = {
		...baseData,
		...championsData,
		tier: tier as any,
		doublesTier: doublesTier as any,
		natDexTier: tier as any,
		isNonstandard: usableTier(baseTier) ? baseData.isNonstandard : championsData.isNonstandard,
	};
}

const natDexFormTierParents: {[id: string]: string} = {
	arceusbug: 'arceus',
	arceusdark: 'arceus',
	arceusdragon: 'arceus',
	arceuselectric: 'arceus',
	arceusfairy: 'arceus',
	arceusfighting: 'arceus',
	arceusfire: 'arceus',
	arceusflying: 'arceus',
	arceusghost: 'arceus',
	arceusgrass: 'arceus',
	arceusground: 'arceus',
	arceusice: 'arceus',
	arceuspoison: 'arceus',
	arceuspsychic: 'arceus',
	arceusrock: 'arceus',
	arceussteel: 'arceus',
	arceuswater: 'arceus',
	basculinbluestriped: 'basculin',
	basculinwhitestriped: 'basculin',
	keldeoresolute: 'keldeo',
	pumpkaboosmall: 'pumpkaboo',
	pumpkaboolarge: 'pumpkaboo',
	pumpkaboosuper: 'pumpkaboo',
	magearnaoriginal: 'magearna',
	toxtricitylowkey: 'toxtricity',
	sinisteaantique: 'sinistea',
	zarudedada: 'zarude',
	squawkabillyblue: 'squawkabilly',
	squawkabillyyellow: 'squawkabilly',
	squawkabillywhite: 'squawkabilly',
	tatsugiridroopy: 'tatsugiri',
	tatsugiristretchy: 'tatsugiri',
	dudunsparcethreesegment: 'dudunsparce',
	poltchageistartisan: 'poltchageist',
};

for (const [id, parentId] of Object.entries(natDexFormTierParents)) {
	const parentData = targetTable[parentId];
	const formData = targetTable[id];
	if (!parentData || !formData) continue;
	const tier = parentData.natDexTier || parentData.tier;
	targetTable[id] = {
		...formData,
		tier: tier as any,
		doublesTier: (usableTier(formData.doublesTier) ? formData.doublesTier : parentData.doublesTier || tier) as any,
		natDexTier: tier as any,
		isNonstandard: undefined,
	};
}

for (const [id, data] of Object.entries(targetTable)) {
	if (data.tier !== 'UUBL' && data.natDexTier !== 'UUBL') continue;
	targetTable[id] = {
		...data,
		tier: data.tier === 'UUBL' ? 'UU' : data.tier,
		natDexTier: data.natDexTier === 'UUBL' ? 'UU' : data.natDexTier,
	};
}

const natDexChampionsOUTierUbers = new Set([
	'alakazammega', 'darmanitangalar', 'darmanitangalarzen', 'dragapult',
	'genesect', 'genesectburn', 'genesectchill', 'genesectdouse', 'genesectshock',
	'landorus', 'roaringmoon', 'shedinja', 'urshifu',
	'magearnaoriginal', 'magearnamega', 'magearnaoriginalmega', 'zygardemega',
]);

for (const id of natDexChampionsOUTierUbers) {
	const data = targetTable[id];
	if (!data) continue;
	targetTable[id] = {
		...data,
		tier: 'Uber',
		natDexTier: 'Uber',
		isNonstandard: undefined,
	};
}

const natDexChampionsLegendsOUTiers = new Set([
	'absolmegaz', 'baxcalibur', 'baxcaliburmega', 'darkraimega', 'garchompmegaz',
	'golisopodmega', 'heatranmega', 'lucariomegaz', 'melmetal', 'raichumegay',
	'starmiemega', 'tatsugiricurlymega', 'tatsugiridroopymega', 'tatsugiristretchymega',
	'zeraoramega',
]);

for (const id of natDexChampionsLegendsOUTiers) {
	const data = targetTable[id];
	if (!data) continue;
	targetTable[id] = {
		...data,
		tier: 'OU',
		natDexTier: 'OU',
		isNonstandard: undefined,
	};
}

targetTable.greninjabond = {
	...targetTable.greninja,
	tier: "UU",
	doublesTier: "(DUU)",
	natDexTier: "UU",
	isNonstandard: undefined,
};
