(function () {
	'use strict';

	var rows = [];
	var formatFilter = document.getElementById('format-filter');
	var playerFilter = document.getElementById('player-filter');
	var pokemonFilter = document.getElementById('pokemon-filter');
	var textFilter = document.getElementById('text-filter');
	var replayRows = document.getElementById('replay-rows');
	var replayCount = document.getElementById('replay-count');
	var emptyState = document.getElementById('empty-state');
	var refreshButton = document.getElementById('refresh');

	function parseCSV(text) {
		var records = [];
		var field = '';
		var row = [];
		var quote = false;
		for (var i = 0; i < text.length; i++) {
			var c = text.charAt(i);
			var next = text.charAt(i + 1);
			if (quote && c === '"' && next === '"') {
				field += '"';
				i++;
			} else if (c === '"') {
				quote = !quote;
			} else if (!quote && c === ',') {
				row.push(field);
				field = '';
			} else if (!quote && (c === '\n' || c === '\r')) {
				if (c === '\r' && next === '\n') i++;
				row.push(field);
				field = '';
				if (row.length > 1 || row[0]) records.push(row);
				row = [];
			} else {
				field += c;
			}
		}
		if (field || row.length) {
			row.push(field);
			records.push(row);
		}
		return records;
	}

	function normalize(value) {
		return String(value || '').toLowerCase();
	}

	function escapeHTML(value) {
		return String(value || '').replace(/[&<>"']/g, function (c) {
			return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
		});
	}

	function rowFromRecord(header, record) {
		var out = {};
		for (var i = 0; i < header.length; i++) out[header[i]] = record[i] || '';
		return out;
	}

	function loadRows() {
		replayCount.textContent = 'Loading replays...';
		return fetch('/replays/data.csv', {cache: 'no-store'}).then(function (response) {
			if (!response.ok) return '';
			return response.text();
		}).then(function (text) {
			var records = parseCSV(text);
			if (!records.length) {
				rows = [];
				render();
				return;
			}
			var header = records.shift();
			rows = records.map(function (record) {
				return rowFromRecord(header, record);
			}).filter(function (row) {
				return row.link;
			});
			rows.sort(function (a, b) {
				return normalize(b.date).localeCompare(normalize(a.date));
			});
			updateFormatOptions();
			render();
		}).catch(function () {
			rows = [];
			render();
		});
	}

	function updateFormatOptions() {
		var current = formatFilter.value;
		var formats = {};
		rows.forEach(function (row) {
			if (row.tier) formats[row.tier] = true;
		});
		formatFilter.innerHTML = '<option value="">All formats</option>' + Object.keys(formats).sort().map(function (tier) {
			return '<option value="' + escapeHTML(tier) + '">' + escapeHTML(tier) + '</option>';
		}).join('');
		formatFilter.value = current;
	}

	function filteredRows() {
		var format = normalize(formatFilter.value);
		var player = normalize(playerFilter.value);
		var pokemon = normalize(pokemonFilter.value);
		var text = normalize(textFilter.value);
		return rows.filter(function (row) {
			var teams = normalize(row.team1 + ' ' + row.team2);
			var players = normalize(row.p1 + ' ' + row.p2 + ' ' + row.winner);
			var haystack = normalize([
				row.tier, row.p1, row.p2, row.winner, row.score, row.date, row.turns, row.link, teams,
			].join(' '));
			return (!format || normalize(row.tier) === format) &&
				(!player || players.indexOf(player) >= 0) &&
				(!pokemon || teams.indexOf(pokemon) >= 0) &&
				(!text || haystack.indexOf(text) >= 0);
		});
	}

	function render() {
		var visible = filteredRows();
		replayRows.innerHTML = visible.map(function (row) {
			var team1 = row.team1 ? '<span class="team">' + escapeHTML(row.team1.replace(/\//g, ' / ')) + '</span>' : '';
			var team2 = row.team2 ? '<span class="team">' + escapeHTML(row.team2.replace(/\//g, ' / ')) + '</span>' : '';
			return '<tr>' +
				'<td>' + escapeHTML(row.date) + '</td>' +
				'<td>' + escapeHTML(row.tier) + '</td>' +
				'<td>' + escapeHTML(row.winner || row.p1) + '</td>' +
				'<td>' + escapeHTML(row.score) + '</td>' +
				'<td>' + escapeHTML(row.p2) + '</td>' +
				'<td>' + team1 + team2 + '</td>' +
				'<td><a class="replay-link" href="' + escapeHTML(row.link) + '">Open</a></td>' +
			'</tr>';
		}).join('');
		replayCount.textContent = visible.length + ' of ' + rows.length + ' public replays';
		emptyState.hidden = !!visible.length;
	}

	[formatFilter, playerFilter, pokemonFilter, textFilter].forEach(function (input) {
		input.addEventListener('input', render);
		input.addEventListener('change', render);
	});
	refreshButton.addEventListener('click', loadRows);
	loadRows();
}());
