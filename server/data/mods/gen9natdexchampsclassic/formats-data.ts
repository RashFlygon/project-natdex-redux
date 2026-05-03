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
