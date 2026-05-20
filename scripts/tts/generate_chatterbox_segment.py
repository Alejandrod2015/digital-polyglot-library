#!/usr/bin/env python
"""
Synthesize a single text segment with Chatterbox using a reference MP3.

Args:
  --text <str>     Text to synthesize (single segment, ~10-30 words).
  --ref-audio <path>  Path to reference MP3 (defines speaker timbre).
  --output <path>  Output WAV path.
  --device <str>   Optional: 'cpu', 'cuda', 'mps' (default: auto).

Designed to be invoked from Node/TS once per segment.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torchaudio  # type: ignore
from chatterbox.tts import ChatterboxTTS  # type: ignore


def pick_device() -> str:
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--ref-audio", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--device", default=None)
    args = p.parse_args()

    if not args.ref_audio.exists():
        print(f"ref-audio not found: {args.ref_audio}", file=sys.stderr)
        return 2

    device = args.device or pick_device()
    print(f"[chatterbox] device={device} ref={args.ref_audio.name}", flush=True)

    model = ChatterboxTTS.from_pretrained(device=device)
    wav = model.generate(args.text, audio_prompt_path=str(args.ref_audio))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(args.output), wav, model.sr)
    print(f"[chatterbox] wrote {args.output} sr={model.sr}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
