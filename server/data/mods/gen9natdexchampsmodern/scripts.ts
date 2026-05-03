import {Learnsets as BaseLearnsets} from '../../learnsets';
import {Learnsets as PLALearnsets} from './pla-learnsets';
import {Learnsets as ZALearnsets} from './za-learnsets';

type LearnsetTable = import('../../../sim/dex-species').ModdedLearnsetDataTable;
type LearnsetData = LearnsetTable[keyof LearnsetTable];

export const Scripts: ModdedBattleScriptsData = {
	inherit: 'champions',
	gen: 9,
	init() {
		const sources = [BaseLearnsets, PLALearnsets, ZALearnsets] as LearnsetTable[];
		for (const source of sources) {
			for (const speciesId in source) {
				const sourceEntry = source[speciesId] as LearnsetData | undefined;
				if (!sourceEntry?.learnset) continue;
				const targetEntry = this.modData('Learnsets', speciesId);
				targetEntry.learnset ||= {};
				for (const moveId in sourceEntry.learnset) {
					targetEntry.learnset[moveId] = Array.from(new Set([
						...(targetEntry.learnset[moveId] || []),
						...sourceEntry.learnset[moveId],
					]));
				}
			}
		}
	},
};
