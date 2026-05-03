import {Moves as BaseMoves} from '../../moves';
import {Moves as ChampionsMoves} from '../champions/moves';

type MoveTable = import('../../../sim/dex-moves').ModdedMoveDataTable;
type StringMoveTable = {[id: string]: any};

export const Moves: MoveTable = {};

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
		const {inherit, ...championsOverrides} = championsMove;
		targetTable[id] = {...baseMove, ...championsOverrides};
	} else {
		targetTable[id] = {...championsMove};
	}
}
