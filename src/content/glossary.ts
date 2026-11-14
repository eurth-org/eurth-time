/**
 * The glossary: the words Time and its guide use, in a sentence or two each. Plain data in the
 * shape @eurth/style's definedTermSet() takes, in alphabetical order.
 */

export interface Term {
  /** For links: /glossary/#regnal-year. */
  id: string;
  term: string;
  definition: string;
}

export const GLOSSARY_TITLE = 'Glossary of history and timeline terms';

export const GLOSSARY_DESCRIPTION =
  'The words used in Time and its guide, explained in a sentence or two: era, epoch, regnal year, interregnum, circa, floruit, anachronism and more.';

export const TERMS: readonly Term[] = [
  { id: 'anachronism', term: 'Anachronism', definition: 'Something placed in a time where it does not belong: a clock striking in ancient Rome, a railway before anyone has made steel. A timeline is the quickest way to catch one.' },
  { id: 'annals', term: 'Annals', definition: 'A record kept year by year, each entry saying what happened in that year and no more. The oldest histories of many nations are annals.' },
  { id: 'bce-and-ce', term: 'BCE and CE', definition: 'Before the Common Era and Common Era: the labels for years before and from year 1 of the Gregorian calendar. They mean the same years as BC and AD.' },
  { id: 'calendar-era', term: 'Calendar era', definition: 'The count of years a calendar uses, and the event it counts from: the founding of a city, the first year of a republic, the birth of a prophet. Its label is written after the year, as in 1022 FS.' },
  { id: 'chronicle', term: 'Chronicle', definition: 'A history told in the order things happened, usually by someone close to the events and seldom neutral about them.' },
  { id: 'chronology', term: 'Chronology', definition: 'The order of events in time, and the work of establishing it: which reign came first, how long it lasted, what year a battle really fell in.' },
  { id: 'circa', term: 'Circa', definition: 'Latin for "about", written c. before a date that is known only roughly: c. 1650. Time draws such a date with a hollow marker or a dashed end.' },
  { id: 'deep-time', term: 'Deep time', definition: 'Time on the scale of geology and the stars: millions and thousands of millions of years. The universe is about 13.8 thousand million years old; written history covers the last five thousand.' },
  { id: 'dynasty', term: 'Dynasty', definition: 'A line of rulers from one family, and the time they ruled. Most last two or three centuries; a few last far longer, and some do not outlive their founder.' },
  { id: 'epoch', term: 'Epoch', definition: 'The moment a calendar counts from: day 1 of year 1. Also used loosely for a long period of history.' },
  { id: 'era', term: 'Era', definition: 'A long stretch of history with a character of its own: an Age of Sail, a Long Peace. In Time, eras run across the top of the timeline, above every track.' },
  { id: 'event', term: 'Event', definition: 'Something that happened at one point in time: a battle, a treaty, a coronation. In Time, an event has a single date, which may be exact or rough.' },
  { id: 'floruit', term: 'Floruit', definition: 'Latin for "flourished", written fl. before the years in which a person is known to have been active, when their birth and death are not known: fl. 1320 to 1345.' },
  { id: 'generation', term: 'Generation', definition: 'The time from the birth of parents to the birth of their children: 25 to 30 years as a rule of thumb. A century holds three or four.' },
  { id: 'gregorian-calendar', term: 'Gregorian calendar', definition: 'The calendar most of the world uses: twelve months, 365 days, and a leap day every fourth year except in century years that do not divide by 400. Time uses it when a timeline has no calendar of its own.' },
  { id: 'intercalary-day', term: 'Intercalary day', definition: 'A day added to keep a calendar in step with the seasons or the moon. In some calendars it belongs to no month at all, like a midyear day or the festival days at the end of a year.' },
  { id: 'interregnum', term: 'Interregnum', definition: 'The gap between two reigns or two governments, when nobody holds the throne or the office. On a timeline it is the space between two spans, and usually the most interesting part.' },
  { id: 'living-memory', term: 'Living memory', definition: 'The time that people still alive can remember: about eighty years. Anything older is known only from records and stories.' },
  { id: 'longue-duree', term: 'Longue durée', definition: 'French for "the long term": the historian Fernand Braudel’s name for the slowest layer of history, shaped by geography and climate, which changes over centuries where events change over days.' },
  { id: 'periodisation', term: 'Periodisation', definition: 'Dividing history into named periods. The divisions are chosen by historians afterwards; nobody living in the Middle Ages thought they were in the middle of anything.' },
  { id: 'primary-source', term: 'Primary source', definition: 'A record made at the time by someone who was there: a letter, a ledger, an inscription, a treaty. Everything written later from such records is a secondary source.' },
  { id: 'proleptic-calendar', term: 'Proleptic calendar', definition: 'A calendar run backwards to dates before it was first used. Time runs every calendar proleptically, so a date can always be given, however early.' },
  { id: 'regnal-year', term: 'Regnal year', definition: 'A year counted from the start of a monarch’s reign: "in the fourth year of Queen Maelis". Many states dated their documents this way, which is why historians need lists of reigns.' },
  { id: 'reign', term: 'Reign', definition: 'The time one monarch rules. Hereditary reigns average roughly 20 to 25 years, but vary from days to seventy years.' },
  { id: 'span', term: 'Span', definition: 'In Time, anything with a start and an end: a reign, a war, the life of a state. It is drawn as a bar that carries its own label, and it may still be going on.' },
  { id: 'synchronism', term: 'Synchronism', definition: 'Two events in different places known to have happened at the same time, which lets two separate chronologies be tied together. Eclipses are the classic case.' },
  { id: 'terminus-ante-quem', term: 'Terminus ante quem', definition: 'Latin for "the limit before which": the latest date something can have happened. A coin found under a floor was struck before the floor was laid.' },
  { id: 'terminus-post-quem', term: 'Terminus post quem', definition: 'Latin for "the limit after which": the earliest date something can have happened. A letter that mentions a battle was written after it.' },
  { id: 'timeline', term: 'Timeline', definition: 'Events laid out along a line that stands for time, so that order, length and overlap can be seen at a glance. The layout with lives as bars dates from Joseph Priestley’s chart of 1765.' },
  { id: 'track', term: 'Track', definition: 'In Time, one row of the timeline with a subject of its own: a nation, a dynasty, the shared world. Tracks run side by side so that what happened at the same time lines up.' },
  { id: 'year-zero', term: 'Year zero', definition: 'A year numbered 0. The BCE and CE count has none: 1 BCE is followed by 1 CE. Astronomers add one to make the arithmetic work, and so do calendars that have no name for the time before their first year.' },
];
