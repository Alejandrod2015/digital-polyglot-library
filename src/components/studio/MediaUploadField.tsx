"use client";

import { useRef, useState } from "react";
import MiniPlayer from "@/components/studio/MiniPlayer";

type Kind = "cover" | "audio";

type Props = {
  kind: Kind;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  // Optional callback that fires when the URL changes via upload (vs typed).
  // Useful when the parent wants to know we actually persisted a new asset.
  onUploaded?: (info: { url: string; key: string; filename: string; size: number }) => void;
  // If true, hides the "URL del archivo" text input. Default false (visible
  // for editors that want the raw R2 URL surfaced).
  hideUrlInput?: boolean;
};

const ACCEPT: Record<Kind, string> = {
  cover: "image/jpeg,image/png,image/webp,image/gif",
  audio: "audio/*",
};

const LABELS: Record<Kind, { drag: string; upload: string; field: string }> = {
  cover: {
    drag: "Arrastra una imagen aquí, pega desde el portapapeles, o",
    upload: "Subir imagen",
    field: "URL del cover",
  },
  audio: {
    drag: "Arrastra un audio aquí o",
    upload: "Subir audio",
    field: "URL del audio",
  },
};

// Drag-and-drop / paste / file-picker / URL-fallback uploader used across
// Studio editors. Hits POST /api/studio/media/upload and writes the public
// R2 URL back via onChange. Always shows a live preview of `value` (image
// or audio MiniPlayer) so editors don't have to render their own.
export default function MediaUploadField({ kind, value, onChange, label, onUploaded, hideUrlInput }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = LABELS[kind];

  async function sha256Hex(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Presigned-URL upload: get a signed PUT URL from our API (small JSON
  // request), then PUT the bytes straight to R2. Bypasses the Vercel 4.5 MB
  // request body limit. Used for audio; covers stay on the legacy path
  // because they're small and the dedupe round-trip would just add latency.
  async function uploadViaPresignedUrl(file: File) {
    const hash = (await sha256Hex(file)).slice(0, 24);

    const signRes = await fetch("/api/studio/media/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        hash,
        filename: file.name,
      }),
    });
    if (!signRes.ok) {
      const detail = await signRes.json().catch(() => ({} as { error?: string }));
      throw new Error(detail.error ?? `HTTP ${signRes.status}`);
    }
    const signed = (await signRes.json()) as {
      uploadUrl: string | null;
      publicUrl: string;
      key: string;
      cached: boolean;
    };

    if (signed.cached || !signed.uploadUrl) {
      setProgress(100);
      return { url: signed.publicUrl, key: signed.key, filename: file.name, size: file.size };
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.uploadUrl!);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 PUT falló (HTTP ${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error("Error de red durante la subida a R2."));
      xhr.send(file);
    });

    return { url: signed.publicUrl, key: signed.key, filename: file.name, size: file.size };
  }

  // Legacy flow: POST multipart/form-data to /api/studio/media/upload. Used
  // only for covers (small enough to fit under the Vercel body limit).
  async function uploadViaProxy(file: File) {
    const fd = new FormData();
    fd.append("file", file, file.name || `upload.${kind === "cover" ? "png" : "mp3"}`);
    fd.append("kind", kind);

    return await new Promise<{ url: string; key: string; filename: string; size: number }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/studio/media/upload");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(json);
            else reject(new Error(json?.error ?? `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Error de red durante la subida."));
        xhr.send(fd);
      }
    );
  }

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const result = kind === "audio" ? await uploadViaPresignedUrl(file) : await uploadViaProxy(file);
      onChange(result.url);
      onUploaded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.currentTarget.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === "file");
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
      e.preventDefault();
      void uploadFile(file);
    }
  }

  function clear() {
    onChange(null);
    setError(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && <label className="jm-field-label" style={{ margin: 0 }}>{label}</label>}

      <div
        className="jm-upload-zone"
        data-drag-over={dragOver || undefined}
        data-uploading={uploading || undefined}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={0}
      >
        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div className="jm-spinner jm-spinner--sm" />
            <span style={{ fontSize: 11, color: "var(--mx-fg-soft)" }}>
              Subiendo… {progress}%
            </span>
            <div className="jm-upload-progress">
              <div className="jm-upload-progress__fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--mx-muted)" }}>{labels.drag}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="jm-btn jm-btn-tone-teal jm-btn--sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {labels.upload}
              </button>
              {value && (
                <button type="button" className="jm-btn jm-btn--sm" onClick={clear}>
                  Quitar
                </button>
              )}
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT[kind]}
          onChange={onPick}
          style={{ display: "none" }}
        />
      </div>

      {!hideUrlInput && (
        <input
          className="jm-input jm-input--mono"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={kind === "cover" ? "https://...png" : "https://...mp3"}
        />
      )}

      {error && <div className="jm-ex__error" style={{ fontSize: 11 }}>{error}</div>}

      {value && !uploading && (
        <div style={{ marginTop: 2 }}>
          {kind === "cover" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="preview"
              style={{ maxWidth: 220, maxHeight: 140, borderRadius: "var(--r-md)", border: "1px solid var(--mx-border)" }}
            />
          ) : (
            <MiniPlayer src={value} width="100%" />
          )}
        </div>
      )}
    </div>
  );
}
