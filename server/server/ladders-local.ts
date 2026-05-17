/**
 * Ladder library
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This file handles ladders for all servers other than
 * play.pokemonshowdown.com.
 *
 * Specifically, this is the file that handles calculating and keeping
 * track of players' Elo ratings for all formats.
 *
 * Matchmaking is currently still implemented in rooms.ts.
 *
 * @license MIT
 */

import { FS, Utils } from '../lib';

// ladderCaches = {formatid: ladder OR Promise(ladder)}
// Use Ladders(formatid).ladder to guarantee a Promise(ladder).
// ladder is basically a 2D array representing the corresponding ladder.tsv
//   with userid in front
/** [userid, elo, username, w, l, t, lastUpdate */
type LadderRow = [string, number, string, number, number, number, string];
/** formatid: ladder */
type LadderCache = Map<string, LadderRow[] | Promise<LadderRow[]>>;
type ChampionsSeasonSnapshotRow = {
	userid: string,
	username: string,
	placement: number,
	rank: LadderRank,
	elo: number,
	wins: number,
	losses: number,
	ties: number,
};
type ChampionsSeasonSnapshot = {
	id: string,
	name: string,
	timestamp: number,
	rows: ChampionsSeasonSnapshotRow[],
};
type ChampionsSeason = {
	id: string,
	name: string,
	startedAt: number,
	snapshots: ChampionsSeasonSnapshot[],
};
type ChampionsSeasonData = {
	current: {id: string, name: string, startedAt: number},
	seasons: {[id: string]: ChampionsSeason},
};
export type LadderRank = {
	id: 'champion' | 'masterball' | 'ultraball' | 'greatball' | 'pokeball' | 'unranked',
	name: string,
	placement: number,
	percentile: number,
};

const ladderCaches: LadderCache = new Map();
export const CHAMPIONS_RANK_FORMAT = 'gen9natdexchampionsou';
const CHAMPIONS_SEASONS_PATH = 'config/champions/seasons.json';
const CHAMPIONS_RANK_THRESHOLDS = {
	champion: 1350,
	masterball: 1300,
	ultraball: 1200,
	greatball: 1100,
	pokeball: 1001,
};
const CHAMPIONS_MAX_CHAMPIONS = 15;

export function clearLocalLadderCache(formatid?: string) {
	if (formatid) {
		ladderCaches.delete(formatid);
		return;
	}
	ladderCaches.clear();
}

export function getLadderRankFromPlacement(placement: number, total: number, elo = 1000): LadderRank | null {
	if (!placement || !total) return null;
	const percentile = placement / total;
	if (placement <= CHAMPIONS_MAX_CHAMPIONS && elo >= CHAMPIONS_RANK_THRESHOLDS.champion) {
		return {id: 'champion', name: 'Champion', placement, percentile};
	}
	if (elo >= CHAMPIONS_RANK_THRESHOLDS.masterball) {
		return {id: 'masterball', name: `Master Ball ${rankDivisionByElo(elo, CHAMPIONS_RANK_THRESHOLDS.masterball, CHAMPIONS_RANK_THRESHOLDS.champion)}`, placement, percentile};
	}
	if (elo >= CHAMPIONS_RANK_THRESHOLDS.ultraball) {
		return {id: 'ultraball', name: `Ultra Ball ${rankDivisionByElo(elo, CHAMPIONS_RANK_THRESHOLDS.ultraball, CHAMPIONS_RANK_THRESHOLDS.masterball)}`, placement, percentile};
	}
	if (elo >= CHAMPIONS_RANK_THRESHOLDS.greatball) {
		return {id: 'greatball', name: `Great Ball ${rankDivisionByElo(elo, CHAMPIONS_RANK_THRESHOLDS.greatball, CHAMPIONS_RANK_THRESHOLDS.ultraball)}`, placement, percentile};
	}
	if (elo >= CHAMPIONS_RANK_THRESHOLDS.pokeball) {
		return {id: 'pokeball', name: `Poke Ball ${rankDivisionByElo(elo, CHAMPIONS_RANK_THRESHOLDS.pokeball, CHAMPIONS_RANK_THRESHOLDS.greatball)}`, placement, percentile};
	}
	return defaultRank(placement);
}

function rankDivisionByElo(elo: number, min: number, max: number) {
	const step = (max - min) / 3;
	if (elo >= max - step) return 'I';
	if (elo >= max - step * 2) return 'II';
	return 'III';
}

function defaultRank(placement = 0): LadderRank {
	return {id: 'pokeball', name: 'Poke Ball III', placement, percentile: 1};
}

function unrankedRank(): LadderRank {
	return {id: 'unranked', name: 'Unranked', placement: 0, percentile: 1};
}

function rankPayload(rank: LadderRank | null, elo = 0) {
	if (!rank) return '';
	return `${rank.id},${rank.name},${rank.placement},${Math.round(elo)}`;
}

function addChampionsRankProtocol(room: AnyObject, username: string, rank: LadderRank | null, elo: number) {
	if (!room.battle || !rank) return;
	const userid = toID(username);
	const player = room.battle.players?.find((curPlayer: AnyObject) => curPlayer.id === userid || toID(curPlayer.name) === userid);
	if (!player?.slot) return;
	room.add(`|championsrank|${player.slot}|${rank.id}|${rank.name}|${Math.round(elo)}|${rank.placement || ''}`);
}

function rankIconHTML(rank: LadderRank | null) {
	if (!rank) return '';
	const title = Utils.escapeHTML(rank.name);
	const item = {
		champion: "King's Rock",
		masterball: 'Master Ball',
		ultraball: 'Ultra Ball',
		greatball: 'Great Ball',
		pokeball: 'Poke Ball',
		unranked: '',
	}[rank.id];
	if (!item) return '';
	return `<psicon item="${Utils.escapeHTML(item)}" class="rankicon rankicon-${rank.id}" title="${title}" aria-label="${title}"></psicon>`;
}

function rankIconSpanHTML(rank: LadderRank | null) {
	if (!rank) return '';
	const title = Utils.escapeHTML(rank.name);
	return `<span class="rankicon rankicon-${rank.id}" title="${title}" aria-label="${title}"></span>`;
}

function rankNameWithIconHTML(rank: LadderRank | null) {
	if (!rank) return 'Unranked';
	const division = rank.id === 'champion' ? '' : rank.name.split(' ').at(-1);
	return `${rankIconSpanHTML(rank)}${division ? ` ${Utils.escapeHTML(division)}` : ''}`;
}

function estimatedGXE(elo: number) {
	return Math.max(1, Math.min(99.9, 50 + (elo - 1000) / 18));
}

function estimatedGlicko(elo: number, games: number) {
	const rating = Math.round(elo + 170);
	const deviation = Math.max(25, Math.round(85 - Math.min(games, 80) * 0.75));
	return {rating, deviation};
}

function nextRankTarget(rank: LadderRank | null, total: number) {
	if (!rank || rank.id === 'champion' || !total) return null;
	const boundaries = [
		{name: 'Champion', elo: CHAMPIONS_RANK_THRESHOLDS.champion},
		{name: 'Master Ball I', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.champion - (CHAMPIONS_RANK_THRESHOLDS.champion - CHAMPIONS_RANK_THRESHOLDS.masterball) / 3)},
		{name: 'Master Ball II', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.champion - (CHAMPIONS_RANK_THRESHOLDS.champion - CHAMPIONS_RANK_THRESHOLDS.masterball) * 2 / 3)},
		{name: 'Master Ball III', elo: CHAMPIONS_RANK_THRESHOLDS.masterball},
		{name: 'Ultra Ball I', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.masterball - (CHAMPIONS_RANK_THRESHOLDS.masterball - CHAMPIONS_RANK_THRESHOLDS.ultraball) / 3)},
		{name: 'Ultra Ball II', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.masterball - (CHAMPIONS_RANK_THRESHOLDS.masterball - CHAMPIONS_RANK_THRESHOLDS.ultraball) * 2 / 3)},
		{name: 'Ultra Ball III', elo: CHAMPIONS_RANK_THRESHOLDS.ultraball},
		{name: 'Great Ball I', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.ultraball - (CHAMPIONS_RANK_THRESHOLDS.ultraball - CHAMPIONS_RANK_THRESHOLDS.greatball) / 3)},
		{name: 'Great Ball II', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.ultraball - (CHAMPIONS_RANK_THRESHOLDS.ultraball - CHAMPIONS_RANK_THRESHOLDS.greatball) * 2 / 3)},
		{name: 'Great Ball III', elo: CHAMPIONS_RANK_THRESHOLDS.greatball},
		{name: 'Poke Ball I', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.greatball - (CHAMPIONS_RANK_THRESHOLDS.greatball - CHAMPIONS_RANK_THRESHOLDS.pokeball) / 3)},
		{name: 'Poke Ball II', elo: Math.ceil(CHAMPIONS_RANK_THRESHOLDS.greatball - (CHAMPIONS_RANK_THRESHOLDS.greatball - CHAMPIONS_RANK_THRESHOLDS.pokeball) * 2 / 3)},
		{name: 'Poke Ball III', elo: CHAMPIONS_RANK_THRESHOLDS.pokeball},
	];
	const index = boundaries.findIndex(boundary => boundary.name === rank.name);
	if (index <= 0) return null;
	const target = boundaries[index - 1];
	return {name: target.name, elo: target.elo};
}

function nextRankDistance(ladder: LadderRow[], index: number, rank: LadderRank | null) {
	if (!rank || index < 0) return '';
	const rankedRows = ladder.filter(row => row[1] > 1000);
	const target = nextRankTarget(rank, rankedRows.length);
	if (!target) return `Already at the top rank.`;
	const row = ladder[index];
	if (target.name === 'Champion' && rank.id === 'masterball') {
		const placement = rankedRows.findIndex(curRow => curRow[0] === row[0]) + 1;
		if (placement > CHAMPIONS_MAX_CHAMPIONS) return `Reach top ${CHAMPIONS_MAX_CHAMPIONS} and ${target.elo} Elo for Champion.`;
	}
	const eloNeeded = Math.max(1, Math.ceil(target.elo - row[1]));
	return `~${eloNeeded} Elo from ${target.name}.`;
}

function championsRankDeltaHTML(name: string, oldElo: number, newElo: number, oldRank: LadderRank | null, newRank: LadderRank | null, ladder: LadderRow[], index: number) {
	const eloDelta = Math.round(newElo) - Math.round(oldElo);
	const signedDelta = `${eloDelta >= 0 ? '+' : ''}${eloDelta} Elo`;
	const deltaClass = eloDelta > 0 ? 'good' : eloDelta < 0 ? 'bad' : 'neutral';
	const oldName = oldRank?.name || 'Unranked';
	const newName = newRank?.name || 'Unranked';
	const transition = oldName === newName ?
		`<strong class="champions-rank-title">${rankNameWithIconHTML(newRank)}</strong>` :
		`${rankNameWithIconHTML(oldRank)} &rarr; <strong class="champions-rank-title">${rankNameWithIconHTML(newRank)}</strong>`;
	const progress = nextRankDistance(ladder, index, newRank);
	return `<div class="champions-rank-adjustment">` +
		`${Utils.escapeHTML(name)}'s Champions rank: ${transition} ` +
		`<small class="${deltaClass}">(${Utils.escapeHTML(signedDelta)})</small>` +
		(progress ? `<br /><small>${Utils.escapeHTML(progress)}</small>` : '') +
		`</div>`;
}

function defaultChampionsSeasonData(): ChampionsSeasonData {
	const startedAt = Date.now();
	return {
		current: {id: 'season-1', name: 'Season 1', startedAt},
		seasons: {
			'season-1': {id: 'season-1', name: 'Season 1', startedAt, snapshots: []},
		},
	};
}

export function loadChampionsSeasons(): ChampionsSeasonData {
	try {
		const data = JSON.parse(FS(CHAMPIONS_SEASONS_PATH).readIfExistsSync() || 'null');
		if (data?.current?.id && data.seasons?.[data.current.id]) return data;
	} catch {}
	return defaultChampionsSeasonData();
}

function saveChampionsSeasons(data: ChampionsSeasonData) {
	FS(CHAMPIONS_SEASONS_PATH).writeUpdate(() => JSON.stringify(data, null, 2));
}

function getRowRank(row: LadderRow, placement: number, total: number): LadderRank {
	if (row[1] <= 1000) return defaultRank(placement);
	return getLadderRankFromPlacement(placement, total, row[1]) || defaultRank(placement);
}

function championsRows(ladder: LadderRow[], limit = Infinity): ChampionsSeasonSnapshotRow[] {
	const rankedRows = ladder.filter(row => row[1] > 1000);
	const placementByUserid = new Map<string, number>();
	for (const [i, row] of rankedRows.entries()) placementByUserid.set(row[0], i + 1);
	const rows: ChampionsSeasonSnapshotRow[] = [];
	for (const row of rankedRows) {
		if (rows.length >= limit) break;
		const placement = placementByUserid.get(row[0]) || rows.length + 1;
		rows.push({
			userid: row[0],
			username: row[2],
			placement,
			rank: getRowRank(row, placement, rankedRows.length),
			elo: Math.round(row[1]),
			wins: row[3],
			losses: row[4],
			ties: row[5],
		});
	}
	return rows;
}

export async function startChampionsSeason(name?: string) {
	const data = loadChampionsSeasons();
	const nextNumber = Object.keys(data.seasons).length + 1;
	const id = `season-${nextNumber}`;
	const startedAt = Date.now();
	const seasonName = name?.trim() || `Season ${nextNumber}`;
	data.current = {id, name: seasonName, startedAt};
	data.seasons[id] = {id, name: seasonName, startedAt, snapshots: []};
	saveChampionsSeasons(data);
	return data.seasons[id];
}

export async function snapshotChampionsSeason() {
	const data = loadChampionsSeasons();
	const season = data.seasons[data.current.id] || (
		data.seasons[data.current.id] = {...data.current, snapshots: []}
	);
	const store = new LadderStore(CHAMPIONS_RANK_FORMAT);
	const ladder = await store.getLadder();
	const snapshot: ChampionsSeasonSnapshot = {
		id: `${season.id}-snapshot-${season.snapshots.length + 1}`,
		name: season.name,
		timestamp: Date.now(),
		rows: championsRows(ladder, 500),
	};
	season.snapshots.push(snapshot);
	saveChampionsSeasons(data);
	return snapshot;
}

export async function getChampionsProfile(userid: string) {
	const store = new LadderStore(CHAMPIONS_RANK_FORMAT);
	const ladder = await store.getLadder();
	const index = store.indexOfUser(userid);
	const data = loadChampionsSeasons();
	const season = data.seasons[data.current.id] || {...data.current, snapshots: []};
	if (index < 0) {
		const rank = unrankedRank();
		return {
			formatid: CHAMPIONS_RANK_FORMAT,
			rank: {id: rank.id, name: rank.name, placement: rank.placement, elo: 1000},
			record: {wins: 0, losses: 0, ties: 0},
			season: {id: season.id, name: season.name},
		};
	}
	const row = ladder[index];
	if (!row || row[3] + row[4] + row[5] <= 0) {
		const rank = row?.[1] && row[1] > 1000 ? null : unrankedRank();
		if (rank) {
			return {
				formatid: CHAMPIONS_RANK_FORMAT,
				rank: {id: rank.id, name: rank.name, placement: rank.placement, elo: Math.round(row?.[1] || 1000)},
				record: {wins: row?.[3] || 0, losses: row?.[4] || 0, ties: row?.[5] || 0},
				season: {id: season.id, name: season.name},
			};
		}
		return null;
	}
	const rankedRows = ladder.filter(curRow => curRow[1] > 1000);
	const placement = row[1] > 1000 ? rankedRows.findIndex(curRow => curRow[0] === row[0]) + 1 : index + 1;
	const rank = getRowRank(row, placement, rankedRows.length);
	let bestPlacement: number | undefined;
	let peakElo: number | undefined;
	for (const snapshot of season.snapshots) {
		const snapshotRow = snapshot.rows.find(curRow => curRow.userid === row[0]);
		if (!snapshotRow) continue;
		if (!bestPlacement || snapshotRow.placement < bestPlacement) bestPlacement = snapshotRow.placement;
		if (!peakElo || snapshotRow.elo > peakElo) peakElo = snapshotRow.elo;
	}
	return {
		formatid: CHAMPIONS_RANK_FORMAT,
		rank: {id: rank.id, name: rank.name, placement: rank.placement, elo: Math.round(row[1])},
		record: {wins: row[3], losses: row[4], ties: row[5]},
		season: {id: season.id, name: season.name, bestPlacement, peakElo},
	};
}

export class LadderStore {
	formatid: string;
	ladder: LadderRow[] | null;
	ladderPromise: Promise<LadderRow[]> | null;
	saving: boolean;
	static readonly formatsListPrefix = '|,LL';
	static readonly ladderCaches = ladderCaches;

	constructor(formatid: string) {
		this.formatid = formatid;
		this.ladder = null;
		this.ladderPromise = null;
		this.saving = false;
	}

	getLadder() {
		if (!this.ladderPromise) this.ladderPromise = this.load();
		return this.ladderPromise;
	}

	/**
	 * Internal function, returns a Promise for a ladder
	 */
	async load() {
		// ladderCaches[formatid]
		const cachedLadder = ladderCaches.get(this.formatid);
		if (cachedLadder) {
			if ((cachedLadder as Promise<LadderRow[]>).then) {
				const ladder = await cachedLadder;
				return (this.ladder = ladder);
			}
			return (this.ladder = cachedLadder as LadderRow[]);
		}
		try {
			const data = await FS('config/ladders/' + this.formatid + '.tsv').readIfExists();
			const ladder: LadderRow[] = [];
			for (const dataLine of data.split('\n').slice(1)) {
				const line = dataLine.trim();
				if (!line) continue;
				const row = line.split('\t');
				ladder.push([toID(row[1]), Number(row[0]), row[1], Number(row[2]), Number(row[3]), Number(row[4]), row[5]]);
			}
			// console.log('Ladders(' + this.formatid + ') loaded tsv: ' + JSON.stringify(this.ladder));
			ladderCaches.set(this.formatid, (this.ladder = ladder));
			return this.ladder;
		} catch {
			// console.log('Ladders(' + this.formatid + ') err loading tsv: ' + JSON.stringify(this.ladder));
		}
		ladderCaches.set(this.formatid, (this.ladder = []));
		return this.ladder;
	}

	/**
	 * Saves the ladder in config/ladders/[formatid].tsv
	 *
	 * Called automatically by updateRating, so you don't need to manually
	 * call this.
	 */
	async save() {
		if (this.saving) return;
		this.saving = true;
		const ladder = await this.getLadder();
		if (!ladder.length) {
			this.saving = false;
			return;
		}
		const stream = FS(`config/ladders/${this.formatid}.tsv`).createWriteStream();
		void stream.write('Elo\tUsername\tW\tL\tT\tLast update\r\n');
		for (const row of ladder) {
			void stream.write(row.slice(1).join('\t') + '\r\n');
		}
		void stream.writeEnd();
		this.saving = false;
	}

	/**
	 * Gets the index of a user in the ladder array.
	 *
	 * If createIfNeeded is true, the user will be created and added to
	 * the ladder array if it doesn't already exist.
	 */
	indexOfUser(username: string, createIfNeeded = false) {
		if (!this.ladder) throw new Error(`Must be called with ladder loaded`);
		const userid = toID(username);
		for (const [i, user] of this.ladder.entries()) {
			if (user[0] === userid) return i;
		}
		if (createIfNeeded) {
			const index = this.ladder.length;
			this.ladder.push([userid, 1000, username, 0, 0, 0, '']);
			return index;
		}
		return -1;
	}

	getRankAtIndex(index: number) {
		if (!this.ladder || index < 0) return null;
		if (this.ladder[index][1] <= 1000) return defaultRank(index + 1);
		const rankedRows = this.ladder.filter(row => row[1] > 1000);
		const placement = rankedRows.findIndex(row => row[0] === this.ladder![index][0]) + 1;
		return getLadderRankFromPlacement(placement, rankedRows.length, this.ladder[index][1]);
	}

	async getRank(username: string, createIfNeeded = false) {
		await this.getLadder();
		const index = this.indexOfUser(username, createIfNeeded);
		if (createIfNeeded) void this.save();
		return this.getRankAtIndex(index) || defaultRank();
	}

	async getRankPayload(username: string, createIfNeeded = false) {
		if (this.formatid !== CHAMPIONS_RANK_FORMAT) return '';
		await this.getLadder();
		const index = this.indexOfUser(username, createIfNeeded);
		if (createIfNeeded) void this.save();
		const row = index >= 0 ? this.ladder![index] : null;
		return rankPayload(this.getRankAtIndex(index) || defaultRank(), row?.[1] || 1000);
	}

	/**
	 * Returns [formatid, html], where html is an the HTML source of a
	 * ladder toplist, to be displayed directly in the ladder tab of the
	 * client.
	 */
	async getTop(prefix?: string) {
		const formatid = this.formatid;
		const name = Dex.formats.get(formatid).name;
		const ladder = await this.getLadder();
		const showChampionsRank = formatid === CHAMPIONS_RANK_FORMAT;
		if (showChampionsRank) return [formatid, this.getChampionsTopHTML(ladder, prefix)];
		let buf = `<h3>${name} Top ${prefix ? 'Search' : '500'}</h3>`;
		buf += `<table>`;
		buf += `<tr><th>` + [
			'', ...(showChampionsRank ? ['Rank'] : []), 'Username', '<abbr title="Elo rating">Elo</abbr>', 'W', 'L', 'T',
		].join(`</th><th>`) + `</th></tr>`;
		for (const [i, row] of ladder.entries()) {
			if (!prefix && i >= 500) break;
			if (prefix && !row[0].startsWith(prefix)) continue;
			const rank = this.getRankAtIndex(i);
			buf += `<tr><td>` + [
				i + 1,
				...(showChampionsRank ? [`${rankIconHTML(rank)} ${rank ? rank.name : ''}`] : []),
				Utils.escapeHTML(row[2]),
				`<strong>${Math.round(row[1])}</strong>`,
				row[3], row[4], row[5],
			].join(`</td><td>`) + `</td></tr>`;
		}
		return [formatid, buf];
	}

	getChampionsTopHTML(ladder: LadderRow[], prefix?: string) {
		const season = loadChampionsSeasons().seasons[loadChampionsSeasons().current.id] || loadChampionsSeasons().seasons['season-1'];
		const rows = championsRows(ladder);
		let buf = `<div class="champions-ladder">`;
		buf += `<h3>NatDex Champions OU Ladder</h3>`;
		buf += `<div class="champions-ladder-summary">`;
		buf += `<strong>${Utils.escapeHTML(season?.name || 'Season 1')}</strong>`;
		buf += `</div>`;
		if (prefix) {
			buf += `<p><small>Showing users matching <strong>${Utils.escapeHTML(prefix)}</strong>.</small></p>`;
		}
		buf += `<table><tr><th>` + [
			'Placement', 'Tier', 'Username', '<abbr title="Elo rating">Elo</abbr>',
			'<abbr title="Estimated local GXE for prototype display">GXE</abbr>',
			'<abbr title="Estimated local Glicko-1 rating for prototype display">Glicko-1</abbr>',
		].join(`</th><th>`) + `</th></tr>`;
		let shown = 0;
		for (const row of rows) {
			if (!prefix && shown >= 500) break;
			if (prefix && !row.userid.startsWith(prefix)) continue;
			const games = row.wins + row.losses + row.ties;
			const glicko = estimatedGlicko(row.elo, games);
			buf += `<tr><td>` + [
				row.placement,
				`${rankIconHTML(row.rank)} ${Utils.escapeHTML(row.rank.name)}`,
				Utils.escapeHTML(row.username),
				`<strong>${row.elo}</strong>`,
				`${estimatedGXE(row.elo).toFixed(1)}%`,
				`<em>${glicko.rating} <small>&plusmn; ${glicko.deviation}</small></em>`,
			].join(`</td><td>`) + `</td></tr>`;
			shown++;
		}
		if (!shown) buf += `<tr><td colspan="6"><em>No matching ranked users.</em></td></tr>`;
		buf += `</table></div>`;
		return buf;
	}

	/**
	 * Returns a Promise for the Elo rating of a user
	 */
	async getRating(userid: string) {
		const formatid = this.formatid;
		const user = Users.getExact(userid);
		if (user?.mmrCache[formatid]) {
			return user.mmrCache[formatid];
		}
		const ladder = await this.getLadder();
		const index = this.indexOfUser(userid);
		let rating = 1000;
		if (index >= 0) {
			rating = ladder[index][1];
		}
		if (user && user.id === userid) {
			user.mmrCache[formatid] = rating;
		}
		return rating;
	}

	/**
	 * Internal method. Update the Elo rating of a user.
	 */
	updateRow(row: LadderRow, score: number, foeElo: number) {
		let elo = row[1];

		elo = this.calculateElo(elo, score, foeElo);

		row[1] = elo;
		if (score > 0.6) {
			row[3]++; // win
		} else if (score < 0.4) {
			row[4]++; // loss
		} else {
			row[5]++; // tie
		}
		row[6] = `${new Date()}`;
	}

	/**
	 * Update the Elo rating for two players after a battle, and display
	 * the results in the passed room.
	 */
	async updateRating(p1name: string, p2name: string, p1score: number, room: AnyObject) {
		if (Ladders.disabled) {
			room.addRaw(`Ratings not updated. The ladders are currently disabled.`).update();
			return [p1score, null, null];
		}

		const formatid = this.formatid;
		let p2score = 1 - p1score;
		if (p1score < 0) {
			p1score = 0;
			p2score = 0;
		}
		const ladder = await this.getLadder();

		let p1newElo;
		let p2newElo;
		try {
			const p1index = this.indexOfUser(p1name, true);
			const p1elo = ladder[p1index][1];
			const p1oldRank = formatid === CHAMPIONS_RANK_FORMAT ? this.getRankAtIndex(p1index) : null;

			let p2index = this.indexOfUser(p2name, true);
			const p2elo = ladder[p2index][1];
			const p2oldRank = formatid === CHAMPIONS_RANK_FORMAT ? this.getRankAtIndex(p2index) : null;

			this.updateRow(ladder[p1index], p1score, p2elo);
			this.updateRow(ladder[p2index], p2score, p1elo);

			p1newElo = ladder[p1index][1];
			p2newElo = ladder[p2index][1];

			// console.log('L: ' + ladder.map(r => ''+Math.round(r[1])+' '+r[2]).join('\n'));

			// move p1 to its new location
			let newIndex = p1index;
			while (newIndex > 0 && ladder[newIndex - 1][1] <= p1newElo) newIndex--;
			while (newIndex === p1index || (ladder[newIndex] && ladder[newIndex][1] > p1newElo)) newIndex++;
			// console.log('ni='+newIndex+', p1i='+p1index);
			if (newIndex !== p1index && newIndex !== p1index + 1) {
				const row = ladder.splice(p1index, 1)[0];
				// adjust for removed row
				if (newIndex > p1index) newIndex--;
				if (p2index > p1index) p2index--;

				ladder.splice(newIndex, 0, row);
				// adjust for inserted row
				if (p2index >= newIndex) p2index++;
			}

			// move p2
			newIndex = p2index;
			while (newIndex > 0 && ladder[newIndex - 1][1] <= p2newElo) newIndex--;
			while (newIndex === p2index || (ladder[newIndex] && ladder[newIndex][1] > p2newElo)) newIndex++;
			// console.log('ni='+newIndex+', p2i='+p2index);
			if (newIndex !== p2index && newIndex !== p2index + 1) {
				const row = ladder.splice(p2index, 1)[0];
				// adjust for removed row
				if (newIndex > p2index) newIndex--;

				ladder.splice(newIndex, 0, row);
			}

			const p1 = Users.getExact(p1name);
			if (p1) p1.mmrCache[formatid] = +p1newElo;
			const p2 = Users.getExact(p2name);
			if (p2) p2.mmrCache[formatid] = +p2newElo;
			void this.save();
			const p1finalIndex = this.indexOfUser(p1name);
			const p2finalIndex = this.indexOfUser(p2name);
			const p1newRank = formatid === CHAMPIONS_RANK_FORMAT ? this.getRankAtIndex(p1finalIndex) : null;
			const p2newRank = formatid === CHAMPIONS_RANK_FORMAT ? this.getRankAtIndex(p2finalIndex) : null;

			if (!room.battle) {
				Monitor.warn(`room expired before ladder update was received`);
				return [p1score, null, null];
			}

			let reasons = `${Math.round(p1newElo) - Math.round(p1elo)} for ${p1score > 0.9 ? 'winning' : (p1score < 0.1 ? 'losing' : 'tying')}`;
			if (!reasons.startsWith('-')) reasons = '+' + reasons;
			room.addRaw(
				Utils.html`${p1name}'s rating: ${Math.round(p1elo)} &rarr; <strong>${Math.round(p1newElo)}</strong><br />(${reasons})`
			);

			reasons = `${Math.round(p2newElo) - Math.round(p2elo)} for ${p2score > 0.9 ? 'winning' : (p2score < 0.1 ? 'losing' : 'tying')}`;
			if (!reasons.startsWith('-')) reasons = '+' + reasons;
			room.addRaw(
				Utils.html`${p2name}'s rating: ${Math.round(p2elo)} &rarr; <strong>${Math.round(p2newElo)}</strong><br />(${reasons})`
			);
			if (formatid === CHAMPIONS_RANK_FORMAT) {
				room.addRaw(championsRankDeltaHTML(p1name, p1elo, p1newElo, p1oldRank, p1newRank, ladder, p1finalIndex));
				room.addRaw(championsRankDeltaHTML(p2name, p2elo, p2newElo, p2oldRank, p2newRank, ladder, p2finalIndex));
				addChampionsRankProtocol(room, p1name, p1newRank, p1newElo);
				addChampionsRankProtocol(room, p2name, p2newRank, p2newElo);
			}

			room.update();
		} catch (e: any) {
			if (!room.battle) return [p1score, null, null];
			room.addRaw(`There was an error calculating rating changes:`);
			room.add(e.stack);
			room.update();
		}

		return [p1score, p1newElo, p2newElo];
	}

	/**
	 * Returns a promise for a <tr> with all ratings for the current format.
	 */
	async visualize(username: string) {
		const ladder = await this.getLadder();

		const index = this.indexOfUser(username, false);

		if (index < 0) return '';

		const ratings = ladder[index];

		const output = `<tr><td>${this.formatid}</td><td><strong>${Math.round(ratings[1])}</strong></td>`;
		return `${output}<td>${ratings[3]}</td><td>${ratings[4]}</td><td>${ratings[3] + ratings[4]}</td></tr>`;
	}

	/**
	 * Calculates Elo based on a match result
	 */
	calculateElo(oldElo: number, score: number, foeElo: number): number {
		// The K factor determines how much your Elo changes when you win or
		// lose games. Larger K means more change.
		// In the "original" Elo, K is constant, but it's common for K to
		// get smaller as your rating goes up
		let K = 50;

		// dynamic K-scaling (optional)
		if (oldElo < 1200) {
			if (score < 0.5) {
				K = 10 + (oldElo - 1000) * 40 / 200;
			} else if (score > 0.5) {
				K = 90 - (oldElo - 1000) * 40 / 200;
			}
		} else if (oldElo > 1350 && oldElo <= 1600) {
			K = 40;
		} else {
			K = 32;
		}

		// main Elo formula
		const E = 1 / (1 + 10 ** ((foeElo - oldElo) / 400));

		const newElo = oldElo + K * (score - E);

		return Math.max(newElo, 1000);
	}

	/**
	 * Returns a Promise for an array of strings of <tr>s for ladder ratings of the user
	 */
	static visualizeAll(username: string) {
		const ratings = [];
		for (const format of Dex.formats.all()) {
			if (format.searchShow) {
				ratings.push(new LadderStore(format.id).visualize(username));
			}
		}
		return Promise.all(ratings);
	}
}
