import { FS } from '../lib';

export interface LadderBotConfig {
	enabled?: boolean;
	formats?: {
		[formatid: string]: {
			maxElo?: number;
			delaySeconds?: number;
			bots?: LadderBot[];
			externalBots?: ExternalLadderBot[];
		};
	};
}

export interface LadderBot {
	userid: ID;
	name: string;
	avatar?: string;
	rating?: number;
	teams: string[];
}

export interface ExternalLadderBot {
	userid: ID;
	name?: string;
	rating?: number;
}

export interface BattleBot {
	userid: ID;
	name: string;
	avatar: string;
	rating: number;
}

const CONFIG_PATH = 'config/champions/ladder-bots.json';
const DEFAULT_MAX_ELO = 1200;
const DEFAULT_DELAY_SECONDS = 20;

let cachedConfig: LadderBotConfig | null = null;

export function loadLadderBotConfig() {
	if (cachedConfig) return cachedConfig;
	try {
		cachedConfig = JSON.parse(FS(CONFIG_PATH).readIfExistsSync() || '{}');
	} catch {
		cachedConfig = {};
	}
	return cachedConfig!;
}

export function clearLadderBotConfigCache() {
	cachedConfig = null;
}

export function getLadderBotSettings(formatid: string) {
	const config = loadLadderBotConfig();
	if (!config.enabled) return null;
	const settings = config.formats?.[toID(formatid)];
	if (!settings?.bots?.length && !settings?.externalBots?.length) return null;
	return {
		maxElo: settings.maxElo || DEFAULT_MAX_ELO,
		delaySeconds: settings.delaySeconds ?? DEFAULT_DELAY_SECONDS,
		bots: (settings.bots || []).filter(bot => bot.userid && bot.name && bot.teams?.length),
		externalBots: (settings.externalBots || []).filter(bot => bot.userid),
	};
}

export function isExternalLadderBot(formatid: string, userid: string) {
	const settings = getLadderBotSettings(formatid);
	if (!settings) return false;
	const id = toID(userid);
	return settings.externalBots.some(bot => toID(bot.userid) === id);
}

export function getExternalLadderBotRating(formatid: string, userid: string) {
	const settings = getLadderBotSettings(formatid);
	if (!settings) return 1000;
	const id = toID(userid);
	return settings.externalBots.find(bot => toID(bot.userid) === id)?.rating || 1000;
}

export function pickLadderBot(formatid: string, rating: number): { bot: BattleBot, team: string } | null {
	const settings = getLadderBotSettings(formatid);
	if (!settings || rating >= settings.maxElo) return null;
	const availableBots = settings.bots.filter(bot => bot.teams.length);
	if (!availableBots.length) return null;
	const bot = availableBots[Math.floor(Math.random() * availableBots.length)];
	const team = bot.teams[Math.floor(Math.random() * bot.teams.length)];
	return {
		bot: {
			userid: toID(bot.userid),
			name: bot.name,
			avatar: bot.avatar || '101',
			rating: bot.rating || 1000,
		},
		team,
	};
}
