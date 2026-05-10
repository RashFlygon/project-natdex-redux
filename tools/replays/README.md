# Project NatDex Replays

This generates static replay pages from Pokemon Showdown battle logs.

## Requirements

- Python 3.10 or newer
- `pip install -r tools/replays/requirements.txt`

The VPS uses `/opt/project-natdex/.venv-replays` through the systemd service in
`deploy/systemd/project-natdex-replays.service.example`.

## Usage

```bash
python3 tools/replays/generate_replays.py
```

By default, the script reads `server/logs`, writes to
`client/play.pokemonshowdown.com/replays`, skips hidden/private battles, and uses
`https://play.champsnatdex.dynv6.net/js/replay-embed.js` for custom replay data.
