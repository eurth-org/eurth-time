import type { SvgTheme } from '../../src/tool/svg';

/** A theme for the tests only. The site takes its colours from @eurth/style's tokens. */
export const TEST_THEME: SvgTheme = {
  background: '#000001',
  panel: '#000002',
  ink: '#000003',
  muted: '#000004',
  line: '#000005',
  lineStrong: '#000006',
  marker: '#000007',
  tones: [
    { fill: '#0000a0', ink: '#0000b0' },
    { fill: '#0000a1', ink: '#0000b1' },
    { fill: '#0000a2', ink: '#0000b2' },
    { fill: '#0000a3', ink: '#0000b3' },
    { fill: '#0000a4', ink: '#0000b4' },
    { fill: '#0000a5', ink: '#0000b5' },
  ],
  sans: 'system-ui, Arial, sans-serif',
  mono: 'ui-monospace, Menlo, monospace',
};

/**
 * Checks that a text is well-formed XML as far as an SVG needs: every tag closed in order,
 * every attribute quoted, no stray < or &. Returns the names of the elements, in order.
 */
export function readXml(xml: string): string[] {
  const names: string[] = [];
  const open: string[] = [];
  let at = 0;
  while (at < xml.length) {
    const lt = xml.indexOf('<', at);
    const between = xml.slice(at, lt < 0 ? xml.length : lt);
    if (/&(?!(?:amp|lt|gt|quot|#39);)/.test(between)) throw new Error(`Bare & in text: ${between.slice(0, 40)}`);
    if (between.includes('>')) throw new Error(`Bare > in text: ${between.slice(0, 40)}`);
    if (lt < 0) break;
    const gt = xml.indexOf('>', lt);
    if (gt < 0) throw new Error('Unclosed tag');
    const tag = xml.slice(lt + 1, gt);
    if (tag.startsWith('/')) {
      const name = tag.slice(1);
      if (open.pop() !== name) throw new Error(`Closed ${name} out of turn`);
    } else {
      const found = /^([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)$/.exec(tag);
      if (!found) throw new Error(`Malformed tag: <${tag.slice(0, 60)}>`);
      if (/&(?!(?:amp|lt|gt|quot|#39);)/.test(found[2]!)) throw new Error(`Bare & in attribute: ${tag.slice(0, 60)}`);
      names.push(found[1]!);
      if (found[3] !== '/') open.push(found[1]!);
    }
    at = gt + 1;
  }
  if (open.length > 0) throw new Error(`Left open: ${open.join(', ')}`);
  return names;
}

/** Reads CSV as RFC 4180 has it: quoted cells, doubled quotes, CRLF. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);
  return rows;
}
