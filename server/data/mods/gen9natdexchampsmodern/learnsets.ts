import {Learnsets as BaseLearnsets} from '../../learnsets';
import {Learnsets as ChampionsLearnsets} from '../champions/learnsets';
import {Learnsets as PLALearnsets} from './pla-learnsets';
import {Learnsets as ZALearnsets} from './za-learnsets';

type LearnsetTable = import('../../../sim/dex-species').ModdedLearnsetDataTable;
type StringLearnsetTable = {[id: string]: LearnsetTable[keyof LearnsetTable]};

function cloneEntry(entry: StringLearnsetTable[string]) {
	return {
		...entry,
		learnset: entry.learnset ? {...entry.learnset} : undefined,
	};
}

function cloneTable(source: LearnsetTable): LearnsetTable {
	const table: LearnsetTable = {};
	const sourceTable = source as StringLearnsetTable;
	const targetTable = table as StringLearnsetTable;
	for (const id in sourceTable) {
		const entry = cloneEntry(sourceTable[id]);
		if (entry.learnset) {
			const learnset = entry.learnset as {[moveid: string]: string[]};
			for (const moveid in learnset) learnset[moveid] = [...learnset[moveid]];
		}
		targetTable[id] = entry;
	}
	return table;
}

function addMissingMoves(target: LearnsetTable, source: LearnsetTable) {
	const sourceTable = source as StringLearnsetTable;
	const targetTable = target as StringLearnsetTable;
	for (const id in sourceTable) {
		const sourceEntry = sourceTable[id];
		if (!sourceEntry?.learnset) continue;
		const targetEntry = targetTable[id] || (targetTable[id] = {learnset: {}});
		targetEntry.learnset ||= {};
		const targetLearnset = targetEntry.learnset as {[moveid: string]: string[]};
		const sourceLearnset = sourceEntry.learnset as {[moveid: string]: string[]};
		for (const moveid in sourceLearnset) {
			targetLearnset[moveid] = Array.from(new Set([
				...(targetLearnset[moveid] || []),
				...sourceLearnset[moveid],
			]));
		}
	}
}

export const Learnsets: LearnsetTable = cloneTable(ChampionsLearnsets);
addMissingMoves(Learnsets, BaseLearnsets);
addMissingMoves(Learnsets, PLALearnsets);
addMissingMoves(Learnsets, ZALearnsets);
