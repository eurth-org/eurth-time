/**
 * The visible range as a picture: a standalone SVG, drawn from the same layout the page uses.
 * The PNG export is this SVG drawn to a canvas, which the site does (svgToPicture in
 * @eurth/style).
 *
 * A picture can't use the suite's custom properties, so the colours are handed in as plain
 * values: the site takes them from @eurth/style's tokens (resolveColors) for the theme on
 * screen. This file holds no colour of its own.
 *
 * Nothing is told apart by colour alone: every span carries its label, an uncertain date is
 * drawn hollow or dashed, and the whole timeline is inside as words (<title> and <desc>).
 * Every text from the timeline is escaped: a title is someone else's input.
 */
import { labelShown, ticks, viewLabel, type TickOptions, type View } from './axis';
import { describeItem, describeTimeline, descriptionText } from './describe';
import type { DateEngine } from './engine';
import { fitText, layoutTimeline, LAYOUT_DEFAULTS, type LayoutOptions } from './layout';
import { LIMITS, type Timeline } from './model';

/** The colours and fonts of a picture, as plain values. */
export interface SvgTheme {
  /** Behind everything. */
  background: string;
  /** The panel the timeline sits on. */
  panel: string;
  /** Text, muted text, hairlines and stronger lines. */
  ink: string;
  muted: string;
  line: string;
  lineStrong: string;
  /** The fill of an event's marker. */
  marker: string;
  /** One fill and the text colour that goes on it for each tone a span can have. They differ in lightness. */
  tones: readonly { fill: string; ink: string }[];
  /** Font families: for words, and for dates and numbers. */
  sans: string;
  mono: string;
}

export interface SvgOptions {
  theme: SvgTheme;
  /** Whether to head the picture with the timeline's title and the stretch of time shown. Default true. */
  heading?: boolean;
  /** The width kept for the track names, and the space around everything. */
  gutter?: number;
  padding?: number;
  layout?: Partial<LayoutOptions>;
  ticks?: TickOptions;
}

/** Text made safe for XML, in an element or an attribute. Characters XML does not allow are dropped. */
export function escapeXml(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    out += char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '"' ? '&quot;' : char === "'" ? '&#39;' : char;
  }
  return out;
}

const n = (value: number): string => String(Math.round(value * 100) / 100);

/** The smallest text in a picture, as everywhere in the suite. */
const SIZE = 13;

/**
 * The picture of a timeline as it is in a view. `width` and `height` are its size in pixels;
 * the view's own width is the width of the axis, and the track names and the padding come on
 * top of it.
 */
export function timelineSvg(timeline: Timeline, engine: DateEngine, view: View, options: SvgOptions): { svg: string; width: number; height: number } {
  const { theme } = options;
  const o: LayoutOptions = { ...LAYOUT_DEFAULTS, ...options.layout };
  const padding = options.padding ?? 24;
  const gutter = options.gutter ?? 150;
  const heading = options.heading ?? true;
  const headingHeight = heading ? 60 : 0;
  const layout = layoutTimeline(timeline, engine, view, o);
  const description = describeTimeline(timeline, engine);
  const plotX = padding + gutter;
  const plotY = padding + headingHeight;
  const width = plotX + view.width + padding;
  const height = plotY + layout.height + padding;
  const tone = (index: number) => theme.tones[index % Math.max(1, theme.tones.length)] ?? { fill: theme.muted, ink: theme.background };
  const text = (x: number, y: number, content: string, attrs: string) => `<text x="${n(x)}" y="${n(y)}" ${attrs}>${escapeXml(content)}</text>`;
  const sans = `font-family="${escapeXml(theme.sans)}" font-size="${SIZE}"`;
  const mono = `font-family="${escapeXml(theme.mono)}" font-size="${SIZE}"`;
  const baseline = (y: number, h: number) => y + h / 2 + SIZE * 0.35;
  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" role="img" aria-labelledby="time-title time-desc">`,
    `<title id="time-title">${escapeXml(description.title)}</title>`,
    `<desc id="time-desc">${escapeXml(descriptionText(description))}</desc>`,
    `<rect width="${n(width)}" height="${n(height)}" fill="${theme.background}"/>`,
  );
  if (heading) {
    out.push(
      text(padding, padding + 22, fitText(description.title, width - 2 * padding, (t) => Array.from(t).length * 12), `font-family="${escapeXml(theme.sans)}" font-size="20" font-weight="700" fill="${theme.ink}"`),
      text(padding, padding + 44, viewLabel(engine, view), `${mono} fill="${theme.muted}"`),
    );
  }
  out.push(
    `<rect x="${n(padding / 2)}" y="${n(plotY - padding / 2)}" width="${n(width - padding)}" height="${n(layout.height + padding)}" rx="12" fill="${theme.panel}"/>`,
    `<clipPath id="time-plot"><rect x="0" y="0" width="${n(view.width)}" height="${n(layout.height)}"/></clipPath>`,
    `<g transform="translate(${n(plotX)} ${n(plotY)})">`,
  );

  // Track names and the lines between tracks.
  for (const track of layout.tracks) {
    out.push(
      `<line x1="${n(-gutter)}" y1="${n(track.y)}" x2="${n(view.width)}" y2="${n(track.y)}" stroke="${theme.line}"/>`,
      text(-gutter, track.y + o.trackPad + 20, fitText(track.name, gutter - 12, (t) => o.measure(t, true) * (14 / SIZE)), `font-family="${escapeXml(theme.sans)}" font-size="14" font-weight="700" fill="${theme.ink}"`),
    );
  }
  out.push(`<line x1="${n(-gutter)}" y1="${n(layout.axisY)}" x2="${n(view.width)}" y2="${n(layout.axisY)}" stroke="${theme.lineStrong}"/>`);

  out.push('<g clip-path="url(#time-plot)">');
  const top = layout.tracks[0]?.y ?? layout.axisY;
  for (const tick of ticks(engine, view, options.ticks)) {
    if (tick.opacity <= 0) continue;
    out.push(`<line x1="${n(tick.x)}" y1="${n(top)}" x2="${n(tick.x)}" y2="${n(layout.axisY + 5)}" stroke="${theme.line}" stroke-opacity="${n(tick.opacity)}"/>`);
    if (labelShown(tick)) out.push(text(tick.x, layout.axisY + 20, tick.label, `${mono} text-anchor="middle" fill="${theme.muted}"`));
  }

  for (const era of layout.eras) {
    const when = describeItem(timeline, engine, era.ref)?.when ?? '';
    out.push(
      `<g><title>${escapeXml(`${era.label}, ${when}`)}</title>`,
      `<line x1="${n(era.x)}" y1="${n(era.y + 4)}" x2="${n(era.x)}" y2="${n(era.y + era.h - 4)}" stroke="${theme.lineStrong}"/>`,
      era.text === '' ? '' : text(era.x + o.barPad, baseline(era.y, era.h), era.text, `${sans} font-weight="700" fill="${theme.muted}"`),
      '</g>',
    );
  }

  for (const track of layout.tracks) {
    for (const span of track.spans) {
      const colour = tone(span.tone);
      const when = describeItem(timeline, engine, span.ref)?.when ?? '';
      const solidX = span.x + span.softStart;
      const solidW = Math.max(0, span.w - span.softStart - span.softEnd);
      out.push(`<g><title>${escapeXml(`${span.label}, ${when}`)}</title>`);
      if (span.softStart > 0 || span.softEnd > 0) {
        // The uncertain ends: hollow, with a dashed edge, as an uncertain event's marker is hollow.
        out.push(`<rect x="${n(span.x + 1)}" y="${n(span.y + 1)}" width="${n(Math.max(1, span.w - 2))}" height="${n(span.h - 2)}" rx="6" fill="none" stroke="${colour.fill}" stroke-width="2" stroke-dasharray="4 3"/>`);
      }
      if (solidW > 0) out.push(`<rect x="${n(solidX)}" y="${n(span.y)}" width="${n(solidW)}" height="${n(span.h)}" rx="${span.softStart > 0 || span.softEnd > 0 ? 0 : 6}" fill="${colour.fill}"/>`);
      if (span.ongoing && span.w >= 28) {
        // Still going on: an arrowhead at the end of the bar.
        const x = span.x + span.w - 16;
        const y = span.y + span.h / 2;
        out.push(`<path d="M${n(x)} ${n(y - 6)}L${n(x + 7)} ${n(y)}L${n(x)} ${n(y + 6)}" fill="none" stroke="${colour.ink}" stroke-width="2"/>`);
      }
      if (span.place === 'inside') out.push(text(solidX + o.barPad, baseline(span.y, span.h), span.text, `${sans} font-weight="700" fill="${colour.ink}"`));
      else if (span.place === 'after') out.push(text(span.x + span.w + o.labelGap, baseline(span.y, span.h), span.text, `${sans} font-weight="700" fill="${theme.ink}"`));
      out.push('</g>');
    }
    for (const event of track.events) {
      const when = describeItem(timeline, engine, event.ref)?.when ?? '';
      const y = event.y + event.h / 2;
      const half = (o.marker * 0.72) / 2;
      out.push(`<g><title>${escapeXml(`${event.label}, ${when}`)}</title>`);
      if (event.to - event.from > o.marker) {
        // The stretch the date covers: "1846" is a year wide, "the 1830s" ten.
        const from = Math.max(event.from, -o.marker);
        const to = Math.min(event.to, view.width + o.marker);
        // A bracket under the marker, so that it never runs through the label.
        const under = y + o.marker / 2 + 2;
        out.push(`<path d="M${n(from)} ${n(under)}V${n(under + 5)}H${n(to)}V${n(under)}" fill="none" stroke="${theme.muted}" stroke-width="2"/>`);
      }
      const shape = `x="${n(event.x - half)}" y="${n(y - half)}" width="${n(2 * half)}" height="${n(2 * half)}" transform="rotate(45 ${n(event.x)} ${n(y)})"`;
      // An uncertain date is a hollow marker, a certain one a filled one.
      out.push(event.uncertain ? `<rect ${shape} fill="${theme.panel}" stroke="${theme.marker}" stroke-width="2"/>` : `<rect ${shape} fill="${theme.marker}"/>`);
      if (event.text !== '') out.push(text(event.x + o.marker / 2 + o.labelGap, baseline(event.y, event.h), event.text, `${sans} fill="${theme.ink}"`));
      out.push('</g>');
    }
  }
  out.push('</g>', '</g>', '</svg>');
  return { svg: out.filter((part) => part !== '').join(''), width, height };
}

/** A file name for an export: "history-of-the-oriental-coast". Plain letters, digits and hyphens. */
export function fileSlug(title: string, fallback = 'timeline'): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.title);
  return slug === '' ? fallback : slug;
}
