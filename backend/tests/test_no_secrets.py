"""Guards against API keys ending up in committed files."""

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KEY_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),  # Google API keys
    re.compile(r"\b[0-9a-f]{64}\b"),  # VirusTotal keys
]


def test_env_example_has_no_values_for_keys():
    for line in (ROOT / ".env.example").read_text(encoding="utf-8").splitlines():
        if re.match(r"^[A-Z_]*_KEY=", line):
            assert line.endswith("="), f".env.example must not contain a real key: {line.split('=')[0]}"


def test_tracked_files_contain_no_api_keys():
    files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    for f in files:
        p = ROOT / f
        if p.suffix in {".png", ".jpg", ".jpeg", ".ico", ".lock"} or not p.is_file():
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        for pat in KEY_PATTERNS:
            assert not pat.search(text), f"possible API key in tracked file {f}"
