/* eslint-env node */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.resolve(ROOT, '..', 'project-natdex-calc', 'src', 'js', 'data', 'natdex-champions.js');

const MODS = {
	classic: {
		id: 'natdex-champions',
		name: 'National Dex Champions',
		mod: 'gen9natdexchampsclassic',
	},
	modern: {
		id: 'natdex-champions-modern',
		name: 'National Dex Champions Modern',
		mod: 'gen9natdexchampsmodern',
	},
};

const STAT_IDS = {hp: 'hp', atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp'};
const TYPE_EFFECTIVENESS = {0: 1, 1: 2, 2: 0.5, 3: 0};

function toCalcStats(stats) {
	const out = {};
	for (const [serverStat, calcStat] of Object.entries(STAT_IDS)) {
		out[calcStat] = stats[serverStat] || 0;
	}
	return out;
}

function orderedAbilityList(abilities) {
	return ['0', '1', 'H', 'S']
		.map(slot => abilities && abilities[slot])
		.filter((ability, index, list) => ability && list.indexOf(ability) === index);
}

function convertSpecies(dex) {
	const species = {};
	for (const id in dex.data.Pokedex) {
		const mon = dex.species.get(id);
		if (!mon.exists || mon.isNonstandard === 'CAP') continue;
		const abilities = orderedAbilityList(mon.abilities);
		species[mon.name] = {
			types: mon.types,
			bs: toCalcStats(mon.baseStats),
			weightkg: mon.weightkg || 0,
			abilities,
		};
		if (mon.gender) species[mon.name].gender = mon.gender;
		if (mon.nfe) species[mon.name].nfe = true;
		if (mon.baseSpecies && mon.baseSpecies !== mon.name) species[mon.name].baseSpecies = mon.baseSpecies;
		if (mon.otherFormes && mon.otherFormes.length) species[mon.name].otherFormes = mon.otherFormes;
	}
	return species;
}

function moveFlags(move) {
	const flags = move.flags || {};
	return {
		makesContact: !!flags.contact,
		isPunch: !!flags.punch,
		isBite: !!flags.bite,
		isBullet: !!flags.bullet,
		isSound: !!flags.sound,
		isPulse: !!flags.pulse,
		isSlicing: !!flags.slicing,
		isWind: !!flags.wind,
	};
}

function convertMoves(dex) {
	const moves = {'(No Move)': {bp: 0, type: 'Normal', category: 'Status'}};
	for (const id in dex.data.Moves) {
		const move = dex.moves.get(id);
		if (!move.exists) continue;
		const data = {
			bp: move.basePower || 0,
			type: move.type,
			category: move.category,
			target: move.target,
			priority: move.priority || 0,
			...moveFlags(move),
		};
		if (move.secondaries || move.secondary) data.secondaries = true;
		if (move.recoil) data.recoil = move.recoil;
		if (move.drain) data.drain = move.drain;
		if (move.multihit) data.multihit = move.multihit;
		if (move.willCrit) data.willCrit = true;
		if (move.breaksProtect) data.breaksProtect = true;
		if (move.overrideOffensiveStat) data.overrideOffensiveStat = move.overrideOffensiveStat;
		if (move.overrideDefensiveStat) data.overrideDefensiveStat = move.overrideDefensiveStat;
		if (move.overrideOffensivePokemon) data.overrideOffensivePokemon = move.overrideOffensivePokemon;
		if (move.overrideDefensivePokemon) data.overrideDefensivePokemon = move.overrideDefensivePokemon;
		if (move.zMove && move.zMove.basePower) data.zp = move.zMove.basePower;
		if (move.maxMove && move.maxMove.basePower) data.maxPower = move.maxMove.basePower;
		if (move.self) data.self = move.self;
		moves[move.name] = data;
	}
	return moves;
}

function convertItems(dex) {
	const items = {};
	for (const id in dex.data.Items) {
		const item = dex.items.get(id);
		if (!item.exists) continue;
		const data = {};
		if (item.megaStone) data.megaStone = item.megaStone;
		if (item.isBerry) data.isBerry = true;
		if (item.naturalGift) {
			data.naturalGift = {
				basePower: item.naturalGift.basePower,
				type: item.naturalGift.type,
			};
		}
		items[item.name] = data;
	}
	return items;
}

function convertAbilities(dex) {
	const abilities = [];
	for (const id in dex.data.Abilities) {
		const ability = dex.abilities.get(id);
		if (ability.exists) abilities.push(ability.name);
	}
	return abilities.sort();
}

function convertTypes(dex) {
	const typeChart = {};
	for (const id in dex.data.TypeChart) {
		const type = dex.types.get(id);
		if (!type.exists) continue;
		if (!typeChart[type.name]) typeChart[type.name] = {};
		for (const targetType of Object.keys(typeChart)) {
			typeChart[type.name][targetType] = typeChart[type.name][targetType] ?? 1;
			typeChart[targetType][type.name] = typeChart[targetType][type.name] ?? 1;
		}
		for (const [attackingType, code] of Object.entries(type.damageTaken || {})) {
			if (attackingType === 'prankster') continue;
			if (!typeChart[attackingType]) typeChart[attackingType] = {};
			typeChart[attackingType][type.name] = TYPE_EFFECTIVENESS[code] ?? 1;
		}
	}
	if (!typeChart['???']) {
		typeChart['???'] = {};
		for (const type of Object.keys(typeChart)) typeChart['???'][type] = 1;
	}
	return typeChart;
}

function convertLearnsets(dex) {
	const learnsets = {};
	for (const id in dex.data.Learnsets) {
		const species = dex.species.get(id);
		if (!species.exists || !dex.data.Learnsets[id].learnset) continue;
		learnsets[species.name] = Object.keys(dex.data.Learnsets[id].learnset)
			.map(moveid => dex.moves.get(moveid).name)
			.filter(Boolean)
			.sort();
	}
	return learnsets;
}

function buildSetsFromLearnsets(data) {
	const sets = {};
	for (const [speciesName, mon] of Object.entries(data.species)) {
		sets[speciesName] = {};
	}
	return sets;
}

function exportMod(Dex, config) {
	const dex = Dex.mod(config.mod);
	const data = {
		id: config.id,
		name: config.name,
		sourceMod: config.mod,
		species: convertSpecies(dex),
		moves: convertMoves(dex),
		items: convertItems(dex),
		abilities: convertAbilities(dex),
		types: convertTypes(dex),
		learnsets: convertLearnsets(dex),
	};
	data.sets = buildSetsFromLearnsets(data);
	return data;
}

function main() {
	const out = path.resolve(process.argv[2] || DEFAULT_OUT);
	const dexPath = path.join(ROOT, 'server', 'dist', 'sim', 'dex.js');
	if (!fs.existsSync(dexPath)) {
		throw new Error('server/dist/sim/dex.js was not found. Run `npm run build:server` first.');
	}
	const {Dex} = require(dexPath);
	const generated = {
		generatedAt: new Date().toISOString(),
		rulesets: Object.fromEntries(Object.entries(MODS).map(([key, config]) => [key, exportMod(Dex, config)])),
	};
	fs.mkdirSync(path.dirname(out), {recursive: true});
	fs.writeFileSync(out, [
		'/* Generated by project-natdex/tools/calc/export-natdex-champions-calc-data.js */',
		'var NATDEX_CHAMPIONS_CALC_DATA = ',
		JSON.stringify(generated, null, 2),
		';',
		'',
	].join('\n'));
	console.log(`Wrote ${out}`);
	for (const [key, data] of Object.entries(generated.rulesets)) {
		console.log(`${key}: ${Object.keys(data.species).length} species, ${Object.keys(data.moves).length} moves, ${Object.keys(data.items).length} items`);
	}
}

main();
