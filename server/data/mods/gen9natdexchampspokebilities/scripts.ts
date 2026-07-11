import {Scripts as ChampionsScripts} from '../gen9natdexchampsclassic/scripts';
import {Scripts as PokebilitiesScripts} from '../pokebilities/scripts';

export const Scripts: ModdedBattleScriptsData = {
	...ChampionsScripts,
	inherit: 'gen9natdexchampsclassic',
	gen: 9,
	field: {
		...ChampionsScripts.field,
		...PokebilitiesScripts.field,
	},
	pokemon: {
		...ChampionsScripts.pokemon,
		ignoringAbility: PokebilitiesScripts.pokemon!.ignoringAbility,
		hasAbility: PokebilitiesScripts.pokemon!.hasAbility,
		transformInto: PokebilitiesScripts.pokemon!.transformInto,
	},
};
