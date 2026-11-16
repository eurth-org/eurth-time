/**
 * Three invented histories, each dated in a different calendar: the Gregorian calendar, a
 * thirteen-month calendar tied to Earth, and the calendar of another world with no tie to
 * Earth at all. They are the Examples page, the starting points of the tool, and what the
 * tests render and export.
 *
 * Dates are written in the compact form (see encodeDate): "1789" a year, "1789-6-14" a day,
 * "~1640" about 1640, "1830D" the 1830s, "301C" the 4th century, "5-i1-1" day 1 of the first
 * block of days outside the months.
 */
import { normalizeTimeline } from '../tool/normalize';
import type { Timeline } from '../tool/model';
import { KHARAN, SELUNNAN } from './calendars';

export interface Example {
  /** A short id for links: /examples/#oriental-coast. */
  id: string;
  /** What kind of history it is and what to notice. */
  pitch: string;
  /** The name of the calendar, for the page. */
  calendarName: string;
  timeline: Timeline;
}

const example = (id: string, pitch: string, calendarName: string, raw: unknown): Example => {
  const { timeline, issues } = normalizeTimeline(raw);
  if (issues.length > 0) throw new Error(`Example "${id}" is not clean: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join(' ')}`);
  return { id, pitch, calendarName, timeline };
};

const ORIENTAL_COAST = {
  title: 'History of the Oriental Coast',
  calendar: null,
  eras: [
    { label: 'Age of Sail', from: '1600', to: '1820' },
    { label: 'Industrial age', from: '1821', to: '1913' },
    { label: 'Modern era', from: '1914', to: null },
  ],
  tracks: [
    {
      name: 'Teland',
      kind: 'nation',
      spans: [
        {
          label: 'House Delmaris',
          from: '1622',
          to: '1870',
          tone: 0,
          text: 'Merchant-princes who ran Teland like a counting house: profitably, and with very little patience for poetry.',
        },
        {
          label: 'Republic of Teland',
          from: '1871',
          to: null,
          tone: 1,
          text: 'Proclaimed after the Lantern Revolt. The last Delmaris left by the harbour gate with the silver and, it is said, the good chairs.',
        },
      ],
      events: [
        { title: 'Port Delmar is founded', date: '~1622', text: 'A trading post on the river mouth. The exact year was lost with the first harbour ledger.' },
        { title: 'The Lantern Revolt', date: '1869-3-18', text: 'Dock workers march on the palace by lantern light. Eleven days later the prince agrees to an assembly.' },
        { title: 'The first Assembly sits', date: '1871-1-9', text: 'Two hundred and four members, one of whom is still remembered for sleeping through the oath.' },
        { title: 'Every adult gets the vote', date: '1923', text: '' },
      ],
    },
    {
      name: 'Ostaril',
      kind: 'dynasty',
      spans: [
        {
          label: 'Kingdom of Ostaril · House Varenko',
          from: '~1640',
          to: null,
          tone: 2,
          text: 'One house on the throne for nearly four centuries, which is long by any measure and takes some explaining: see the Great Charter.',
        },
      ],
      events: [
        { title: 'Vasil I is crowned', date: '~1640', text: 'The chronicles disagree by a year or two, and each is certain.' },
        { title: 'The Great Charter of Ostaril', date: '1754', text: 'The crown keeps the throne and gives up the treasury. Both sides claim the better half.' },
        { title: 'Serfdom is abolished', date: '1861', text: '' },
      ],
    },
    {
      name: 'Coastal League',
      kind: 'other',
      spans: [
        {
          label: 'Coastal War era',
          from: '1702',
          to: '1789',
          tone: 3,
          text: 'Not one war but six, with truces between them long enough to rebuild the fleets.',
        },
      ],
      events: [
        { title: 'The League is sworn at Selunna', date: '1688', text: 'Nine free ports agree to share convoys, tolls and enemies.' },
        {
          title: 'Treaty of Selunna',
          date: '1789',
          text: 'Ends the Coastal War. Teland cedes the Ostaril isles; the League gains free passage through the straits.',
          links: [{ label: 'Eurth forums', url: 'https://eurth.org/' }],
        },
        { title: 'The League quietly dissolves', date: '1830D', text: 'Nobody signed anything. The ports simply stopped sending delegates, one by one, over about ten years.' },
      ],
    },
    {
      name: 'Shared world',
      kind: 'world',
      spans: [{ label: 'Continental War', from: '1914', to: '1919', tone: 4, text: 'Every nation on the coast is drawn in within the first year.' }],
      events: [
        { title: 'A comet with three tails', date: '1701C', text: 'Seen from every port on the coast, and blamed for most of what followed. Sources agree on the century and little else.' },
        { title: 'Great Famine', date: '1846', text: 'Three wet summers in a row. Grain prices triple, and the roads fill with people walking to the ports.' },
        { title: 'First orbital flight', date: '1961-4-12', text: 'One orbit, 108 minutes.' },
      ],
    },
  ],
};

const SELUNNA = {
  title: 'Chronicle of Selunna',
  calendar: SELUNNAN,
  eras: [
    { label: 'Before the Founding', from: '-399', to: '0' },
    { label: 'The Compact', from: '1', to: '312' },
    { label: 'The Lantern Age', from: '313', to: '780' },
    { label: 'The Long Peace', from: '781', to: null },
  ],
  tracks: [
    {
      name: 'Selunna',
      kind: 'nation',
      spans: [
        { label: "The Founders' Compact", from: '1-1-1', to: '312', tone: 0, text: 'Thirteen families, thirteen months, one vote each. It lasted longer than anyone expected, including the families.' },
        { label: 'Kingdom of Selunna', from: '313', to: null, tone: 1, text: 'The Compact asks House Ardent to keep the peace for one year. The year has not ended yet.' },
      ],
      events: [
        { title: 'The Founding', date: '1-1-1', text: 'The first day of the first Frostmoon. The reckoning counts from here.' },
        { title: 'The first Midyear Day is kept', date: '5-i1-1', text: 'A day that belongs to no month and no week, added so that the months stay true. Nobody works; it would be bad arithmetic.' },
        { title: 'The Harvest Fair is chartered', date: '212-9-9', text: '' },
        { title: 'The Lantern Charter', date: '780-9-21', text: "Signed on Founders' Day. The crown is put under the law, and the law is written down where people can read it." },
        { title: 'The railway reaches the coast', date: '961-4', text: '' },
      ],
    },
    {
      name: 'House Ardent',
      kind: 'dynasty',
      spans: [
        { label: 'Maelis I', from: '313', to: '351-10-3', tone: 2, text: 'First of the house. Thirty-eight years, which set a standard her heirs found tiring.' },
        { label: 'Corvan the Brief', from: '351-10-3', to: '352-2-3', tone: 3, text: 'Five months and a bad winter.' },
        { label: 'Maelis II', from: '352-2-3', to: '389', tone: 2, text: '' },
        { label: 'Edric the Builder', from: '389', to: '~420', tone: 3, text: 'The records of his last years burned with the old archive, so the end of the reign is a careful guess.' },
      ],
      events: [{ title: 'The old archive burns', date: '~421', text: 'Which is why so much before this date is marked "c."' }],
    },
    {
      name: 'The wider world',
      kind: 'world',
      spans: [{ label: 'The Long Winter', from: '~140', to: '~146', tone: 4, text: 'Six hard years, give or take one at either end.' }],
      events: [
        { title: 'Standing stones are raised in the Selun valley', date: '-399C', text: 'Some time in the 4th century Before the Founding. The stones are not saying.' },
        { title: 'Ships first cross the Sundering Sea', date: '~-11', text: '' },
        { title: 'The Red Tide', date: '590D', text: 'A sickness of the fishing ports, some time in the 590s. It came and went with the trade winds.' },
      ],
    },
  ],
};

const KHARA = {
  title: 'The Long Count of Khara',
  calendar: KHARAN,
  eras: [
    { label: 'The unwritten ages', from: '-40000', to: '0' },
    { label: 'The Counting', from: '1', to: '213' },
    { label: 'The League of Three Moons', from: '214', to: null },
  ],
  tracks: [
    {
      name: 'The nine cities',
      kind: 'nation',
      spans: [
        { label: 'Hegemony of Dunn', from: '40', to: '187', tone: 0, text: 'One city taxes the other eight and calls it protection.' },
        { label: 'The Quarrel', from: '187', to: '214-i2-1', tone: 1, text: 'Twenty-seven long years of nine cities each certain it should lead.' },
        { label: 'League of Three Moons', from: '214-i2-1', to: null, tone: 2, text: 'Sworn at Duskturn, the last day of the year, so that the new year could begin without the old argument.' },
      ],
      events: [
        { title: 'The Count begins', date: '1-i1-1', text: 'Dawnturn of year 1. The priests of Arrak agree on a first day; agreeing on anything else takes another forty years.' },
        { title: 'The Duskturn Accord', date: '214-i2-1', text: '' },
        { title: 'All three moons are full at once', date: '233-5-17', text: 'Aru, Besh and Tolu together, or near enough for the priests. The next time is worked out to be about nineteen hundred years off, and a festival is planned anyway.' },
      ],
    },
    {
      name: 'The caravan roads',
      kind: 'other',
      spans: [
        { label: 'The Salt Road', from: '60', to: '~300', tone: 3, text: 'It was never closed. The wells failed one by one and the caravans stopped coming.' },
        { label: 'The Glass Road', from: '250', to: null, tone: 4, text: '' },
      ],
      events: [
        { title: 'First caravans cross the Glass Waste', date: '-800D', text: 'Told in every city, each with its own ancestors in front.' },
        { title: 'The great well at Hadd is dug', date: '61-8', text: '' },
      ],
    },
    {
      name: 'Sky and land',
      kind: 'world',
      spans: [],
      events: [
        { title: 'The ice leaves the Jurn valley', date: '~-40000', text: '' },
        { title: 'A sky-stone falls at Chol', date: '~-12000', text: 'The crater is still there. The city was built inside it, on the reasoning that it would not happen twice.' },
      ],
    },
  ],
};

/** The examples, in the order the page shows them. */
export const EXAMPLES: readonly Example[] = Object.freeze([
  example(
    'oriental-coast',
    'Four tracks side by side in the Gregorian calendar: two nations, a league and the shared world, with a treaty that only makes sense when you see all four.',
    'Gregorian calendar',
    ORIENTAL_COAST,
  ),
  example(
    'selunna',
    'A kingdom dated in its own reckoning: thirteen months of 28 days, a Midyear Day outside the months, years counted back from the Founding, and reigns exact to the day beside others that are honest guesses.',
    'Selunnan Reckoning',
    SELUNNA,
  ),
  example(
    'khara',
    'Another world: a year of 412 days, no link to Earth, and a history that runs from a sky-stone forty thousand years back to an accord signed on the last day of a year.',
    'Kharan Long Year',
    KHARA,
  ),
]);

/** An example by its id. */
export const exampleById = (id: string): Example | undefined => EXAMPLES.find((item) => item.id === id);
