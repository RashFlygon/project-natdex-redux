/** @type {import('../play.pokemonshowdown.com/src/client-main').PSConfig} */
var Config = Config || {};

/* version */ Config.version = "0";

Config.bannedHosts = [];
Config.whitelist = ['wikipedia.org'];

// Copy this file to config/config.js on the VPS and replace these domains.
// This file is safe to commit; config/config.js is intentionally ignored.
Config.defaultserver = {
	id: 'projectnatdex',
	host: 'play.champsnatdex.dynv6.net',
	port: 443,
	httpport: 80,
	altport: 80,
	registered: true,
};

Config.roomsFirstOpenScript = function () {
};

Config.customcolors = {};
