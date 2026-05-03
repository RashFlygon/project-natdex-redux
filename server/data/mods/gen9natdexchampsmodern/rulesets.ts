export const Rulesets: import('../../../sim/dex-formats').ModdedFormatDataTable = {
	standardag: {
		inherit: true,
		ruleset: [
			'Obtainable', 'Team Preview', 'HP Percentage Mod', 'Cancel Mod', 'Endless Battle Clause',
		],
	},
	standard: {
		inherit: true,
		ruleset: [
			'Standard AG',
			'Sleep Clause Mod', 'Species Clause', 'Nickname Clause', 'OHKO Clause', 'Evasion Items Clause', 'Evasion Moves Clause',
		],
	},
	standarddraft: {
		inherit: true,
		ruleset: [
			'Standard AG', 'Nickname Clause', 'Sleep Clause Mod', 'OHKO Clause', 'Evasion Clause',
		],
		onBegin() {
			this.reportPercentages = true;
		},
	},
};
