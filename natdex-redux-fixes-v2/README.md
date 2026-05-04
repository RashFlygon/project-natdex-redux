# NatDex Redux fixes v2

This version fixes the earlier patcher error by no longer depending on the exact NatDex Champions bans block.

Run from the repository root:

```powershell
cd "C:\Users\RashF\Documents\proj natdex\project-natdex"
node "C:\Users\RashF\Documents\proj natdex\project-natdex\natdex-redux-fixes-v2\apply-natdex-redux-fixes-v2.mjs"
git diff
```

The patcher:

1. Replaces `deploy/caddy/Caddyfile.example` with safer asset routing.
2. Adds `natDexChampionsDraftRuleRemovals` before `const AllFormats`.
3. Updates the four NatDex Champions Draft formats so Species Clause and evasion clauses are removed.

After committing/pulling on the VPS, make sure the generated client files exist:

```bash
cd /opt/project-natdex
sudo -u showdown npm run build:client:indexes
sudo -u showdown npm run build:client
sudo -u showdown npm run build:server
sudo systemctl restart pokemon-showdown
sudo systemctl reload caddy
```

Also copy the Caddy example into `/etc/caddy/Caddyfile` or manually apply the same changes there, then validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
