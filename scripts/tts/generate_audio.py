#!/usr/bin/env python3
"""Local TTS for Polyglot Library stories using Kokoro (Apache 2.0).

Mirrors src/lib/elevenlabs.ts buildAudioNarrationText: title, pause, body.
Outputs WAV; converts to MP3 via ffmpeg if --output ends in .mp3.

Examples:
  python generate_audio.py --lang es --text "Hola mundo" -o out.mp3
  python generate_audio.py --lang es --title "El gato" --text-file story.txt -o gato.mp3
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def _ensure_espeak_paths() -> None:
    """Point phonemizer/piper at brew's espeak-ng on macOS.

    Both kokoro (via misaki/phonemizer-fork) and piper-tts ship paths hardcoded
    to their CI runners, so we override via env vars before importing them.
    """
    if os.environ.get("PHONEMIZER_ESPEAK_LIBRARY") and os.environ.get("PIPER_ESPEAK_DATA_DIR"):
        return
    candidates = [
        ("/opt/homebrew/lib/libespeak-ng.dylib", "/opt/homebrew/bin/espeak-ng", "/opt/homebrew/share/espeak-ng-data"),
        ("/usr/local/lib/libespeak-ng.dylib", "/usr/local/bin/espeak-ng", "/usr/local/share/espeak-ng-data"),
    ]
    for lib, binp, data in candidates:
        if Path(lib).exists() and Path(binp).exists() and Path(data).exists():
            os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", lib)
            os.environ.setdefault("PHONEMIZER_ESPEAK_PATH", binp)
            os.environ.setdefault("ESPEAK_DATA_PATH", data)
            os.environ.setdefault("PIPER_ESPEAK_DATA_DIR", data)
            return


_ensure_espeak_paths()


def _patch_espeak_wrapper() -> None:
    """Newer phonemizer dropped EspeakWrapper.set_library / set_data_path
    (now read-only properties). misaki (Kokoro's G2P) still calls the old
    classmethods at import time, raising AttributeError. Since env vars
    PHONEMIZER_ESPEAK_LIBRARY / ESPEAK_DATA_PATH are already set above,
    register the legacy methods as no-ops so the import succeeds.
    """
    try:
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
    except Exception:
        return
    if not hasattr(EspeakWrapper, "set_library"):
        EspeakWrapper.set_library = classmethod(lambda cls, *a, **kw: None)
    if not hasattr(EspeakWrapper, "set_data_path"):
        EspeakWrapper.set_data_path = classmethod(lambda cls, *a, **kw: None)


_patch_espeak_wrapper()

import io
import wave

import numpy as np
import soundfile as sf
from kokoro import KPipeline

LANG_TO_CODE = {
    "en": "a",  # American English
    "en-gb": "b",
    "es": "e",  # Spanish
    "fr": "f",
    "it": "i",
    "pt": "p",  # Brazilian Portuguese
    "ja": "j",
    "zh": "z",
    "hi": "h",
    # German has no Kokoro support — code is a placeholder. We accept "de" so
    # callers can pass --lang de when using non-Kokoro voices (bark/coqui),
    # which route by --voice-id and ignore --lang.
    "de": "g",
}

DEFAULT_VOICE = {
    "en": "af_heart",
    "en-gb": "bf_alice",
    "es": "ef_dora",
    "fr": "ff_siwis",
    "it": "if_sara",
    "pt": "pf_dora",
    "ja": "jf_alpha",
    "zh": "zf_xiaobei",
    "hi": "hf_alpha",
}

SAMPLE_RATE = 24_000


def build_narration(title: str | None, body: str) -> str:
    def clean(s: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()

    body_clean = clean(body)
    if not title:
        return body_clean
    title_clean = clean(title)
    if not title_clean:
        return body_clean
    if not re.search(r"[.!?…:]$", title_clean):
        title_clean += "."
    return f"{title_clean}\n\n{body_clean}" if body_clean else title_clean


def synthesize_kokoro(text: str, lang: str, voice: str, speed: float) -> tuple[np.ndarray, int]:
    """Feed the full text to Kokoro in one call so the model plans prosody
    holistically. Returns (audio_float32_mono, sample_rate).
    """
    pipeline = KPipeline(lang_code=LANG_TO_CODE[lang])
    chunks: list[np.ndarray] = []
    for _, _, audio in pipeline(text, voice=voice, speed=speed):
        chunks.append(audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio))
    if not chunks:
        raise RuntimeError("Kokoro produced no audio")
    return np.concatenate(chunks), SAMPLE_RATE


def synthesize_f5(
    text: str,
    ref_audio: Path,
    ref_text: str,
    speed: float,
    nfe_step: int = 16,
) -> tuple[np.ndarray, int]:
    """Run F5-TTS with voice cloning. Returns (audio_float32_mono, sample_rate).

    nfe_step controls quality vs speed: 32 = default high quality, 16 = ~2x faster
    with minimal perceptual loss for narration.
    """
    import torch
    from f5_tts.api import F5TTS

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tts = F5TTS(model="F5TTS_v1_Base", device=device)
    audio_array, final_sr, _ = tts.infer(
        ref_file=str(ref_audio),
        ref_text=ref_text,
        gen_text=text,
        nfe_step=nfe_step,
        cfg_strength=2.0,
        speed=speed,
        remove_silence=False,
    )
    audio = audio_array if isinstance(audio_array, np.ndarray) else np.asarray(audio_array)
    return audio.astype(np.float32), final_sr


PIPER_PAUSE_SENTENCE = 0.35   # after . … inside a paragraph
PIPER_PAUSE_EMPHATIC = 0.50   # after ? !
PIPER_PAUSE_PARAGRAPH = 0.85  # between paragraphs (incl. title → body)


def _piper_split_segments(text: str) -> list[tuple[str, float]]:
    """Split narration into [(segment, silence_after_seconds)] for Piper.

    Unlike Kokoro, Piper synthesizes phoneme-by-phoneme without cross-sentence
    prosody planning, so inserting explicit silence between sentences fills a
    real perceptual gap rather than overlaying redundant pauses.
    """
    out: list[tuple[str, float]] = []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    for pi, para in enumerate(paragraphs):
        is_last_para = pi == len(paragraphs) - 1
        sentences = re.findall(r"[^.!?…]+[.!?…]+|[^.!?…]+$", para)
        sentences = [s.strip() for s in sentences if s.strip()]
        if not sentences:
            continue
        for si, sent in enumerate(sentences):
            is_last_sent = si == len(sentences) - 1
            if is_last_sent and is_last_para:
                pause = 0.0
            elif is_last_sent:
                pause = PIPER_PAUSE_PARAGRAPH
            else:
                last = sent[-1]
                pause = PIPER_PAUSE_EMPHATIC if last in "?!" else PIPER_PAUSE_SENTENCE
            out.append((sent, pause))
    return out


# Piper expressivity tuning: subtle bump above defaults (0.8 / 0.667 / 1.0)
# without crossing into "emotional model" territory that drops fidelity.
PIPER_NOISE_W_SCALE = 1.0   # cadence variation (default 0.8)
PIPER_NOISE_SCALE   = 0.75  # timbre variation (default 0.667)
PIPER_LENGTH_BIAS   = 1.05  # 5% slower for more deliberate delivery


def _piper_synthesize_one(voice, text: str, length_scale: float) -> tuple[np.ndarray, int]:
    """Synthesize a single segment with Piper and return (float32 mono, sr)."""
    from piper import SynthesisConfig
    syn_config = SynthesisConfig(
        length_scale=length_scale * PIPER_LENGTH_BIAS,
        noise_scale=PIPER_NOISE_SCALE,
        noise_w_scale=PIPER_NOISE_W_SCALE,
    )
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        voice.synthesize_wav(text, wf, syn_config=syn_config)
    buf.seek(0)
    with wave.open(buf, "rb") as wf:
        sr = wf.getframerate()
        sampwidth = wf.getsampwidth()
        raw = wf.readframes(wf.getnframes())
    if sampwidth != 2:
        raise RuntimeError(f"Unexpected Piper sample width {sampwidth}")
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return audio, sr


def synthesize_coqui(text: str, model_id: str, speed: float = 1.0) -> tuple[np.ndarray, int]:
    """Run a Coqui TTS pre-trained model (e.g. tts_models/de/css10/vits-neon).
    Coqui handles long text internally so no chunking needed.
    """
    # Patch transformers compat (Coqui XttsConfig imports a removed symbol)
    import transformers.pytorch_utils as pu
    if not hasattr(pu, "isin_mps_friendly"):
        import torch
        pu.isin_mps_friendly = torch.isin
    # PyTorch 2.6+ flipped weights_only default; Coqui checkpoints predate that.
    import torch
    _orig = torch.load
    def _safe(*a, **k):
        k.setdefault("weights_only", False)
        return _orig(*a, **k)
    torch.load = _safe
    try:
        from TTS.api import TTS
        tts = TTS(model_id, progress_bar=False)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            tts.tts_to_file(text=text, file_path=str(tmp_path))
            audio, sr = sf.read(str(tmp_path))
        finally:
            tmp_path.unlink(missing_ok=True)
    finally:
        torch.load = _orig
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio.astype(np.float32), int(sr)


def synthesize_bark(text: str, history_prompt: str, speed: float = 1.0) -> tuple[np.ndarray, int]:
    """Run Bark with a German speaker preset. Bark caps at ~13s per generation,
    so we split the text into sentence chunks short enough to fit, then
    concatenate with small silences between.
    """
    # PyTorch 2.6+ weights_only flag; Bark checkpoints trusted (Suno).
    import torch
    _orig = torch.load
    def _safe(*a, **k):
        k.setdefault("weights_only", False)
        return _orig(*a, **k)
    torch.load = _safe
    try:
        from bark import generate_audio, preload_models, SAMPLE_RATE as BARK_SR
        preload_models()

        # Chunk text on sentence boundaries; keep each chunk under ~200 chars
        # (Bark's 13s output cap typically corresponds to ~25-35 spoken words).
        sentences = re.findall(r"[^.!?…]+[.!?…]+|[^.!?…]+$", text)
        sentences = [s.strip() for s in sentences if s.strip()]
        chunks: list[str] = []
        cur = ""
        for s in sentences:
            if len(cur) + len(s) > 200 and cur:
                chunks.append(cur.strip())
                cur = s
            else:
                cur = (cur + " " + s).strip() if cur else s
        if cur:
            chunks.append(cur.strip())

        parts: list[np.ndarray] = []
        gap = np.zeros(int(0.35 * BARK_SR), dtype=np.float32)  # 350 ms between chunks
        for i, chunk in enumerate(chunks):
            audio = generate_audio(chunk, history_prompt=history_prompt)
            parts.append(audio.astype(np.float32))
            if i < len(chunks) - 1:
                parts.append(gap)
        if not parts:
            raise RuntimeError("Bark produced no audio")
        return np.concatenate(parts), BARK_SR
    finally:
        torch.load = _orig


def synthesize_piper(text: str, model_path: Path, speed: float) -> tuple[np.ndarray, int]:
    """Synthesize narration with Piper, inserting explicit silence at sentence
    and paragraph boundaries (Piper does not produce natural cross-sentence pauses).
    """
    from piper import PiperVoice  # imported lazily; heavy

    voice = PiperVoice.load(str(model_path))
    length_scale = 1.0 / speed if speed > 0 else 1.0
    segments = _piper_split_segments(text)
    if not segments:
        raise RuntimeError("No segments to synthesize")

    parts: list[np.ndarray] = []
    sr = 0
    for seg_text, pause_s in segments:
        audio, seg_sr = _piper_synthesize_one(voice, seg_text, length_scale)
        if sr == 0:
            sr = seg_sr
        elif seg_sr != sr:
            raise RuntimeError(f"Piper sample rate changed mid-stream: {sr} → {seg_sr}")
        parts.append(audio)
        if pause_s > 0:
            parts.append(np.zeros(int(pause_s * sr), dtype=np.float32))
    if not parts:
        raise RuntimeError("Piper produced no audio")
    return np.concatenate(parts), sr


DIALOGUE_PAUSE_S = 0.45  # silence between speaker turns in multi-voice mode


def _resample(audio: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    """Linear resample (good enough for narration; avoids extra deps)."""
    if src_sr == dst_sr:
        return audio
    ratio = dst_sr / src_sr
    n_out = int(round(len(audio) * ratio))
    if n_out <= 0:
        return audio
    src_idx = np.linspace(0, len(audio) - 1, n_out)
    return np.interp(src_idx, np.arange(len(audio)), audio).astype(np.float32)


def synthesize_multivoice(
    segments: list[dict],
    *,
    lang: str,
    speed: float,
    target_sr: int = SAMPLE_RATE,
    ref_audio_default: Path | None = None,
    ref_text_default: str | None = None,
    f5_nfe_step: int = 16,
) -> tuple[np.ndarray, int, list[tuple[float, float]]]:
    """Synthesize a multi-voice script. Each segment is dict with:
        voice: 'engine/name' (kokoro/piper/f5)
        text:  string
        speaker (optional): 'narrator' marks out-of-scene VO so the ambient
                 bed is silenced there by the caller.
        ref_audio (optional, for f5/...): path to reference WAV
        ref_text  (optional, for f5/...): transcript of ref audio

    Inserts DIALOGUE_PAUSE_S of silence between segments. Resamples each
    segment's output to target_sr so engines can mix freely.
    """
    if not segments:
        raise RuntimeError("No segments in multi-voice spec")

    parts: list[np.ndarray] = []
    # Narrator (out-of-scene VO) time ranges in seconds, so the caller can
    # silence the ambient bed there — the bed belongs to the scene the
    # characters inhabit, not to the narrator. See memory
    # `feedback_ambient_not_under_narrator`.
    narrator_intervals: list[tuple[float, float]] = []
    cursor = 0  # running sample offset into the concatenated output
    for i, seg in enumerate(segments):
        voice_id = seg["voice"]
        text = seg["text"].strip()
        if not text:
            continue
        is_narrator = str(seg.get("speaker", "")).strip().lower() == "narrator"
        engine, name = parse_voice_id(voice_id)
        if engine == "kokoro":
            audio, sr = synthesize_kokoro(text, lang, name, speed)
        elif engine == "piper":
            audio, sr = synthesize_piper(text, piper_model_path(name), speed)
        elif engine == "f5":
            ref_a = Path(seg.get("ref_audio") or (ref_audio_default or ""))
            ref_t = seg.get("ref_text") or ref_text_default
            if not ref_a.exists():
                raise SystemExit(f"F5 segment {i} missing ref_audio: {ref_a}")
            if not ref_t:
                raise SystemExit(f"F5 segment {i} missing ref_text")
            audio, sr = synthesize_f5(text, ref_a, ref_t, speed, nfe_step=f5_nfe_step)
        else:
            raise SystemExit(f"Unknown engine: {engine!r}")

        if sr != target_sr:
            audio = _resample(audio, sr, target_sr)
        start_s = cursor / target_sr
        end_s = (cursor + len(audio)) / target_sr
        if is_narrator:
            if narrator_intervals and start_s - narrator_intervals[-1][1] <= 0.5:
                narrator_intervals[-1] = (narrator_intervals[-1][0], end_s)
            else:
                narrator_intervals.append((start_s, end_s))
        parts.append(audio)
        cursor += len(audio)
        if i < len(segments) - 1:
            pause = np.zeros(int(DIALOGUE_PAUSE_S * target_sr), dtype=np.float32)
            parts.append(pause)
            cursor += len(pause)

    if not parts:
        raise RuntimeError("Multi-voice synthesis produced no audio")
    return np.concatenate(parts), target_sr, narrator_intervals


# Maps catalog voice "name" suffix → Coqui model_id used by TTS().
COQUI_MODEL_BY_NAME: dict[str, str] = {
    "de_DE-css10-vits-neon": "tts_models/de/css10/vits-neon",
}


def parse_voice_id(voice_id: str) -> tuple[str, str]:
    """Parse 'engine/name' into (engine, name)."""
    if "/" not in voice_id:
        raise ValueError(f"voice-id must be in 'engine/name' form, got {voice_id!r}")
    engine, name = voice_id.split("/", 1)
    return engine, name


def piper_model_path(voice_name: str) -> Path:
    """Map a piper voice name (e.g. 'es_MX-claude-high') to the local .onnx path."""
    here = Path(__file__).resolve().parent
    path = here / "piper-voices" / f"{voice_name}.onnx"
    if not path.exists():
        raise SystemExit(
            f"Piper voice not found: {path}. "
            f"Run scripts/tts/download_piper_voices.sh to fetch."
        )
    return path


# Default postprocess chain — kept light so Piper "high" voices (22 kHz) don't sound muffled.
#   - afftdn: FFT-based stationary noise reduction (removes Bark room tone / hum
#     without touching the voice). nr=12 dB attenuation, nf=-25 dB noise floor estimate.
#   - highpass 80Hz: kill subsonic rumble
#   - equalizer 7kHz -2dB: gentle de-ess (Kokoro Spanish needs more, Piper less)
#   - lowpass 10.5kHz: roll off only the very harshest highs above model range
#   - loudnorm: consistent perceived loudness across stories
POSTPROCESS_FILTER = (
    "afftdn=nr=12:nf=-25,"
    "highpass=f=80,"
    "equalizer=f=7000:width_type=q:width=1.4:gain=-2,"
    "lowpass=f=10500,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)

# Per-voice postprocess overrides. Map voiceId → ffmpeg -af filter string.
# Use this when a specific voice needs different EQ/dynamics to sound right
# (e.g. a voice that comes muffled benefits from a treble shelf, no lowpass).
# Applied system-wide: same chain for gallery samples and full-story generations.
PER_VOICE_POSTPROCESS: dict[str, str] = {}


def resolve_postprocess_filter(voice_id: str | None) -> str:
    """Pick the postprocess chain for this voice, falling back to default."""
    if voice_id and voice_id in PER_VOICE_POSTPROCESS:
        return PER_VOICE_POSTPROCESS[voice_id]
    return POSTPROCESS_FILTER


AMBIENT_VOLUME = 0.10  # ~ -20 dB under the narration before ducking


def write_output(
    audio: np.ndarray,
    output: Path,
    *,
    sample_rate: int = SAMPLE_RATE,
    postprocess: bool = True,
    ambient_path: Path | None = None,
    voice_id: str | None = None,
    narrator_intervals: list[tuple[float, float]] | None = None,
) -> None:
    if output.suffix.lower() != ".mp3":
        sf.write(output, audio, sample_rate)
        return
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg not found. Install (brew install ffmpeg) or use a .wav output path.")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        sf.write(tmp_path, audio, sample_rate)
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp_path)]
        has_ambient = ambient_path is not None and Path(ambient_path).exists()
        if has_ambient:
            cmd += ["-i", str(ambient_path)]

        narr_label = "0:a"
        filters: list[str] = []
        if postprocess:
            chain = resolve_postprocess_filter(voice_id)
            filters.append(f"[{narr_label}]{chain}[narrproc]")
            narr_label = "narrproc"

        if has_ambient:
            # Loop the ambient bed, set base volume, split narration, sidechain-compress
            # the ambient against the narration so it ducks under speech, then mix.
            # Additionally hard-gate the bed to silence during narrator (VO) ranges:
            # the ambient belongs to the characters' scene, never under the narrator.
            gate = ""
            if narrator_intervals:
                off_expr = "+".join(
                    f"between(t,{a:.3f},{b:.3f})" for a, b in narrator_intervals
                )
                gate = f"*(1-min(1,{off_expr}))"
            filters.append(
                f"[1:a]aloop=loop=-1:size=2e9,volume='{AMBIENT_VOLUME}{gate}':eval=frame[amb]"
            )
            filters.append(f"[{narr_label}]asplit=2[narr1][narr2]")
            filters.append("[amb][narr2]sidechaincompress=threshold=0.04:ratio=8:attack=5:release=400[ambducked]")
            filters.append("[narr1][ambducked]amix=inputs=2:duration=first:dropout_transition=0[mix]")
            output_label = "mix"
        else:
            output_label = narr_label

        if filters:
            cmd += ["-filter_complex", "; ".join(filters), "-map", f"[{output_label}]"]
        cmd += ["-codec:a", "libmp3lame", "-qscale:a", "0", str(output)]
        subprocess.run(cmd, check=True)
    finally:
        tmp_path.unlink(missing_ok=True)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--text", help="Body text to synthesize")
    p.add_argument("--text-file", type=Path, help="Read body text from file")
    p.add_argument("--title", help="Optional title narrated before body with a pause")
    p.add_argument("--title-file", type=Path)
    p.add_argument("--lang", default="es", choices=sorted(LANG_TO_CODE.keys()), help="Used by the kokoro engine. Ignored when --voice-id is piper/...")
    p.add_argument("--voice", help="Kokoro voice name (e.g. ef_dora). Overridden by --voice-id.")
    p.add_argument("--voice-id", help="'engine/name' selector, e.g. 'kokoro/ef_dora' or 'piper/de_DE-thorsten-high'. Takes precedence over --lang/--voice.")
    p.add_argument("--speed", type=float, default=1.0)
    p.add_argument("--postprocess", action="store_true", help="Apply ffmpeg de-ess + lowpass + loudnorm. Off by default (raw Kokoro sounds more natural).")
    p.add_argument("--ambient", type=Path, help="Path to an ambient WAV/MP3 to loop and mix under narration with sidechain ducking.")
    # F5-TTS voice cloning args (only used when voice-id is f5/...)
    p.add_argument("--ref-audio", type=Path, help="Reference audio (~6-15s) for F5 voice cloning.")
    p.add_argument("--ref-text", type=str, help="Exact transcript of the reference audio.")
    p.add_argument("--ref-text-file", type=Path, help="Read reference transcript from file (alternative to --ref-text).")
    p.add_argument("--nfe-step", type=int, default=16, help="F5 quality steps (16=fast/good, 32=slower/best).")
    p.add_argument("--spec", type=Path, help="Multi-voice spec JSON: list of {voice, text, [ref_audio, ref_text]}. Overrides --text/--voice-id.")
    p.add_argument("-o", "--output", type=Path, required=True)
    args = p.parse_args()

    # Multi-voice mode short-circuits text/title arguments
    if args.spec:
        spec = json.loads(args.spec.read_text(encoding="utf-8"))
        if not isinstance(spec, list):
            raise SystemExit("--spec must contain a JSON array of {voice, text, ...} entries")
        total_chars = sum(len(s.get("text", "")) for s in spec)
        unique_voices = sorted({s["voice"] for s in spec if s.get("voice")})
        print(f"[tts] multi-voice spec={len(spec)} segments, voices={unique_voices}, chars={total_chars} → {args.output}")
        audio, sr, narrator_intervals = synthesize_multivoice(
            spec,
            lang=args.lang,
            speed=args.speed,
            ref_audio_default=args.ref_audio,
            ref_text_default=args.ref_text,
            f5_nfe_step=args.nfe_step,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # In multi-voice mode there's no single voice_id; use default chain.
        write_output(
            audio,
            args.output,
            sample_rate=sr,
            postprocess=args.postprocess,
            ambient_path=args.ambient,
            narrator_intervals=narrator_intervals,
        )
        duration_s = len(audio) / sr
        print(f"[tts] done. {duration_s:.1f}s of audio")
        return 0

    if args.text_file:
        body = args.text_file.read_text(encoding="utf-8")
    elif args.text:
        body = args.text
    else:
        sys.stderr.write("Provide --text, --text-file, or --spec\n")
        return 2

    title = args.title_file.read_text(encoding="utf-8") if args.title_file else args.title
    narration = build_narration(title, body)

    # Route to engine
    if args.voice_id:
        engine, name = parse_voice_id(args.voice_id)
        if engine == "kokoro":
            print(f"[tts] engine=kokoro lang={args.lang} voice={name} chars={len(narration)} → {args.output}")
            audio, sr = synthesize_kokoro(narration, args.lang, name, args.speed)
        elif engine == "piper":
            model = piper_model_path(name)
            print(f"[tts] engine=piper voice={name} chars={len(narration)} → {args.output}")
            audio, sr = synthesize_piper(narration, model, args.speed)
        elif engine == "f5":
            if not args.ref_audio:
                raise SystemExit("F5 requires --ref-audio (the cloned voice sample)")
            ref_text = args.ref_text
            if args.ref_text_file and not ref_text:
                ref_text = args.ref_text_file.read_text(encoding="utf-8")
            if not ref_text:
                raise SystemExit("F5 requires --ref-text or --ref-text-file (transcript of ref audio)")
            print(f"[tts] engine=f5 voice={name} ref={args.ref_audio.name} nfe={args.nfe_step} chars={len(narration)} → {args.output}")
            audio, sr = synthesize_f5(narration, args.ref_audio, ref_text, args.speed, nfe_step=args.nfe_step)
        elif engine == "coqui":
            # Voice name encodes the Coqui model path; we map a known catalog entry
            # to its full model_id (e.g. "de_DE-css10-vits-neon" → "tts_models/de/css10/vits-neon").
            model_id = COQUI_MODEL_BY_NAME.get(name)
            if not model_id:
                raise SystemExit(f"Unknown coqui voice: {name}")
            print(f"[tts] engine=coqui voice={name} chars={len(narration)} → {args.output}")
            audio, sr = synthesize_coqui(narration, model_id, args.speed)
        elif engine == "bark":
            history_prompt = f"v2/{name}"  # e.g. bark/de_speaker_4 → v2/de_speaker_4
            print(f"[tts] engine=bark voice={name} chars={len(narration)} → {args.output}")
            audio, sr = synthesize_bark(narration, history_prompt, args.speed)
        else:
            raise SystemExit(f"Unknown engine: {engine!r}")
    else:
        voice = args.voice or DEFAULT_VOICE[args.lang]
        print(f"[tts] engine=kokoro lang={args.lang} voice={voice} chars={len(narration)} → {args.output}")
        audio, sr = synthesize_kokoro(narration, args.lang, voice, args.speed)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_output(audio, args.output, sample_rate=sr, postprocess=args.postprocess, ambient_path=args.ambient, voice_id=args.voice_id)
    duration_s = len(audio) / sr
    print(f"[tts] done. {duration_s:.1f}s of audio")
    return 0


if __name__ == "__main__":
    sys.exit(main())
