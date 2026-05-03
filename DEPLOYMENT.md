# Oracle Cloud VPS Deployment

This guide assumes one Oracle Cloud Always Free Ubuntu VM running both the
Pokemon Showdown server and the static client.

## 1. DNS

Use two hostnames if possible:

- `play.example.com` for the static client
- `sim.example.com` for the Pokemon Showdown server/WebSocket endpoint

Point both DNS records to the Oracle VM public IPv4 address.

## 2. Oracle Firewall

In the Oracle Cloud console, allow inbound TCP traffic for:

- `22` from your own IP only, if possible
- `80` from anywhere
- `443` from anywhere

On the VM, also allow nginx through `ufw` if `ufw` is enabled:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Do not expose the Showdown server port directly to the internet. nginx should
proxy to `127.0.0.1:8000`.

## 3. System Packages

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Pokemon Showdown supports older Node versions, but Node 22 is a reasonable
current production choice.

## 4. Checkout

```bash
sudo useradd --system --create-home --shell /bin/bash showdown
sudo mkdir -p /opt/project-natdex
sudo chown showdown:showdown /opt/project-natdex
sudo -u showdown git clone https://github.com/RashFlygon/project-natdex-redux.git /opt/project-natdex
```

## 5. Private Server Config

Create the server config on the VPS only:

```bash
sudo -u showdown cp /opt/project-natdex/deploy/server/config.production.example.js /opt/project-natdex/server/config/config.js
sudo -u showdown nano /opt/project-natdex/server/config/config.js
```

Set:

- `exports.serverid`
- `exports.servername`
- `exports.serverdesc`

Keep the official login server settings unless you are intentionally running
your own login server. Do not enable `noguestsecurity` on a public server.

## 6. Private Client Config

```bash
cd /opt/project-natdex/client
sudo -u showdown cp config/config-example.js config/config.js
sudo -u showdown cp config/routes.example.json config/routes.json
sudo -u showdown nano config/config.js
sudo -u showdown nano config/routes.json
```

In `config/config.js`, set:

```js
Config.defaultserver = {
	id: 'projectnatdex',
	host: 'sim.example.com',
	port: 443,
	httpport: 8000,
	altport: 80,
	registered: true,
};
```

In `config/routes.json`, set `client` to the real client hostname.

These real config files are ignored by Git.

## 7. Build

```bash
cd /opt/project-natdex
sudo -u showdown npm run install:all
sudo -u showdown npm run build:server
sudo -u showdown npm run build:client:indexes
sudo -u showdown npm run build:client
```

`build:client:indexes` uses the sibling `server/` checkout, not a cached
upstream Showdown clone. This is required for NatDex Champions teambuilder data.

## 8. systemd

```bash
sudo cp /opt/project-natdex/deploy/systemd/pokemon-showdown.service.example /etc/systemd/system/pokemon-showdown.service
sudo systemctl daemon-reload
sudo systemctl enable --now pokemon-showdown
sudo systemctl status pokemon-showdown
```

Logs:

```bash
journalctl -u pokemon-showdown -f
```

## 9. nginx and HTTPS

Copy the nginx example:

```bash
sudo cp /opt/project-natdex/deploy/nginx/project-natdex.conf.example /etc/nginx/sites-available/project-natdex
sudo nano /etc/nginx/sites-available/project-natdex
sudo ln -s /etc/nginx/sites-available/project-natdex /etc/nginx/sites-enabled/project-natdex
sudo nginx -t
sudo systemctl reload nginx
```

Replace `play.example.com` and `sim.example.com` before enabling HTTPS.

Then request certificates:

```bash
sudo certbot --nginx -d play.example.com -d sim.example.com
```

## 10. Updating The VPS

```bash
cd /opt/project-natdex
sudo -u showdown git pull
sudo -u showdown npm run build:server
sudo -u showdown npm run build:client:indexes
sudo -u showdown npm run build:client
sudo systemctl restart pokemon-showdown
sudo systemctl reload nginx
```

## Security Notes

- Never commit `server/config/config.js`.
- Never commit `server/config/usergroups.csv`.
- Never commit logs, databases, `.env`, TLS keys, dynv6 tokens, or browser
  profile directories.
- Use the official login server first. Running your own login server is a
  separate security-sensitive project.
- Keep SSH restricted and use key-based login where possible.
