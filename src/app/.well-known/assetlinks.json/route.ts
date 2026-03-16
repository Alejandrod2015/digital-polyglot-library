import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getShaFingerprints() {
  const raw = process.env.GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET() {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  const fingerprints = getShaFingerprints();

  if (!packageName || fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
