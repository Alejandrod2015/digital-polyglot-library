import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

/**
 * Compute a ThumbHash for a cover image URL.
 *
 * A ThumbHash is a ~25-byte encoding of a tiny blurred version of the image.
 * We store it (base64) on the story and ship it inside the mobile journey
 * payload so a card can render an instant blurred preview of the REAL cover on
 * cold start, with zero network round-trip, while the full image downloads and
 * disk-caches (expo-image `placeholder={{ thumbhash }}`).
 *
 * ThumbHash requires the source pixels to be at most 100x100, so we downscale
 * with sharp (fit: inside) before encoding. Returns the base64 string, or null
 * if the image can't be fetched/decoded (caller leaves the field null and the
 * client falls back to a plain skeleton).
 */
export async function computeCoverThumbhash(coverUrl: string): Promise<string | null> {
  try {
    const res = await fetch(coverUrl);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());

    const { data, info } = await sharp(input)
      .resize(100, 100, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hash = rgbaToThumbHash(info.width, info.height, data);
    return Buffer.from(hash).toString("base64");
  } catch {
    return null;
  }
}
