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
    "piper/pt_BR-cadu-medium":     "pt_BR-cadu-medium",
    "piper/it_IT-paola-medium":    "it_IT-paola-medium",
}

PIPER_HF_PATHS = {
    "es_ES-sharvard-medium": "es/es_ES/sharvard/medium/es_ES-sharvard-medium",
    "pt_BR-cadu-medium":     "pt/pt_BR/cadu/medium/pt_BR-cadu-medium",
    "it_IT-paola-medium":    "it/it_IT/paola/medium/it_IT-paola-medium",
}

VOICES_DIR = Path("/voices")


def _download_piper_voices():
    import urllib.request
    VOICES_DIR.mkdir(exist_ok=True)
    base = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
    for name, path in PIPER_HF_PATHS.items():
        for ext in ("onnx", "onnx.json"):
            out = VOICES_DIR / f"{name}.{ext}"
            if out.exists() and out.stat().st_size > 0:
                continue
            urllib.request.urlretrieve(f"{base}/{path}.{ext}", out)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "espeak-ng", "libespeak-ng1")
    .pip_install("piper-tts==1.2.0", "fastapi[standard]==0.115.5")
    .run_function(_download_piper_voices)
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
