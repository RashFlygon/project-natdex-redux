import {Moves as BaseMoves} from '../../moves';
import {Moves as ChampionsMoves} from '../champions/moves';

type MoveTable = import('../../../sim/dex-moves').ModdedMoveDataTable;
type StringMoveTable = {[id: string]: any};

export const Moves: MoveTable = {};

const mergeInheritedMove = (baseMove: any, championsMove: any) => {
	const {inherit, ...championsOverrides} = championsMove;
	const mergedMove = {...baseMove, ...championsOverrides};
	if (championsMove.condition?.inherit) {
		const conditionOverrides = {...championsMove.condition};
		delete conditionOverrides.inherit;
		mergedMove.condition = {...baseMove?.condition, ...conditionOverrides};
	}
	return mergedMove;
};

const baseTable = BaseMoves as StringMoveTable;
const championsTable = ChampionsMoves as StringMoveTable;
const targetTable = Moves as StringMoveTable;
const ids = new Set([...Object.keys(baseTable), ...Object.keys(championsTable)]);
for (const id of ids) {
	const baseMove = baseTable[id];
	const championsMove = championsTable[id];
	if (!championsMove) {
		targetTable[id] = {...baseMove};
		continue;
	}
	if (championsMove.inherit) {
		targetTable[id] = mergeInheritedMove(baseMove, championsMove);
	} else {
		targetTable[id] = {...championsMove};
	}
}

for (const id of ['doubleshock', 'revivalblessing']) {
	if (targetTable[id]) targetTable[id].isNonstandard = undefined;
}
