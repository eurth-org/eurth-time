/**
 * Pictures on cards.
 *
 * A picture is carried, not linked: it is picked from the device, made small in the browser and
 * kept inside the timeline's own data, as a data: address. Time loads nothing from anywhere
 * else, which is the suite's first rule, and the content security policy would not let it. The
 * cost is that a timeline with pictures no longer fits in a link: it is saved as a profile file
 * (see link.ts, which says so plainly instead of leaving pictures behind).
 *
 * The caps, all in one place:
 *   - 640 pixels on the longest side, which is twice the width of a card;
 *   - 120,000 characters per picture as stored (about 90 KB of picture);
 *   - 12 pictures on a timeline, and 1,200,000 characters for all of them together, which
 *     leaves the rest of a profile file (2 MB at most) to everything else;
 *   - JPEG, PNG or WebP. No SVG, which can carry script, and no GIF.
 *
 * A picture from a file is someone else's input: cleanPicture lets through only a small data:
 * image of an allowed type whose first bytes are what its type says they are. The pixel cap is
 * kept when a picture is added (it is drawn to a canvas of that size, which also strips where
 * and when it was taken); a file edited by hand is held to the byte cap, and the card shows
 * every picture at card size whatever it claims to be.
 */

/** A picture on a card. Plain JSON. */
export interface Picture {
  /** The picture itself: "data:image/webp;base64,…". */
  data: string;
  /** What it shows, for whoever can't see it. Empty only when the picture is decorative. */
  alt: string;
  /** True for a picture that adds nothing the text doesn't say: it is passed over by screen readers and left out of the words. */
  decorative: boolean;
}

export const PICTURE_LIMITS = Object.freeze({
  /** The longest side of a picture, in pixels. */
  side: 640,
  /** The longest a picture may be as stored, in characters of its data: address. */
  length: 120_000,
  /** Most pictures on one timeline. */
  count: 12,
  /** The longest all of a timeline's pictures may be together, in characters. */
  total: 1_200_000,
  /** The longest description of a picture. */
  alt: 300,
});

/** The kinds of picture that are kept. */
export const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PictureType = (typeof PICTURE_TYPES)[number];

const SHAPE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Whether the first bytes of a picture are what its type says: a text file called a JPEG is not one. */
function startsRight(type: PictureType, base64: string): boolean {
  let head: string;
  try {
    head = atob(base64.slice(0, 24));
  } catch {
    return false;
  }
  const bytes = Array.from(head, (char) => char.charCodeAt(0));
  const starts = (...expected: number[]) => expected.every((byte, i) => bytes[i] === byte);
  if (type === 'image/jpeg') return starts(0xff, 0xd8, 0xff);
  if (type === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  return starts(0x52, 0x49, 0x46, 0x46) && head.slice(8, 12) === 'WEBP';
}

/** The type of a stored picture, or null when it is not a picture Time keeps. */
export function pictureType(data: unknown): PictureType | null {
  if (typeof data !== 'string' || data.length > PICTURE_LIMITS.length) return null;
  const found = SHAPE.exec(data);
  if (!found || found[2]!.length % 4 !== 0) return null;
  const type = found[1] as PictureType;
  return startsRight(type, found[2]!) ? type : null;
}

/** Why a picture from a file was turned away, in words for the person; null when it is fine. */
export type PictureProblem = 'not-a-picture' | 'no-description';

const plain = (value: unknown, max: number): string =>
  typeof value === 'string'
    ? Array.from(value.replace(/\s+/g, ' ').trim())
        .filter((char) => char >= ' ' && char !== String.fromCharCode(127))
        .slice(0, max)
        .join('')
        .trim()
    : '';

/**
 * A picture from anywhere, checked: a small data: image of an allowed type, with a description
 * or marked as decorative. Anything else is turned away, and `problem` says which rule it broke.
 */
export function cleanPicture(input: unknown): { picture: Picture; problem: null } | { picture: null; problem: PictureProblem } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { picture: null, problem: 'not-a-picture' };
  const raw = input as Record<string, unknown>;
  if (pictureType(raw.data) === null) return { picture: null, problem: 'not-a-picture' };
  const decorative = raw.decorative === true;
  const alt = decorative ? '' : plain(raw.alt, PICTURE_LIMITS.alt);
  if (!decorative && alt === '') return { picture: null, problem: 'no-description' };
  return { picture: { data: raw.data as string, alt, decorative }, problem: null };
}

/** The size a picture is drawn at: inside the cap, never enlarged, its shape kept. */
export function fitWithin(width: number, height: number, side: number = PICTURE_LIMITS.side): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  const scale = Math.min(1, side / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The steps tried, in order, to bring a picture under the byte cap: first less quality, then
 * fewer pixels. The first that fits is kept.
 */
export const SHRINK_STEPS: readonly { side: number; quality: number }[] = [
  { side: 640, quality: 0.82 },
  { side: 640, quality: 0.68 },
  { side: 520, quality: 0.68 },
  { side: 420, quality: 0.6 },
  { side: 320, quality: 0.55 },
  { side: 240, quality: 0.5 },
];

/** What a card says of its picture in words: its description, or nothing for a decorative one. */
export const pictureWords = (picture: Picture | null): string => (picture === null || picture.decorative ? '' : picture.alt);
