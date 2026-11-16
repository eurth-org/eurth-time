// What this tool is called and where it lives. Read at build time only: astro.config.mjs, the
// frontmatter of .astro pages, tests and tools/. Never import this from a Svelte component or a
// <script>: it pulls in the list of every Eurth tool, and browser code must not carry that
// (HANDBOOK.md, Launch). Hand the component what it needs as props instead.
import { defineSite } from '@eurth/style/build';

export const site = defineSite({
  // The subdomain, and the tool's id in @eurth/style's tools.json.
  id: 'time',
  name: 'Time',
  url: 'https://time.eurth.org',
  // "<Name>: free online <thing> maker for worldbuilders"
  title: 'Time: free online history timeline maker for worldbuilders',
  description:
    'A free online history timeline maker for worldbuilders: nations, dynasties and a shared world side by side, dated in your own calendar, from millennia down to days. No account needed.',
  tagline: 'Your history, on a timeline',
  pages: [
    { href: '/', label: 'Timeline' },
    { href: '/examples/', label: 'Examples' },
    { href: '/guide/', label: 'Guide' },
    { href: '/glossary/', label: 'Glossary' },
  ],
  repo: 'https://github.com/eurth-org/eurth-time',
  ogAlt: 'Time, history timelines for fictional worlds, at time.eurth.org: the Eurth yurt beside a timeline of four tracks with reigns, a war and a treaty.',
});
