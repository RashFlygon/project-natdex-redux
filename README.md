# Project NatDex

Project NatDex is a custom Pokemon Showdown deployment containing:

- `server/`: the Pokemon Showdown server with NatDex Champions formats and mods.
- `client/`: the Pokemon Showdown client with NatDex Champions teambuilder/search support.
- `deploy/`: deployment templates for a VPS-hosted setup.

## Local Development

Install/build the server:

```bash
cd server
npm install
npm run build
```

Build client data from this repo's server checkout:

```bash
cd ../client
npm install
node build-tools/build-indexes
```

In this monorepo, `build-tools/build-indexes` automatically prefers the sibling `../server` checkout. You can still override it explicitly with `PS_SERVER_PATH=/path/to/server`.

## Production Shape

Recommended public layout:

```text
https://play.example.com  -> static client files
https://sim.example.com   -> Pokemon Showdown server over HTTPS/WebSocket
```

Run the Showdown server as a non-root user behind nginx or Caddy. Expose only ports `80`, `443`, and restricted SSH.

## Login Server

Use the official Pokemon Showdown loginserver for the first production version. Do not enable development-only login bypasses on a public server.

Keep production `server/config/config.js`, usergroups, room config, logs, databases, SSL keys, and API tokens out of Git.
