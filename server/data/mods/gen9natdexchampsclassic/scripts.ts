export const Scripts: ModdedBattleScriptsData = {
	inherit: 'champions',
	gen: 9,
	init() {},

	statModify(baseStats, set, statName) {
		const tr = this.trunc;
		let stat = baseStats[statName];
		if (statName === 'hp') {
			return tr(tr(2 * stat + set.ivs[statName] + tr(set.evs[statName] / 4) + 100) * set.level / 100 + 10);
		}
		stat = tr(tr(2 * stat + set.ivs[statName] + tr(set.evs[statName] / 4)) * set.level / 100 + 5);
		const nature = this.dex.natures.get(set.nature);
		if (nature.plus === statName) {
			stat = this.ruleTable.has('overflowstatmod') ? Math.min(stat, 595) : stat;
			stat = tr(tr(stat * 110, 16) / 100);
		} else if (nature.minus === statName) {
			stat = this.ruleTable.has('overflowstatmod') ? Math.min(stat, 728) : stat;
			stat = tr(tr(stat * 90, 16) / 100);
		}
		return stat;
	},

	calculatePP(move, ppUps = 3) {
		if (move.noPPBoosts) return move.pp;
		return move.pp * (5 + ppUps) / 5;
	},

	actions: {
		canTerastallize(pokemon) {
			const item = pokemon.getItem();

			// If this Pokémon has a Mega option, it cannot Terastallize.
			if (pokemon.canMegaEvo) return null;

			// Mega / Primal Pokémon cannot Terastallize.
			if (pokemon.species.isMega || pokemon.baseSpecies.isMega) return null;
			if (pokemon.species.isPrimal || pokemon.baseSpecies.isPrimal) return null;
			if (pokemon.species.name.includes('-Mega')) return null;
			if (pokemon.species.name.includes('-Primal')) return null;

			// Pokémon holding its compatible Mega Stone cannot Terastallize.
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

			// Terapagos should not be able to Terastallize in these formats.
			if (pokemon.baseSpecies.baseSpecies === 'Terapagos') return null;
			if (pokemon.species.baseSpecies === 'Terapagos') return null;
			if (pokemon.species.name.startsWith('Terapagos')) return null;

			return pokemon.teraType || null;
		},
	},
};
