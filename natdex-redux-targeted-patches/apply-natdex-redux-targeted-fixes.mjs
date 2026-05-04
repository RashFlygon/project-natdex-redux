#!/usr/bin/env node
/**
 * Targeted NatDex Redux fixes:
 * 1) Adds a safe official-runtime proxy block to deploy/caddy/Caddyfile.example.
 * 2) Adds a local NatDex Champions Tera override to classic/modern mod scripts.
 *
 * Run from the repository root:
 *   node apply-natdex-redux-targeted-fixes.mjs
 *
 * Idempotent: re-running should not duplicate patches.
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const CADDY_PATH = path.join(repoRoot, 'deploy', 'caddy', 'Caddyfile.example');
const CLASSIC_SCRIPTS_PATH = path.join(repoRoot, 'server', 'data', 'mods', 'gen9natdexchampsclassic', 'scripts.ts');
const MODERN_SCRIPTS_PATH = path.join(repoRoot, 'server', 'data', 'mods', 'gen9natdexchampsmodern', 'scripts.ts');

const OFFICIAL_RUNTIME_PATHS = [
	'/data/graphics.js',
	'/data/pokedex-mini.js',
	'/data/pokedex-mini-bw.js',
	'/js/clean-cookies.php',
];

const TERA_ACTIONS_BLOCK = `\tactions: {
\t\tcanTerastallize(pokemon) {
\t\t\treturn pokemon.canTerastallize || null;
\t\t},
\t},`;

function rel(filePath) {
	return path.relative(repoRoot, filePath);
}

function assertFile(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`Missing expected file: ${rel(filePath)}`);
	}
}

function writeIfChanged(filePath, next) {
	const current = fs.readFileSync(filePath, 'utf8');
	if (current === next) {
		console.log(`OK     ${rel(filePath)} (already up to date)`);
		return false;
	}
	fs.writeFileSync(filePath, next);
	console.log(`PATCH  ${rel(filePath)}`);
	return true;
}

function ensureOfficialRuntimeCaddyBlock(filePath) {
	assertFile(filePath);
	let text = fs.readFileSync(filePath, 'utf8');

	const desiredPathLine = `@officialRuntime path ${OFFICIAL_RUNTIME_PATHS.join(' ')}`;

	// If the matcher already exists, update just that line.
	if (/^\s*@officialRuntime\s+path\s+/m.test(text)) {
		text = text.replace(/^\s*@officialRuntime\s+path\s+[^\n\r]*/m, match => {
			const indent = match.match(/^\s*/)?.[0] || '';
			return indent + desiredPathLine;
		});

		if (!/handle\s+@officialRuntime\s*\{/.test(text)) {
			text = text.replace(
				new RegExp(`^(\\s*)${desiredPathLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'),
				(_, indent) => `${indent}${desiredPathLine}
${indent}handle @officialRuntime {
${indent}\treverse_proxy https://play.pokemonshowdown.com {
${indent}\t\theader_up Host play.pokemonshowdown.com
${indent}\t}
${indent}}`
			);
		}

		writeIfChanged(filePath, text);
		return;
	}

	const block = `
\t@officialRuntime path ${OFFICIAL_RUNTIME_PATHS.join(' ')}
\thandle @officialRuntime {
\t\treverse_proxy https://play.pokemonshowdown.com {
\t\t\theader_up Host play.pokemonshowdown.com
\t\t}
\t}
`;

	// Insert after an existing /fx/* handle, otherwise after @officialAssets, otherwise before root/fallback.
	const fxBlockRegex = /\n\s*handle\s+\/fx\/\*\s*\{\s*\n\s*reverse_proxy\s+https:\/\/play\.pokemonshowdown\.com\s*\{\s*\n\s*header_up\s+Host\s+play\.pokemonshowdown\.com\s*\n\s*\}\s*\n\s*\}\s*/m;
	const officialAssetsBlockRegex = /\n\s*@officialAssets\s+path[^\n]*\n\s*handle\s+@officialAssets\s*\{\s*\n\s*reverse_proxy\s+https:\/\/play\.pokemonshowdown\.com\s*\{\s*\n\s*header_up\s+Host\s+play\.pokemonshowdown\.com\s*\n\s*\}\s*\n\s*\}\s*/m;
	const officialPhpRegex = /\n\s*@officialPhp\s+path\b/m;
	const rootRegex = /\n\s*root\s+\*\s+/m;
	const handleFallbackRegex = /\n\s*handle\s*\{\s*\n\s*root\s+\*/m;

	if (officialAssetsBlockRegex.test(text)) {
		text = text.replace(officialAssetsBlockRegex, match => match.trimEnd() + block + '\n');
	} else if (fxBlockRegex.test(text)) {
		text = text.replace(fxBlockRegex, match => match.trimEnd() + block + '\n');
	} else if (officialPhpRegex.test(text)) {
		text = text.replace(officialPhpRegex, block + '\n$&');
	} else if (rootRegex.test(text)) {
		text = text.replace(rootRegex, block + '\n$&');
	} else if (handleFallbackRegex.test(text)) {
		text = text.replace(handleFallbackRegex, block + '\n$&');
	} else {
		throw new Error(`Could not find a safe Caddy insertion point in ${rel(filePath)}`);
	}

	writeIfChanged(filePath, text);
}

function findMatchingBrace(text, openIndex) {
	let depth = 0;
	let state = 'code';
	let quote = '';

	for (let i = openIndex; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];

		if (state === 'lineComment') {
			if (ch === '\n') state = 'code';
			continue;
		}
		if (state === 'blockComment') {
			if (ch === '*' && next === '/') {
				state = 'code';
				i++;
			}
			continue;
		}
		if (state === 'string') {
			if (ch === '\\') {
				i++;
				continue;
			}
			if (ch === quote) state = 'code';
			continue;
		}
		if (state === 'template') {
			if (ch === '\\') {
				i++;
				continue;
			}
			if (ch === '`') state = 'code';
			// Conservative: ignore braces inside template text.
			continue;
		}

		if (ch === '/' && next === '/') {
			state = 'lineComment';
			i++;
			continue;
		}
		if (ch === '/' && next === '*') {
			state = 'blockComment';
			i++;
			continue;
		}
		if (ch === '"' || ch === "'") {
			state = 'string';
			quote = ch;
			continue;
		}
		if (ch === '`') {
			state = 'template';
			continue;
		}
		if (ch === '{') depth++;
		if (ch === '}') {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function getScriptsObjectRange(text) {
	const exportIndex = text.indexOf('export const Scripts');
	if (exportIndex === -1) throw new Error('Could not find "export const Scripts"');
	const openIndex = text.indexOf('{', exportIndex);
	if (openIndex === -1) throw new Error('Could not find opening brace for Scripts object');
	const closeIndex = findMatchingBrace(text, openIndex);
	if (closeIndex === -1) throw new Error('Could not find closing brace for Scripts object');
	return { openIndex, closeIndex };
}

function ensureTeraActionsOverride(filePath) {
	assertFile(filePath);
	let text = fs.readFileSync(filePath, 'utf8');

	const { openIndex, closeIndex } = getScriptsObjectRange(text);
	const body = text.slice(openIndex + 1, closeIndex);

	if (/canTerastallize\s*\(\s*pokemon\s*\)/.test(body)) {
		console.log(`OK     ${rel(filePath)} (canTerastallize already present)`);
		return;
	}

	let prefix = text.slice(0, closeIndex);
	const suffix = text.slice(closeIndex);

	// Ensure the previous property ends with a comma before inserting the new property.
	const trimmedPrefix = prefix.replace(/\s+$/g, '');
	prefix = (trimmedPrefix.endsWith(',') ? trimmedPrefix : trimmedPrefix + ',') + '\n';

	const next = prefix + TERA_ACTIONS_BLOCK + '\n' + suffix;
	writeIfChanged(filePath, next);
}

function main() {
	console.log(`Repo root: ${repoRoot}`);
	ensureOfficialRuntimeCaddyBlock(CADDY_PATH);
	ensureTeraActionsOverride(CLASSIC_SCRIPTS_PATH);
	ensureTeraActionsOverride(MODERN_SCRIPTS_PATH);

	console.log('\nDone.');
	console.log('\nNext steps:');
	console.log('  1. Review with: git diff');
	console.log('  2. Commit/push changes.');
	console.log('  3. On VPS: git pull && sudo -u showdown npm run build:server && sudo systemctl restart pokemon-showdown');
	console.log('  4. Update /etc/caddy/Caddyfile with the same @officialRuntime block.');
	console.log('  5. Reload Caddy: sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy');
}

try {
	main();
} catch (err) {
	console.error('\nERROR:', err instanceof Error ? err.message : err);
	process.exit(1);
}
