"""Modal-hosted TTS for Studio "Audio propio".

Exposes a single web endpoint that synthesizes a story narration with Piper,
uploads the resulting MP3 to Cloudflare R2, and returns the public URL.

Endpoint contract (POST JSON):
  {
    "title": str | null,         # narrated first, then a pause
    "text": str,                 # body text
    "voiceId": str,              # e.g. "piper/es_ES-sharvard-medium"
    "filename": str,             # used as the R2 object basename (no extension)
  }

Response: { "url": str, "filename": str, "bytes": int }

Bearer auth: requests must send "Authorization: Bearer <STUDIO_AUDIO_TOKEN>"
matching the secret. This keeps the public endpoint locked to our Vercel app.
"""
import hashlib
import hmac
import io
import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import modal


PIPER_VOICES = {
    "piper/es_ES-sharvard-medium": "es_ES-sharvard-medium",
    "piper/es_MX-claude-high":     "es_MX-claude-high",
    "piper/pt_BR-cadu-medium":     "pt_BR-cadu-medium",
    "piper/it_IT-paola-medium":    "it_IT-paola-medium",
}

# Note on engines: Kokoro and Bark were considered for ES / DE practice
# audio respectively but neither could be deployed reliably (Kokoro
# image build blocked on the GitHub Releases asset download from inside
# the Modal container; Bark image build dwarfed everything else at
# ~6 GB of torch + transformers and the only candidate German voice was
# already flagged in the project memory as "flat/monotone — rejected").
# Until a workaround is in place we ship the Piper-only deployment that
# has been running since 2026-05-03; Spanish practice clips fall back to
# `piper/es_ES-sharvard-medium` (also Apache-2.0).

PIPER_HF_PATHS = {
    "es_ES-sharvard-medium": "es/es_ES/sharvard/medium/es_ES-sharvard-medium",
    "es_MX-claude-high":     "es/es_MX/claude/high/es_MX-claude-high",
    "pt_BR-cadu-medium":     "pt/pt_BR/cadu/medium/pt_BR-cadu-medium",
    "it_IT-paola-medium":    "it/it_IT/paola/medium/it_IT-paola-medium",
}

# Piper voices live on a Modal Volume now (uploaded via `modal volume put
# polyglot-piper-voices /tmp/piper-voices /`). The previous approach
# baked them into the image via `.run_function(_download_piper_voices)`,
# but that download kept stalling in the build container against the
# HuggingFace LFS redirect — image builds ran > 50 min with no progress.
# Pulling from a Volume removes the build-time download entirely and the
# function just mmaps the .onnx files at cold start.
VOICES_DIR = Path("/voices")
piper_voices_volume = modal.Volume.from_name(
    "polyglot-piper-voices", create_if_missing=True
)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "espeak-ng", "libespeak-ng1")
    .pip_install("piper-tts==1.2.0", "fastapi[standard]==0.115.5")
)


# Kokoro: Apache-2.0, high-quality ONNX TTS. We mount the model + voices
# from a Modal Volume (`polyglot-kokoro`) populated locally via
# `modal volume put` to bypass the GitHub Releases LFS stall that
# bricked the earlier `.run_function(_download_kokoro_assets)` approach.
KOKORO_DIR = Path("/kokoro")
KOKORO_MODEL_FILE = "kokoro-v1.0.onnx"
KOKORO_VOICES_FILE = "voices-v1.0.bin"

KOKORO_VOICES = {
    # voiceId → (kokoro voice name, kokoro lang code accepted by the
    # phonemizer/espeak backend). The "e*" voice prefix is the kokoro
    # naming for Spanish models; the runtime lang code must be "es".
    "kokoro/ef_dora":  ("ef_dora",  "es"),
    "kokoro/em_alex":  ("em_alex",  "es"),
    "kokoro/em_santa": ("em_santa", "es"),
}

kokoro_image = (
    modal.Image.debian_slim(python_version="3.11")
    # espeak-ng is required by kokoro-onnx → phonemizer for non-English
    # languages (it produces the phonemes the model expects).
    .apt_install("ffmpeg", "espeak-ng", "libespeak-ng1")
    .pip_install("kokoro-onnx==0.4.9", "soundfile==0.12.1", "fastapi[standard]==0.115.5")
)

kokoro_voices_volume = modal.Volume.from_name(
    "polyglot-kokoro", create_if_missing=True
)

# Bark image removed for now. The candidate DE voice has not been
# audition-approved and torch + transformers (~6 GB) is too heavy to
# block other engine work. Re-introduce in a follow-up deploy.

# Forced-alignment image: aeneas needs espeak + python-dev for native build.
# Pinned numpy<2 because aeneas 1.7.3 was released pre-numpy-2 and breaks
# against the new ABI. lxml+beautifulsoup4 are aeneas runtime deps.
align_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "espeak",
        "espeak-ng",
        "libespeak-dev",
        "libespeak-ng1",
        "build-essential",
        "python3-dev",
    )
    .pip_install("numpy<2", "lxml", "beautifulsoup4", "fastapi[standard]==0.115.5")
    .pip_install("aeneas==1.7.3.0")
)

app = modal.App("polyglot-audio-studio")


def _build_narration(title: str | None, body: str) -> str:
    title = (title or "").strip()
    body = (body or "").strip()
    if title and not title.endswith((".", "!", "?", "…", ":")):
        title = title + "."
    if title and body:
        return f"{title}\n\n{body}"
    return title or body


def _r2_upload(buffer: bytes, key: str, content_type: str) -> str:
    endpoint = os.environ["MEDIA_STORAGE_ENDPOINT"].rstrip("/")
    bucket = os.environ["MEDIA_STORAGE_BUCKET"]
    access_key = os.environ["MEDIA_STORAGE_ACCESS_KEY_ID"]
    secret_key = os.environ["MEDIA_STORAGE_SECRET_ACCESS_KEY"]
    region = os.environ.get("MEDIA_STORAGE_REGION", "auto")
    public_base = os.environ.get("MEDIA_STORAGE_PUBLIC_BASE_URL", f"{endpoint}/{quote(bucket, safe='')}").rstrip("/")

    encoded_key = "/".join(quote(p, safe="") for p in key.split("/") if p)
    url = f"{endpoint}/{quote(bucket, safe='')}/{encoded_key}"
    host = url.split("/")[2]
    path = "/" + url.split("/", 3)[3]

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(buffer).hexdigest()

    headers = {
        "content-type": content_type,
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "cache-control": "public, max-age=31536000, immutable",
    }
    sorted_h = sorted(headers.items())
    canonical_headers = "".join(f"{k}:{v.strip()}\n" for k, v in sorted_h)
    signed_headers = ";".join(k for k, _ in sorted_h)
    canonical_request = "\n".join(["PUT", path, "", canonical_headers, signed_headers, payload_hash])
    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    string_to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, credential_scope, hashlib.sha256(canonical_request.encode()).hexdigest()])

    def _hmac(key, value):
        return hmac.new(key, value.encode() if isinstance(value, str) else value, hashlib.sha256).digest()
    k_date = _hmac(f"AWS4{secret_key}".encode(), date_stamp)
    k_region = _hmac(k_date, region)
    k_service = _hmac(k_region, "s3")
    k_signing = _hmac(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()
    headers["authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    import urllib.request
    req = urllib.request.Request(url, data=buffer, method="PUT", headers=headers)
    with urllib.request.urlopen(req) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f"R2 upload failed: {resp.status}")
    return f"{public_base}/{encoded_key}"


def _synth_kokoro(narration: str, voice_name: str, lang_code: str) -> bytes:
    """Kokoro-onnx synthesis. Model + voices live on the
    `polyglot-kokoro` Modal Volume mounted at /kokoro (so cold starts
    don't re-download the ~340 MB checkpoint).
    """
    import soundfile as sf
    from kokoro_onnx import Kokoro

    model_path = KOKORO_DIR / KOKORO_MODEL_FILE
    voices_path = KOKORO_DIR / KOKORO_VOICES_FILE
    if not model_path.exists() or not voices_path.exists():
        raise RuntimeError(
            f"Kokoro assets missing on volume "
            f"(model={model_path.exists()}, voices={voices_path.exists()})"
        )

    kokoro = Kokoro(str(model_path), str(voices_path))
    samples, sr = kokoro.create(narration, voice=voice_name, lang=lang_code)

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "out.wav"
        mp3 = Path(tmp) / "out.mp3"
        sf.write(str(wav), samples, sr)
        ff = subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3), "-loglevel", "error"],
            capture_output=True,
            check=False,
        )
        if ff.returncode != 0 or not mp3.exists():
            raise RuntimeError(f"ffmpeg failed ({ff.returncode}): {ff.stderr.decode()[-300:]}")
        return mp3.read_bytes()


def _synth_piper(narration: str, voice_name: str) -> bytes:
    onnx = VOICES_DIR / f"{voice_name}.onnx"
    if not onnx.exists():
        raise RuntimeError(f"Piper voice not found on image: {voice_name}")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "out.wav"
        mp3 = Path(tmp) / "out.mp3"
        proc = subprocess.run(
            ["piper", "--model", str(onnx), "--output_file", str(wav)],
            input=narration.encode(),
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0 or not wav.exists():
            raise RuntimeError(f"piper failed ({proc.returncode}): {proc.stderr.decode()[-300:]}")
        ff = subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3), "-loglevel", "error"],
            capture_output=True,
            check=False,
        )
        if ff.returncode != 0 or not mp3.exists():
            raise RuntimeError(f"ffmpeg failed ({ff.returncode}): {ff.stderr.decode()[-300:]}")
        return mp3.read_bytes()


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("polyglot-r2"),
        modal.Secret.from_name("polyglot-audio-studio-token"),
    ],
    volumes={str(VOICES_DIR): piper_voices_volume},
    timeout=180,
    cpu=2,
    memory=2048,
)
@modal.fastapi_endpoint(method="POST", docs=False)
def synthesize(payload: dict):
    """Auth: payload must include {"_token": "<STUDIO_AUDIO_TOKEN>"}.

    We avoid HTTP header auth because reading headers cleanly in a Modal
    fastapi_endpoint requires importing fastapi.Header at module top-level,
    which conflicts with Modal's static analysis (fastapi only exists inside
    the container image). Body-bound token is simpler and functionally
    equivalent over HTTPS.
    """
    from fastapi import HTTPException

    expected = os.environ.get("STUDIO_AUDIO_TOKEN", "")
    presented = (payload.get("_token") or "").strip()
    if not expected or not hmac.compare_digest(expected, presented):
        raise HTTPException(status_code=401, detail="Unauthorized")

    voice_id = (payload.get("voiceId") or "").strip()
    text = (payload.get("text") or "").strip()
    title = payload.get("title")
    filename = (payload.get("filename") or "").strip() or f"narration_{int(datetime.now(timezone.utc).timestamp())}"

    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    voice_name = PIPER_VOICES.get(voice_id)
    if not voice_name:
        raise HTTPException(status_code=400, detail=f"Unsupported voiceId: {voice_id}. Supported: {list(PIPER_VOICES)}")

    narration = _build_narration(title, text)
    mp3_bytes = _synth_piper(narration, voice_name)

    safe_name = filename.replace("/", "_") if not filename.endswith(".mp3") else filename
    if not safe_name.endswith(".mp3"):
        safe_name = f"{safe_name}.mp3"
    key = f"media/generated/audio/{safe_name}"
    public_url = _r2_upload(mp3_bytes, key, "audio/mpeg")

    return {"url": public_url, "filename": safe_name, "bytes": len(mp3_bytes)}


@app.function(
    image=kokoro_image,
    secrets=[
        modal.Secret.from_name("polyglot-r2"),
        modal.Secret.from_name("polyglot-audio-studio-token"),
    ],
    volumes={str(KOKORO_DIR): kokoro_voices_volume},
    timeout=180,
    cpu=2,
    memory=2048,
)
@modal.fastapi_endpoint(method="POST", docs=False)
def synthesize_kokoro(payload: dict):
    """Kokoro-onnx synthesize endpoint. Same body contract as
    `synthesize` but voiceId must be one of KOKORO_VOICES.
    """
    from fastapi import HTTPException

    expected = os.environ.get("STUDIO_AUDIO_TOKEN", "")
    presented = (payload.get("_token") or "").strip()
    if not expected or not hmac.compare_digest(expected, presented):
        raise HTTPException(status_code=401, detail="Unauthorized")

    voice_id = (payload.get("voiceId") or "").strip()
    text = (payload.get("text") or "").strip()
    title = payload.get("title")
    filename = (payload.get("filename") or "").strip() or f"narration_{int(datetime.now(timezone.utc).timestamp())}"

    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    voice_entry = KOKORO_VOICES.get(voice_id)
    if not voice_entry:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported voiceId: {voice_id}. Supported: {list(KOKORO_VOICES)}",
        )
    voice_name, lang_code = voice_entry

    narration = _build_narration(title, text)
    mp3_bytes = _synth_kokoro(narration, voice_name, lang_code)

    safe_name = filename.replace("/", "_") if not filename.endswith(".mp3") else filename
    if not safe_name.endswith(".mp3"):
        safe_name = f"{safe_name}.mp3"
    key = f"media/generated/audio/{safe_name}"
    public_url = _r2_upload(mp3_bytes, key, "audio/mpeg")

    return {"url": public_url, "filename": safe_name, "bytes": len(mp3_bytes)}


# Map app-level language strings to aeneas BCP-47 / ISO-639-3 task languages.
# Anything not listed here yields a 400 from /align so we fail loud rather
# than silently aligning German text against a Spanish phonetizer.
ALIGN_LANGUAGE_MAP = {
    "german": "deu",
    "de": "deu",
    "spanish": "spa",
    "es": "spa",
    "italian": "ita",
    "it": "ita",
    "portuguese": "por",
    "pt": "por",
    "english": "eng",
    "en": "eng",
    "french": "fra",
    "fr": "fra",
}

# Tokenizes a paragraph of free text into word fragments, preserving the
# character offsets (charStart/charEnd) of each token in the original text so
# the JS renderer can splice the highlight markup back over the un-modified
# source. The regex matches letters/digits with diacritics, apostrophes and
# hyphens internal to a word; punctuation and whitespace are gaps.
def _tokenize_with_spans(text: str):
    import re

    pattern = re.compile(r"[\w][\w'’-]*", re.UNICODE)
    tokens = []
    for match in pattern.finditer(text):
        tokens.append(
            {
                "text": match.group(0),
                "charStart": match.start(),
                "charEnd": match.end(),
            }
        )
    return tokens


@app.function(
    image=align_image,
    secrets=[modal.Secret.from_name("polyglot-audio-studio-token")],
    timeout=300,
    cpu=2,
    memory=2048,
)
@modal.fastapi_endpoint(method="POST", docs=False)
def align(payload: dict):
    """Forced-alignment endpoint. Returns word-level start/end timings.

    Auth: payload must include `_token` matching STUDIO_AUDIO_TOKEN.

    Body:
      {
        "_token": str,
        "audioUrl": str,            # public URL to download
        "text": str,                # full narration text
        "language": str,            # "german" | "de" | "spanish" | ...
      }

    Response:
      {
        "language": "deu",
        "audioDurationSec": float | null,
        "tokens": [
          {"text": "Hallo", "charStart": 0, "charEnd": 5,
           "startSec": 0.04, "endSec": 0.52},
          ...
        ]
      }
    """
    from fastapi import HTTPException

    expected = os.environ.get("STUDIO_AUDIO_TOKEN", "")
    presented = (payload.get("_token") or "").strip()
    if not expected or not hmac.compare_digest(expected, presented):
        raise HTTPException(status_code=401, detail="Unauthorized")

    audio_url = (payload.get("audioUrl") or "").strip()
    text = (payload.get("text") or "").strip()
    raw_language = (payload.get("language") or "").strip().lower()
    if not audio_url:
        raise HTTPException(status_code=400, detail="Missing audioUrl")
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    aeneas_lang = ALIGN_LANGUAGE_MAP.get(raw_language)
    if not aeneas_lang:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {raw_language!r}. Supported: {sorted(set(ALIGN_LANGUAGE_MAP.values()))}",
        )

    tokens = _tokenize_with_spans(text)
    if not tokens:
        raise HTTPException(status_code=400, detail="Text contained no alignable words")

    import urllib.request
    from aeneas.executetask import ExecuteTask
    from aeneas.task import Task

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        audio_path = tmp / "audio.mp3"
        text_path = tmp / "words.txt"
        sync_path = tmp / "sync.json"

        try:
            req = urllib.request.Request(audio_url, headers={"User-Agent": "polyglot-align/1"})
            with urllib.request.urlopen(req) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=502, detail=f"Audio download failed: {resp.status}")
                audio_path.write_bytes(resp.read())
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Audio download error: {e}")

        # aeneas operates on text fragments line-by-line, so one word per line
        # gives us word-level boundaries directly.
        text_path.write_text("\n".join(t["text"] for t in tokens), encoding="utf-8")

        config_string = (
            f"task_language={aeneas_lang}"
            "|is_text_type=plain"
            "|os_task_file_format=json"
        )
        task = Task(config_string=config_string)
        task.audio_file_path_absolute = str(audio_path)
        task.text_file_path_absolute = str(text_path)
        task.sync_map_file_path_absolute = str(sync_path)

        try:
            ExecuteTask(task).execute()
            task.output_sync_map_file()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"aeneas alignment failed: {e}")

        sync_data = json.loads(sync_path.read_text(encoding="utf-8"))
        fragments = sync_data.get("fragments") or []

        # aeneas returns one fragment per input line, in order. The number of
        # fragments matches the number of tokens unless the phonetizer dropped
        # a line. We zip carefully and leave gaps as null timings.
        timings = []
        for i, token in enumerate(tokens):
            frag = fragments[i] if i < len(fragments) else None
            if frag is None:
                start_sec = None
                end_sec = None
            else:
                try:
                    start_sec = float(frag.get("begin"))
                    end_sec = float(frag.get("end"))
                except (TypeError, ValueError):
                    start_sec = None
                    end_sec = None
            timings.append(
                {
                    "text": token["text"],
                    "charStart": token["charStart"],
                    "charEnd": token["charEnd"],
                    "startSec": start_sec,
                    "endSec": end_sec,
                }
            )

        # Probe audio duration via ffprobe; non-fatal if it fails.
        duration = None
        try:
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
                capture_output=True, check=False, text=True,
            )
            if probe.returncode == 0:
                duration = float(probe.stdout.strip())
        except Exception:
            duration = None

        return {
            "language": aeneas_lang,
            "audioDurationSec": duration,
            "tokens": timings,
        }
