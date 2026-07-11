/**
 * Local NatDex Champions tools.
 */

import {
	FS,
	Utils,
} from '../../lib';
import {
	CHAMPIONS_RANK_FORMAT,
	clearLocalLadderCache,
	getLadderRankFromPlacement,
	loadChampionsSeasons,
	snapshotChampionsSeason,
	startChampionsSeason,
} from '../ladders-local';

type LadderEditRow = {
	userid: ID,
	elo: number,
	username: string,
	wins: number,
	losses: number,
	ties: number,
	lastUpdate: string,
};

const CHAMPIONS_LADDER_PATH = `config/ladders/${CHAMPIONS_RANK_FORMAT}.tsv`;
const CHAMPIONS_LADDER_RESET_BACKUP_DIR = 'config/champions/ladder-backups';

const RANK_TEST_TARGETS: {[alias: string]: {name: string, percentile: number, defaultElo?: number}} = {
	champion: {name: 'Champion', percentile: 0.005, defaultElo: 2000},
	champ: {name: 'Champion', percentile: 0.005, defaultElo: 2000},
	masterballi: {name: 'Master Ball I', percentile: 0.025, defaultElo: 1317},
	masterball1: {name: 'Master Ball I', percentile: 0.025, defaultElo: 1317},
	masteri: {name: 'Master Ball I', percentile: 0.025, defaultElo: 1317},
	mbi: {name: 'Master Ball I', percentile: 0.025, defaultElo: 1317},
	masterballii: {name: 'Master Ball II', percentile: 0.055, defaultElo: 1284},
	masterball2: {name: 'Master Ball II', percentile: 0.055, defaultElo: 1284},
	masterii: {name: 'Master Ball II', percentile: 0.055, defaultElo: 1284},
	mbii: {name: 'Master Ball II', percentile: 0.055, defaultElo: 1284},
	masterballiii: {name: 'Master Ball III', percentile: 0.09, defaultElo: 1250},
	masterball3: {name: 'Master Ball III', percentile: 0.09, defaultElo: 1250},
	masteriii: {name: 'Master Ball III', percentile: 0.09, defaultElo: 1250},
	mbiii: {name: 'Master Ball III', percentile: 0.09, defaultElo: 1250},
	ultraballi: {name: 'Ultra Ball I', percentile: 0.125, defaultElo: 1234},
	ultraball1: {name: 'Ultra Ball I', percentile: 0.125, defaultElo: 1234},
	ultrai: {name: 'Ultra Ball I', percentile: 0.125, defaultElo: 1234},
	ubi: {name: 'Ultra Ball I', percentile: 0.125, defaultElo: 1234},
	ultraballii: {name: 'Ultra Ball II', percentile: 0.175, defaultElo: 1217},
	ultraball2: {name: 'Ultra Ball II', percentile: 0.175, defaultElo: 1217},
	ultraii: {name: 'Ultra Ball II', percentile: 0.175, defaultElo: 1217},
	ubii: {name: 'Ultra Ball II', percentile: 0.175, defaultElo: 1217},
	ultraballiii: {name: 'Ultra Ball III', percentile: 0.23, defaultElo: 1200},
	ultraball3: {name: 'Ultra Ball III', percentile: 0.23, defaultElo: 1200},
	ultraiii: {name: 'Ultra Ball III', percentile: 0.23, defaultElo: 1200},
	ubiii: {name: 'Ultra Ball III', percentile: 0.23, defaultElo: 1200},
	greatballi: {name: 'Great Ball I', percentile: 0.30, defaultElo: 1167},
	greatball1: {name: 'Great Ball I', percentile: 0.30, defaultElo: 1167},
	gbi: {name: 'Great Ball I', percentile: 0.30, defaultElo: 1167},
	greatballii: {name: 'Great Ball II', percentile: 0.39, defaultElo: 1134},
	greatball2: {name: 'Great Ball II', percentile: 0.39, defaultElo: 1134},
	gbii: {name: 'Great Ball II', percentile: 0.39, defaultElo: 1134},
	greatballiii: {name: 'Great Ball III', percentile: 0.48, defaultElo: 1100},
	greatball3: {name: 'Great Ball III', percentile: 0.48, defaultElo: 1100},
	gbiii: {name: 'Great Ball III', percentile: 0.48, defaultElo: 1100},
	pokeballi: {name: 'Poke Ball I', percentile: 0.60, defaultElo: 1067},
	pokeball1: {name: 'Poke Ball I', percentile: 0.60, defaultElo: 1067},
	pbi: {name: 'Poke Ball I', percentile: 0.60, defaultElo: 1067},
	pokeballii: {name: 'Poke Ball II', percentile: 0.75, defaultElo: 1034},
	pokeball2: {name: 'Poke Ball II', percentile: 0.75, defaultElo: 1034},
	pbii: {name: 'Poke Ball II', percentile: 0.75, defaultElo: 1034},
	pokeballiii: {name: 'Poke Ball III', percentile: 0.92, defaultElo: 1001},
	pokeball3: {name: 'Poke Ball III', percentile: 0.92, defaultElo: 1001},
	pbiii: {name: 'Poke Ball III', percentile: 0.92, defaultElo: 1001},
};

function formatDate(timestamp: number) {
	return new Date(timestamp).toLocaleString('en-GB', {timeZone: 'UTC', timeZoneName: 'short'});
}

function parseLadderRows() {
	const data = FS(CHAMPIONS_LADDER_PATH).readIfExistsSync();
	const rows: LadderEditRow[] = [];
	for (const line of data.split('\n').slice(1)) {
		if (!line.trim()) continue;
		const [elo, username, wins, losses, ties, lastUpdate] = line.trim().split('\t');
		const userid = toID(username);
		if (!userid) continue;
		rows.push({
			userid,
			elo: Number(elo) || 1000,
			username,
			wins: Number(wins) || 0,
			losses: Number(losses) || 0,
			ties: Number(ties) || 0,
			lastUpdate: lastUpdate || '',
		});
	}
	return rows;
}

function writeLadderRows(rows: LadderEditRow[]) {
	rows.sort((a, b) => b.elo - a.elo || a.username.localeCompare(b.username));
	const data = [
		'Elo\tUsername\tW\tL\tT\tLast update',
		...rows.map(row => [
			row.elo,
			row.username,
			row.wins,
			row.losses,
			row.ties,
			row.lastUpdate,
		].join('\t')),
	].join('\r\n') + '\r\n';
	FS(CHAMPIONS_LADDER_PATH).writeSync(data);
	clearLocalLadderCache(CHAMPIONS_RANK_FORMAT);
}

function backupLadderRows(label: string) {
	const safeLabel = toID(label) || 'season';
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupPath = `${CHAMPIONS_LADDER_RESET_BACKUP_DIR}/${CHAMPIONS_RANK_FORMAT}-${safeLabel}-${timestamp}.tsv`;
	FS(backupPath).parentDir().mkdirpSync();
	FS(backupPath).writeSync(FS(CHAMPIONS_LADDER_PATH).readIfExistsSync());
	return backupPath;
}

function resetLadderRows(rows: LadderEditRow[]) {
	return rows.map(row => ({
		...row,
		elo: 1000,
		wins: 0,
		losses: 0,
		ties: 0,
		lastUpdate: '',
	}));
}

function estimateEloForPlacement(rows: LadderEditRow[], placement: number, fallbackElo: number) {
	const rankedRows = rows.filter(row => row.elo > 1000).sort((a, b) => b.elo - a.elo);
	const index = Math.max(0, placement - 1);
	if (!rankedRows.length) return fallbackElo;
	if (index === 0) return Math.max(fallbackElo, Math.ceil(rankedRows[0].elo + 50));
	const previous = rankedRows[index - 1];
	const next = rankedRows[index];
	if (!next) return Math.max(1001, Math.min(fallbackElo, Math.floor(previous.elo - 1)));
	if (previous.elo === next.elo) return Math.max(1001, next.elo + 0.5);
	return Math.max(1001, (previous.elo + next.elo) / 2);
}

export const commands: Chat.ChatCommands = {
	championsseason: {
		async ''() {
			const data = loadChampionsSeasons();
			const season = data.seasons[data.current.id];
			const latest = season.snapshots[season.snapshots.length - 1];
			let buf = `<h2>NatDex Champions OU Season</h2>`;
			buf += `<p><strong>${Utils.escapeHTML(season.name)}</strong><br />Started: ${formatDate(season.startedAt)}</p>`;
			if (latest) {
				buf += `<p>Latest snapshot: ${formatDate(latest.timestamp)} (${latest.rows.length} ranked users)</p>`;
			} else {
				buf += `<p><em>No snapshots have been taken yet.</em></p>`;
			}
			buf += `<p><code>/championsseason snapshot</code> archives the current OU standings.<br />`;
			buf += `<code>/championsseason start [name]</code> starts a new season without resetting Elo.<br />`;
			buf += `<code>/championsseason resetelo [name]</code> backs up the ladder, starts a new season, and resets Elo.</p>`;
			this.sendReplyBox(buf);
		},
		async snapshot(target, room, user) {
			this.checkCan('lock');
			const snapshot = await snapshotChampionsSeason();
			this.sendReplyBox(
				`Snapshot saved for <strong>${Utils.escapeHTML(snapshot.name)}</strong>: ` +
				`${snapshot.rows.length} ranked users at ${formatDate(snapshot.timestamp)}.`
			);
			this.addModAction(`${user.name} saved a NatDex Champions OU season snapshot.`);
		},
		async start(target, room, user) {
			this.checkCan('lock');
			const season = await startChampionsSeason(target);
			this.sendReplyBox(
				`Started <strong>${Utils.escapeHTML(season.name)}</strong> without resetting ladder Elo.`
			);
			this.addModAction(`${user.name} started NatDex Champions OU ${season.name}.`);
		},
		async resetelo(target, room, user) {
			this.checkCan('lockdown');
			const rows = parseLadderRows();
			const backupPath = backupLadderRows(target || 'new-season');
			const season = await startChampionsSeason(target);
			writeLadderRows(resetLadderRows(rows));
			this.sendReplyBox(
				`Started <strong>${Utils.escapeHTML(season.name)}</strong> and reset ` +
				`<strong>${rows.length}</strong> NatDex Champions OU ladder row(s) to 1000 Elo / 0 games.<br />` +
				`Backup written to <code>${Utils.escapeHTML(backupPath)}</code>.`
			);
			this.addModAction(
				`${user.name} started NatDex Champions OU ${season.name} and reset ladder Elo after backing up ${rows.length} row(s).`
			);
		},
	},
	championsseasonhelp: [
		`/championsseason - Shows the current NatDex Champions OU season.`,
		`/championsseason snapshot - Archives current NatDex Champions OU standings. Requires: % @ # ~`,
		`/championsseason start [name] - Starts a new season without resetting Elo. Requires: % @ # ~`,
		`/championsseason resetelo [name] - Backs up the NatDex Champions OU ladder, starts a new season, and resets all rows to 1000 Elo / 0 games. Requires: lockdown permission`,
	],
	championsranktest: {
		championsrank: 'championsranktest',
		async ''(target, room, user) {
			this.checkCan('lock');
			if (!Config.localranktest) {
				return this.errorReply(`This local rank testing command is disabled on this server.`);
			}
			const [username, rankName, eloText] = target.split(',').map(part => part.trim());
			if (!username || !rankName) return this.parse('/help championsranktest');
			const rankTarget = RANK_TEST_TARGETS[toID(rankName)];
			if (!rankTarget) {
				return this.errorReply(
					`Unknown rank "${rankName}". Try champion, masterballi, masterballii, ultraballiii, greatballii, or pokeballiii.`
				);
			}
			const userid = toID(username);
			if (!userid) return this.errorReply(`Invalid username.`);
			const rows = parseLadderRows().filter(row => row.userid !== userid);
			const totalRanked = Math.max(1, rows.filter(row => row.elo > 1000).length + 1);
			const placement = Math.max(1, Math.min(totalRanked, Math.round(totalRanked * rankTarget.percentile)));
			const suppliedElo = eloText ? Number(eloText) : NaN;
			const elo = Number.isFinite(suppliedElo) && suppliedElo > 1000 ?
				suppliedElo :
				estimateEloForPlacement(rows, placement, rankTarget.defaultElo || 1001);
			const existing = parseLadderRows().find(row => row.userid === userid);
			rows.push({
				userid,
				elo,
				username,
				wins: existing?.wins || 120,
				losses: existing?.losses || 10,
				ties: existing?.ties || 0,
				lastUpdate: `${new Date()}`,
			});
			writeLadderRows(rows);

			const sortedRows = parseLadderRows();
			const rankedRows = sortedRows.filter(row => row.elo > 1000);
			const newPlacement = rankedRows.findIndex(row => row.userid === userid) + 1;
			const rank = getLadderRankFromPlacement(newPlacement, rankedRows.length, elo);
			this.sendReplyBox(
				`Set <strong>${Utils.escapeHTML(username)}</strong> to ` +
				`<strong>${Utils.escapeHTML(rank?.name || rankTarget.name)}</strong> ` +
				`at <strong>${Math.round(elo)}</strong> Elo. ` +
				`Current placement: <strong>#${newPlacement}</strong>.`
			);
			this.addModAction(`${user.name} locally set ${username}'s NatDex Champions OU test rank to ${rank?.name || rankTarget.name}.`);
		},
	},
	championsranktesthelp: [
		`/championsranktest [user], [rank], [optional Elo] - Locally edits the NatDex Champions OU ladder row for trailer testing. Requires: % @ # ~`,
		`Ranks: champion, masterballi, masterballii, masterballiii, ultraballi, ultraballii, ultraballiii, greatballi, greatballii, greatballiii, pokeballi, pokeballii, pokeballiii.`,
		`Example: /championsranktest ur cutiefly, champion`,
		`This command only works when Config.localranktest is enabled.`,
	],
};
