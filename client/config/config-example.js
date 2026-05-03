/** @type {import('../play.pokemonshowdown.com/src/client-main').PSConfig} */
var Config = Config || {};

/* version */ Config.version = "0";

Config.bannedHosts = [];
Config.whitelist = ['wikipedia.org'];

// Copy this file to config/config.js on the VPS and replace these domains.
// This file is safe to commit; config/config.js is intentionally ignored.
Config.defaultserver = {
	id: 'projectnatdex',
	host: 'sim.example.com',
	port: 443,
	httpport: 8000,
	altport: 80,
	registered: true,
};

Config.roomsFirstOpenScript = function () {
};

Config.customcolors = {};
