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
	calculatePP(move) {
		if (move.noPPBoosts || move.pp === 1) return move.pp;
		if (move.id === 'protect' || move.pp <= 5) return 8;
		if (move.pp <= 10) return 12;
		if (move.pp <= 15) return 16;
		return 20;
	},

	canTerastallize(pokemon) {
		const item = pokemon.getItem();

		// If this Pokémon currently has the option to Mega Evolve,
		// it should not also be allowed to Terastallize.
		if (pokemon.canMegaEvo) return null;

		// Mega / Primal Pokémon cannot Terastallize.
		if (pokemon.species.isMega || pokemon.baseSpecies.isMega) return null;
		if (pokemon.species.isPrimal || pokemon.baseSpecies.isPrimal) return null;
		if (pokemon.species.name.includes('-Mega')) return null;
		if (pokemon.species.name.includes('-Primal')) return null;

		// Pokémon holding their compatible Mega Stone cannot Terastallize.
		if (
			item.megaStone && item.megaEvolves &&
			[
				pokemon.species.name,
				pokemon.species.baseSpecies,
				pokemon.baseSpecies.name,
				pokemon.baseSpecies.baseSpecies,
			].includes(item.megaEvolves)
		) {
			return null;
		}

		// Pokémon holding any Z-Crystal cannot Terastallize.
		if (item.zMove || item.zMoveType || item.zMoveFrom) return null;

		return pokemon.teraType || null;
	}
};

