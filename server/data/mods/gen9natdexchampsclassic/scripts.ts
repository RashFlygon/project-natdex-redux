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
};
