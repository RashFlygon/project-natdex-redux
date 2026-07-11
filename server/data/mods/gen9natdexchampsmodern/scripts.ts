import {Learnsets as BaseLearnsets} from '../../learnsets';
import {Scripts as ChampionsScripts} from '../champions/scripts';
import {Learnsets as PLALearnsets} from './pla-learnsets';
import {Learnsets as ZALearnsets} from './za-learnsets';

type LearnsetTable = import('../../../sim/dex-species').ModdedLearnsetDataTable;
type LearnsetData = LearnsetTable[keyof LearnsetTable];
type StringLearnsetTable = {[speciesid: string]: LearnsetData | undefined};
type StringLearnset = {[moveid: string]: string[]};
type AbilitySlots = Partial<Record<'0' | '1' | 'H' | 'S', string>>;

export const Scripts: ModdedBattleScriptsData = {
	inherit: 'champions',
	gen: 9,
	init() {
		const megaAbilityOverrides: {[speciesid: string]: AbilitySlots} = {
			absolmegaz: {0: "Super Luck"},
			baxcaliburmega: {0: "Thermal Exchange", H: "Ice Body"},
			darkraimega: {0: "Bad Dreams"},
			garchompmegaz: {0: "Sand Veil"},
			golisopodmega: {0: "Emergency Exit"},
			heatranmega: {0: "Flash Fire"},
			lucariomegaz: {0: "Steadfast"},
			magearnamega: {0: "Soul-Heart"},
			magearnaoriginalmega: {0: "Soul-Heart"},
			tatsugiricurlymega: {0: "Commander"},
			tatsugiridroopymega: {0: "Commander"},
			tatsugiristretchymega: {0: "Commander"},
			zeraoramega: {0: "Volt Absorb"},
			zygardemega: {0: "Aura Break"},
		};
		for (const [speciesId, abilities] of Object.entries(megaAbilityOverrides)) {
			const species = this.modData('Pokedex', speciesId);
			species.abilities = abilities;
			delete species.isNonstandard;
		}
		for (const itemId of [
			'absolitez', 'baxcalibrite', 'darkranite', 'garchompitez', 'golisopite', 'heatranite',
			'lucarionitez', 'magearnite', 'tatsugirinite', 'zeraorite', 'zygardite',
		]) {
			delete this.modData('Items', itemId).isNonstandard;
		}
		const sources = [BaseLearnsets, PLALearnsets, ZALearnsets] as LearnsetTable[];
		for (const source of sources) {
			for (const speciesId in source as StringLearnsetTable) {
				const sourceEntry = (source as StringLearnsetTable)[speciesId];
				if (!sourceEntry?.learnset) continue;
				const targetEntry = this.modData('Learnsets', speciesId);
				const targetLearnset = (targetEntry.learnset ||= {}) as StringLearnset;
				const sourceLearnset = sourceEntry.learnset as StringLearnset;
				for (const moveId in sourceLearnset) {
					targetLearnset[moveId] = Array.from(new Set([
						...(targetLearnset[moveId] || []),
						...sourceLearnset[moveId],
					]));
				}
			}
		}
		for (const speciesId of ['deoxys', 'deoxysattack', 'deoxysdefense', 'deoxysspeed']) {
			const entry = this.modData('Learnsets', speciesId);
			entry.learnset ||= {};
			entry.learnset.toxicspikes = ['8M'];
		}
	},
	calculatePP(move) {
		if (move.noPPBoosts || move.pp === 1) return move.pp;
		if (move.id === 'protect' || move.pp <= 5) return 8;
		if (move.pp <= 10) return 12;
		if (move.pp <= 15) return 16;
		return 20;
	},

	actions: {
		...ChampionsScripts.actions,
		canTerastallize(pokemon) {
			const species = pokemon.species;
			const item = pokemon.getItem();
			if (species.isMega || species.isPrimal || pokemon.baseSpecies.isMega || pokemon.baseSpecies.isPrimal) return null;
			if (species.name.includes('-Mega') || species.name.includes('-Primal')) return null;
			if (pokemon.canMegaEvo || item.zMove || item.zMoveType || item.zMoveFrom) return null;
			if (item.megaStone?.[pokemon.baseSpecies.name] || item.megaStone?.[species.name]) return null;
			return pokemon.teraType || null;
		},
	},
};
