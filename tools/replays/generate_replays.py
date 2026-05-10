#!/usr/bin/env python3
"""Generate static Project NatDex replay pages from Pokemon Showdown battle logs."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

from pokemon_showdown_replays import Download, Replay


SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parents[2] if len(SCRIPT_PATH.parents) > 2 else Path.cwd()
DEFAULT_LOGS = DEFAULT_ROOT / "server" / "logs"
DEFAULT_OUTPUT = DEFAULT_ROOT / "client" / "play.pokemonshowdown.com" / "replays"
DEFAULT_BASE_URL = "https://play.champsnatdex.dynv6.net"
DEFAULT_EMBED_URL = f"{DEFAULT_BASE_URL}/js/replay-embed.js"
CSV_FIELDS = ["tier", "p1", "p2", "score", "date", "link", "team1", "team2", "turns", "winner"]


def clean_id(value: str) -> str:
	return re.sub(r"\W+", "", value).replace("_", "") or "unknown"


def species_name(value: str) -> str:
	for base in (
		"Alcremie", "Magearna", "Polteageist", "Keldeo", "Minior", "Pikachu",
		"Sawsbuck", "Maushold", "Dudunsparce", "Vivillon",
	):
		if value.startswith(base):
			return base
	return value


def team_species(team: Any) -> list[str]:
	if not isinstance(team, list):
		return []
	out: list[str] = []
	for pokemon in team:
		if isinstance(pokemon, dict) and pokemon.get("species"):
			out.append(species_name(str(pokemon["species"])))
	return out


def score_string(data: dict[str, Any], winner: str, p1: str, p2: str) -> str:
	score = data.get("score")
	if isinstance(score, list) and len(score) >= 2:
		left, right = score[0], score[1]
		if winner and winner == p2:
			left, right = right, left
		return f"{left} - {right}"
	return ""


def is_public_replay(data: dict[str, Any]) -> bool:
	if data.get("replaySaved") is not True:
		return False
	if data.get("hiddenReplay") or data.get("private") or data.get("password"):
		return False
	if str(data.get("roomid", "")).endswith("pw"):
		return False
	return True


def replay_filename(data: dict[str, Any]) -> str:
	roomid = str(data.get("roomid", "battle-unknown-0"))
	battle_id = roomid.split("-")[-1]
	p1 = clean_id(str(data.get("p1", "p1")))
	p2 = clean_id(str(data.get("p2", "p2")))
	return f"{battle_id}_{p1}_vs_{p2}.html"


def iter_logs(logs_dir: Path) -> list[Path]:
	return sorted(logs_dir.glob("????-??/*/????-??-??/*.log.json"))


def row_from_log(data: dict[str, Any], tier: str, link: str) -> dict[str, str]:
	p1 = str(data.get("p1", ""))
	p2 = str(data.get("p2", ""))
	winner = str(data.get("winner", ""))
	opponent = p2 if winner != p2 else p1
	team1 = team_species(data.get("p1team"))
	team2 = team_species(data.get("p2team"))
	if winner == p2:
		team1, team2 = team2, team1
	return {
		"tier": tier,
		"p1": winner or p1,
		"p2": opponent,
		"score": score_string(data, winner, p1, p2),
		"date": str(data.get("timestamp", "")),
		"link": link,
		"team1": "/".join(team1),
		"team2": "/".join(team2),
		"turns": str(data.get("turns", "")),
		"winner": winner,
	}


def prune_stale_replays(output_dir: Path, keep: set[Path]) -> int:
	removed = 0
	for path in output_dir.glob("*/*.html"):
		if path not in keep:
			path.unlink(missing_ok=True)
			path.with_suffix(path.suffix + ".log").unlink(missing_ok=True)
			removed += 1
	for path in sorted(output_dir.glob("*"), reverse=True):
		if path.is_dir():
			try:
				path.rmdir()
			except OSError:
				pass
	return removed


def generate(logs_dir: Path, output_dir: Path, base_url: str, embed_url: str, min_turns: int, prune: bool) -> tuple[int, int]:
	output_dir.mkdir(parents=True, exist_ok=True)
	rows: list[dict[str, str]] = []
	keep: set[Path] = set()
	generated = 0

	for log_path in iter_logs(logs_dir):
		try:
			data = json.loads(log_path.read_text(encoding="utf-8-sig"))
		except (OSError, json.JSONDecodeError) as exc:
			print(f"Skipping unreadable log {log_path}: {exc}")
			continue

		if int(data.get("turns") or 0) < min_turns or not is_public_replay(data):
			continue
		data.setdefault("inputLog", [])

		tier = log_path.parent.parent.name
		tier_dir = output_dir / tier
		tier_dir.mkdir(parents=True, exist_ok=True)
		html_path = tier_dir / replay_filename(data)
		log_output_path = html_path.with_suffix(html_path.suffix + ".log")
		keep.add(html_path)

		if not html_path.exists() or not log_output_path.exists():
			try:
				replay_object = Replay.create_replay_object(data, show_full_damage=True)
			except ValueError as exc:
				print(f"Skipping invalid replay log {log_path}: {exc}")
				continue
			html = Download.create_replay(replay_object, replay_embed_location=embed_url)
			html_path.write_text(html, encoding="utf-8")
			log_lines = data.get("log") if isinstance(data.get("log"), list) else []
			log_output_path.write_text("\n".join(map(str, log_lines)) + "\n", encoding="utf-8")
			generated += 1

		link = f"{base_url.rstrip('/')}/replays/{tier}/{html_path.name}"
		rows.append(row_from_log(data, tier, link))

	removed = prune_stale_replays(output_dir, keep) if prune else 0
	rows.sort(key=lambda row: row["date"], reverse=True)
	with (output_dir / "data.csv").open("w", newline="", encoding="utf-8") as csv_file:
		writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
		writer.writeheader()
		writer.writerows(rows)

	return generated, removed


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--logs-dir", type=Path, default=DEFAULT_LOGS)
	parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
	parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
	parser.add_argument("--embed-url", default=DEFAULT_EMBED_URL)
	parser.add_argument("--min-turns", type=int, default=2)
	parser.add_argument("--no-prune", action="store_true", help="Do not remove previously generated stale replay pages.")
	args = parser.parse_args()

	generated, removed = generate(
		args.logs_dir, args.output_dir, args.base_url, args.embed_url, args.min_turns, not args.no_prune
	)
	print(f"Generated {generated} replay page(s); removed {removed} stale replay page(s).")


if __name__ == "__main__":
	main()
