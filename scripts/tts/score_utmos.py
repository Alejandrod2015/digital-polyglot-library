#!/usr/bin/env python3
"""Score audio files with UTMOS (predicted Mean Opinion Score 1.0–5.0).

UTMOS is a model trained on humans rating TTS naturalness. It catches the
"intelligible but robotic" failure mode that Whisper WER misses.

Calibration (from user-approved voices):
    Cadu (PT)     → 4.03  ← best in catalog
    Paola (IT)    → 3.55
    Sharvard (ES) → 3.11  ← lower bound for "approved" range

Quality gate: voices scoring < 3.0 are auto-rejected, no exceptions.

Usage:
    python scripts/tts/score_utmos.py <file_or_dir> [<file_or_dir>...]
"""
import sys
import warnings
warnings.filterwarnings("ignore")
from pathlib import Path
import torch
import librosa


def score(predictor, path: Path) -> float:
    wav, sr = librosa.load(str(path), sr=None, mono=True)
    return predictor(torch.from_numpy(wav).unsqueeze(0), sr).item()


def main():
    if len(sys.argv) < 2:
        sys.stderr.write(__doc__)
        sys.exit(2)

    paths: list[Path] = []
    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_dir():
            paths.extend(sorted(p.iterdir()))
        elif p.is_file():
            paths.append(p)

    paths = [p for p in paths if p.suffix.lower() in (".mp3", ".wav", ".flac", ".ogg")]
    if not paths:
        sys.stderr.write("No audio files found.\n")
        sys.exit(1)

    predictor = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True)

    results = []
    for p in paths:
        try:
            s = score(predictor, p)
            results.append((p.name, s))
        except Exception as e:
            print(f"FAIL {p.name}: {e}")

    results.sort(key=lambda x: -x[1])
    print("\nUTMOS  Verdict       File")
    print("─" * 70)
    for name, s in results:
        verdict = "✅ pass" if s >= 3.0 else "❌ reject"
        print(f"{s:.2f}   {verdict:13s} {name}")


if __name__ == "__main__":
    main()
