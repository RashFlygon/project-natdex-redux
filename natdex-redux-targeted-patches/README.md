# NatDex Redux targeted fixes

This ZIP contains a safer targeted patch script for the current issues.

It changes:

- `deploy/caddy/Caddyfile.example`
  - Adds an `@officialRuntime` proxy block for:
    - `/data/graphics.js`
    - `/data/pokedex-mini.js`
    - `/data/pokedex-mini-bw.js`
    - `/js/clean-cookies.php`

- `server/data/mods/gen9natdexchampsclassic/scripts.ts`
  - Adds a local `actions.canTerastallize()` override.

- `server/data/mods/gen9natdexchampsmodern/scripts.ts`
  - Adds a local `actions.canTerastallize()` override.

This avoids proxying all of `/data/*` or `/js/*`, which could accidentally replace your custom NatDex Champions data with official Showdown data.

## Apply locally

From your repo root:

```powershell
cd "C:\Users\RashF\Documents\proj natdex\project-natdex"
node "C:\Users\RashF\Documents\proj natdex\project-natdex\natdex-redux-targeted-patches\apply-natdex-redux-targeted-fixes.mjs"
git diff
```

If the diff looks good:

```powershell
git add deploy/caddy/Caddyfile.example server/data/mods/gen9natdexchampsclassic/scripts.ts server/data/mods/gen9natdexchampsmodern/scripts.ts
git commit -m "Fix battle runtime assets and NatDex Champions tera"
git push
```

## Deploy on the VPS

```bash
ssh ubuntu@140.238.72.64
cd /opt/project-natdex
sudo -u showdown git pull
sudo -u showdown npm run build:server
sudo systemctl restart pokemon-showdown
```

Then update the real Caddy config:

```bash
sudo nano /etc/caddy/Caddyfile
```

Make sure this block is above the local `root * /opt/project-natdex/client/play.pokemonshowdown.com` handler:

```caddy
@officialRuntime path /data/graphics.js /data/pokedex-mini.js /data/pokedex-mini-bw.js /js/clean-cookies.php
handle @officialRuntime {
	reverse_proxy https://play.pokemonshowdown.com {
		header_up Host play.pokemonshowdown.com
	}
}
```

Reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Test URLs

These should load JS, not HTML or 404:

```text
https://play.champsnatdex.dynv6.net/data/graphics.js
https://play.champsnatdex.dynv6.net/data/pokedex-mini.js
https://play.champsnatdex.dynv6.net/data/pokedex-mini-bw.js
https://play.champsnatdex.dynv6.net/js/clean-cookies.php
```

These should load animated images:

```text
https://play.champsnatdex.dynv6.net/sprites/ani/gardevoir.gif
https://play.champsnatdex.dynv6.net/sprites/ani-back/garchomp.gif
```

For Tera, start a new battle after the server restart.
