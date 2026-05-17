/**
 * NatDex Champions tools.
 */

import {Utils} from '../../lib';
import {
	loadChampionsSeasons,
	snapshotChampionsSeason,
	startChampionsSeason,
} from '../ladders-local';

function formatDate(timestamp: number) {
	return new Date(timestamp).toLocaleString('en-GB', {timeZone: 'UTC', timeZoneName: 'short'});
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
			buf += `<code>/championsseason start [name]</code> starts a new season without resetting Elo.</p>`;
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
	},
	championsseasonhelp: [
		`/championsseason - Shows the current NatDex Champions OU season.`,
		`/championsseason snapshot - Archives current NatDex Champions OU standings. Requires: % @ # ~`,
		`/championsseason start [name] - Starts a new season without resetting Elo. Requires: % @ # ~`,
	],
};
