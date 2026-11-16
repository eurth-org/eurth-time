/**
 * Pictures made when the site is built: the examples as they look in Time, for the Examples
 * page and the sharing image. Their colours are the suite's Night theme, as plain values.
 */
import { resolveColors } from '@eurth/style';
import tokens from '@eurth/style/tokens.json';
import { fitView } from '../tool/axis';
import { describeTimeline } from '../tool/describe';
import { engineFor } from '../tool/engine';
import { extentOf } from '../tool/layout';
import { timelineLink } from '../tool/link';
import { timelineSvg } from '../tool/svg';
import { svgTheme } from '../tool/theme';
import type { Example } from './examples';

export const NIGHT = svgTheme(resolveColors(tokens, 'dark'), tokens.type.families);

/** An example drawn whole, with what it shows in words. */
export function examplePicture(example: Example, width = 900, heading = false): { svg: string; width: number; height: number; alt: string } {
  const engine = engineFor(example.timeline.calendar);
  const extent = extentOf(example.timeline, engine);
  const view = fitView(engine, extent ?? { first: 0, last: 365 }, width);
  const picture = timelineSvg(example.timeline, engine, view, { theme: NIGHT, heading, gutter: 130, padding: 16 });
  const description = describeTimeline(example.timeline, engine);
  return { ...picture, alt: `${description.title}. ${description.summary}` };
}

/** Where an example opens in the tool: the plain address for the first, which is what the tool starts with. */
export function exampleHref(example: Example, first: boolean): string {
  return first ? '/' : `/${new URL(timelineLink('https://time.eurth.org/', example.timeline, true)).search}`;
}
