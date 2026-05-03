#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found. Install from https://brew.sh first." >&2
  exit 1
fi

if ! command -v python3.11 >/dev/null 2>&1; then
  brew install python@3.11
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  brew install ffmpeg
fi

if [ ! -d .venv ]; then
  python3.11 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo
echo "Done. Activate with: source scripts/tts/.venv/bin/activate"
echo "Try: python scripts/tts/generate_audio.py --lang es --text 'Hola mundo' -o out.mp3"
