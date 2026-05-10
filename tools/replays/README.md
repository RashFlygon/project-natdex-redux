# Project NatDex Replays

This generates static replay pages from Pokemon Showdown battle logs.

## Requirements

- Python 3.10 or newer
- `pip install -r tools/replays/requirements.txt`

The VPS uses `/opt/project-natdex/.venv-replays` through the systemd service in
`deploy/systemd/project-natdex-replays.service.example`.
The Showdown config should set `exports.localreplays = true` so `/savereplay`
returns local `/replays/...` links instead of trying the official replay server.

## Usage

```bash
python3 tools/replays/generate_replays.py
```

By default, the script reads `server/logs`, writes to
`client/play.pokemonshowdown.com/replays`, includes only battles manually saved
with `/savereplay`, skips hidden/private battles, prunes stale generated pages,
and uses `https://play.champsnatdex.dynv6.net/js/replay-embed.js` for custom
replay data.
