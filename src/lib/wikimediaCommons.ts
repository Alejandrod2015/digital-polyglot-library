// /src/lib/wikimediaCommons.ts
//
// Photos for Talking Points come from Wikimedia Commons.
//
// WHY Commons and not Pexels/Unsplash/Pixabay: no API key, no per-app quota,
// no terms that can change under us, and the licence of every file is machine
// readable. The cost is that attribution is mandatory and must be rendered,
// which is why `TalkingPhoto` carries the author and the licence rather than
// just a URL. A photo whose credit we cannot state is a photo we do not use.
//
// The URL is stored in the catalogue, not fetched at render time. Searching
// Commons on every page view would be slow, would break the page when their
// API is down, and would let a file we never reviewed appear in the product.
// `scripts/_tpFindPhoto.ts` does the searching; a human picks; the result is
// pasted in.

/** Licences we accept. Anything else is not usable in a paid product. */
export const ALLOWED_COMMONS_LICENCES = [
  "cc0",
  "public domain",
  "pd",
  "cc by",
  "cc by-sa",
] as const;

export type TalkingPhoto = {
  /** Direct file URL on upload.wikimedia.org, already at a sane width. */
  url: string;
  /** Commons file page, shown as the credit link. */
  filePage: string;
  /** Author string as Commons reports it, tags stripped. */
  author: string;
  /** Short licence name, e.g. "CC BY-SA 4.0" or "Public domain". */
  licence: string;
  /** Alt text. Written by us, not taken from the file name. */
  alt: string;
  /** Real pixel size of the file, used to enforce the aspect rule below. */
  width: number;
  height: number;
};

/**
 * Minimum width-to-height ratio for a piece photo.
 *
 * The reader shows the image in a band that is `max-w-3xl` wide and 220-240px
 * tall, i.e. roughly 3.5:1. A portrait photograph rendered there is contained
 * to a narrow column with blurred filler either side: it reads as a mistake,
 * because it is one. 1.3 admits normal 3:2 and 16:9 photographs and rejects
 * squares and anything taller than wide.
 */
export const MIN_PHOTO_ASPECT = 1.3;

export function isLandscapeEnough(photo: TalkingPhoto): boolean {
  return photo.height > 0 && photo.width / photo.height >= MIN_PHOTO_ASPECT;
}

/**
 * True when the licence string is one we accept. Commons reports plenty of
 * variants ("CC BY-SA 3.0", "Public domain", "CC0"), so this matches on a
 * normalised prefix rather than an exact list.
 */
export function isAllowedCommonsLicence(licence: string): boolean {
  const l = licence.trim().toLowerCase();
  if (!l) return false;
  // Non-commercial and no-derivatives are unusable regardless of the prefix.
  if (l.includes("nc") || l.includes("nd") || l.includes("noncommercial")) {
    return false;
  }
  return ALLOWED_COMMONS_LICENCES.some((ok) => l.startsWith(ok));
}

/** One line of credit, e.g. "Foto: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons". */
export function photoCredit(photo: TalkingPhoto): string {
  return `${photo.author} · ${photo.licence} · Wikimedia Commons`;
}
