#!/usr/bin/env python3
"""Manda a produccion un user.deleted FIRMADO como lo firma Svix, para probar
de punta a punta que el secreto desplegado es el correcto.

Inocuo por diseno: el userId no existe, asi que deleteAllUserData no encuentra
ninguna fila y no se envia ningun correo. Deja una unica fila en RevokedUser,
que el script de limpieza borra despues.

  python3 scripts/_probeWebhookSignature.py <secreto> <url>
"""
import base64
import hashlib
import hmac
import json
import sys
import time
import urllib.request

secret_raw, url = sys.argv[1], sys.argv[2]
user_id = f"user_webhookprobe{int(time.time())}"

payload = json.dumps(
    {
        "type": "user.deleted",
        "data": {"id": user_id, "object": "user", "deleted": True},
        "object": "event",
    },
    separators=(",", ":"),
)

msg_id = f"msg_probe{int(time.time())}"
ts = str(int(time.time()))
key = base64.b64decode(secret_raw.split("_", 1)[1])
signed = f"{msg_id}.{ts}.{payload}".encode()
sig = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

req = urllib.request.Request(
    url,
    data=payload.encode(),
    headers={
        "Content-Type": "application/json",
        "svix-id": msg_id,
        "svix-timestamp": ts,
        "svix-signature": f"v1,{sig}",
    },
    method="POST",
)

print("userId de prueba:", user_id)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("HTTP", r.status, r.read().decode()[:200])
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:200])
