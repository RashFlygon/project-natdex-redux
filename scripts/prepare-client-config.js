"use strict";

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configDir = path.join(root, 'client', 'config');

const copies = [
	['config-example.js', 'config.js'],
	['routes.example.json', 'routes.json'],
];

for (const [source, target] of copies) {
	const sourcePath = path.join(configDir, source);
	const targetPath = path.join(configDir, target);
	if (fs.existsSync(targetPath)) continue;
	fs.copyFileSync(sourcePath, targetPath);
	console.log(`Created client/config/${target} from ${source}`);
}
