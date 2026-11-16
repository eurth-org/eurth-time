/**
 * Time's colours, all of them tokens of @eurth/style: which token a tone is, what the picker
 * calls it, and the theme of an exported picture. No colour value is written here or anywhere
 * else in Time.
 *
 * A span's tone is one of the suite's text colours used as a fill, with the page's own surface
 * colour for the words on it. Each of those tokens is held to 7:1 against the surface in both
 * themes by the suite's contrast test, so a label on a bar reads as well as text on the page.
 * The tones are never the only difference between two spans: every span carries its label.
 */
import type { SvgTheme } from './svg';

/** The token behind each tone, and the word the tone picker shows beside its swatch. */
export const TONES = [
  { token: 'accent-text', name: 'Blue' },
  { token: 'caution-text', name: 'Ochre' },
  { token: 'ink-muted', name: 'Grey' },
  { token: 'success-text', name: 'Green' },
  { token: 'danger-text', name: 'Red' },
  { token: 'ink', name: 'Ink' },
] as const;

/** The token for the words on a span, whatever its tone. */
export const ON_TONE = 'surface';

/** The pairs to add to the suite's contrast test: the words on each tone, at the 7:1 of body text. */
export const TONE_PAIRS: [string, string, number][] = TONES.map((tone) => [ON_TONE, tone.token, 7]);

/**
 * The theme of an exported picture, from the suite's colours as plain values
 * (resolveColors(tokens, 'dark') in @eurth/style) and its two font families.
 */
export function svgTheme(colors: Record<string, string>, fonts: { sans: string; mono: string }): SvgTheme {
  const colour = (token: string): string => {
    const value = colors[token];
    if (value === undefined) throw new Error(`@eurth/style has no colour called "${token}"`);
    return value;
  };
  return {
    background: colour('surface'),
    panel: colour('surface-raised'),
    ink: colour('ink'),
    muted: colour('ink-muted'),
    line: colour('line'),
    lineStrong: colour('line-strong'),
    marker: colour('ink'),
    tones: TONES.map((tone) => ({ fill: colour(tone.token), ink: colour(ON_TONE) })),
    sans: fonts.sans,
    mono: fonts.mono,
  };
}
