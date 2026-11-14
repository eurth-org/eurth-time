/**
 * The guide: how to build a believable history. Plain data, so the page can lay it out and the
 * tests can hold it to the house rules (British English, sources for every figure, a date).
 *
 * Every number here is from the real world and has a source in SOURCES. When you change a
 * figure, check it against its source and move `updated` on.
 */

/** The day the guide was last brought up to date, as an ISO date. */
export const GUIDE_UPDATED = '2026-11-14';

export const GUIDE_TITLE = 'How to build a believable history';

export const GUIDE_DESCRIPTION =
  'How to write a history that convinces: causes and consequences, parallel tracks, and how long reigns, wars and cathedrals really take. With sources.';

export const GUIDE_LEAD =
  'An invented history convinces when things happen for reasons, take as long as such things really take, and happen while other things are happening somewhere else. None of that needs talent. It needs a timeline and a few habits.';

export interface GuideSection {
  /** For links: /guide/#causes. */
  id: string;
  heading: string;
  paragraphs: string[];
  /** A short list after the paragraphs, when the section has one. */
  points?: string[];
}

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: 'backwards',
    heading: 'Start from today and work backwards',
    paragraphs: [
      'Everything odd about your nation today is something a past event left behind: a border that follows no river, a second language in the north, a holiday nobody can explain, a grudge against the neighbours. List those first. Each one is a question, and your history is the set of answers.',
      'Working backwards keeps a history honest. You only add an event because something later needs it, so nothing is there for decoration, and the timeline fills in where it matters most: close to the present, where your stories happen.',
    ],
  },
  {
    id: 'causes',
    heading: 'Causes and consequences',
    paragraphs: [
      'Ask two things of every event: because of what, and so what? The historian E. H. Carr called the study of history a study of causes, and a reader feels the lack of them at once. A war that starts for no reason and changes nothing reads as a list.',
      'Real consequences travel further than anyone planned. In April 1815 the volcano Tambora erupted in what is now Indonesia. The next year, 1816, is remembered as the Year Without a Summer: harvests failed across Europe and New England, grain prices soared and there were food riots. Kept indoors by the weather at Lake Geneva that June, Mary Shelley began Frankenstein. One eruption gave the world a famine, a wave of migration and a novel, on three different tracks.',
      'Consequences also arrive late. The Black Death reached Europe in 1347 and in four years killed perhaps a third to a half of the people there. The lasting effects came a generation on: with so few hands, labour grew dear, wages rose and old obligations loosened. The English Peasants’ Revolt came in 1381, thirty years after the plague had passed.',
    ],
    points: [
      'Give every large event at least two consequences: one within a year, one a generation later.',
      'Put at least one of them on another track. A famine in one nation is a grain boom in the next.',
      'If you cannot say what an event changed, cut it or make it a detail of something that mattered.',
    ],
  },
  {
    id: 'tracks',
    heading: 'Parallel tracks',
    paragraphs: [
      'Nothing happens alone. In January 1492 Granada fell and ended nearly eight centuries of Muslim rule in Iberia; in August of the same year, with the same crown’s money, Columbus sailed. While Rome was a republic, the Han ruled China. Seen one nation at a time, these are separate stories. Seen side by side, they are one world.',
      'That is what tracks are for, and it is an old idea. In 1765 Joseph Priestley drew two thousand famous lives as bars along a line of years, so that a student could see at a glance who was alive at the same time. Four years later his New Chart of History did the same for empires, stacked one above another. Every timeline since owes him the layout.',
      'Read your own timeline the same way: down as well as along. For each event, look at the tracks beside it. Who heard of it, and how soon? Who profited? Who was too busy with a war of their own to react? In a shared world this is where the best stories are found, because the answer is usually another player.',
    ],
  },
  {
    id: 'speeds',
    heading: 'Three speeds of time',
    paragraphs: [
      'The historian Fernand Braudel wrote his history of the Mediterranean at three speeds. Slowest is the time of geography: mountains, coasts, climate, the routes that trade must take. It barely moves in a thousand years. In the middle is the time of societies: economies, states, faiths, which rise and fall over generations. Fastest is the time of events: battles, treaties, coronations, the things chronicles record.',
      'A timeline has the same three layers. Eras are the slow ones, spans the middle, events the fast. A history made only of events is all surface: it has plenty of battles and no reason for them. If a track looks thin, add what was going on underneath: the long peace, the trade route, the dynasty, the century of bad harvests.',
    ],
  },
  {
    id: 'durations',
    heading: 'How long things really take',
    paragraphs: [
      'Invented histories are usually too tidy and too fast. Kings rule for fifty years each, wars last exactly ten, and a cathedral goes up between two chapters. The real figures are in the table below, and they are worth learning by heart.',
      'Three rules of thumb come out of them. A generation is 25 to 30 years, so a century holds three or four. A hereditary reign averages somewhere around 20 to 25 years, with wide variation: plan on five monarchs a century and make one of them last a few months. And living memory is about 80 years: anything older is known only from records and stories, which is when history turns into legend.',
      'News is the one people forget. Before the telegraph, word travelled at the speed of a horse or a ship, and distant events were learned of weeks or months late. Two armies fought the Battle of New Orleans in January 1815, fifteen days after the peace had been signed, because the news was still at sea. A timeline that zooms in to days shows this plainly: date the event, then date the day each capital found out.',
    ],
  },
  {
    id: 'doubt',
    heading: 'Say what you don’t know',
    paragraphs: [
      'Real chronologies are full of doubt, and wear it openly: c. 1650 for "about", a decade or a century where that is all the sources give. The further back, the vaguer, because records burn and memories simplify. A history in which a founding three thousand years ago is dated to the day, like last year’s election, feels false without the reader knowing why.',
      'So let precision fade with age. Give recent events their day and month, older ones a year, ancient ones "c." or a century. Better still, give the doubt a cause: an archive that burned, two chronicles that disagree, a king list with a suspicious gap. Uncertainty with a reason is worldbuilding.',
      'Remember too that eras are chosen by someone. The years we count were worked out by a monk, Dionysius Exiguus, in 525, and only became common after Bede used them two centuries later. Rome counted from its founding, the French Republic from its own first day. Who started your calendar, and what were they marking? Your neighbours may count from somewhere else entirely.',
    ],
  },
  {
    id: 'gaps',
    heading: 'Leave gaps',
    paragraphs: [
      'You do not have to fill every year. Real history has quiet centuries, lost records and stretches where nothing was written down because nothing went wrong. An empty stretch on a timeline is honest, and it is useful: it is room for a later idea, or for someone else’s.',
      'A good test is to hand the timeline to a friend and ask where they would set a story. If they point at a gap, the history is working.',
    ],
  },
];

/** A real-world length of time, for the table under "How long things really take". */
export interface Duration {
  kind: 'Reigns' | 'Dynasties' | 'Wars' | 'Building' | 'Journeys and news' | 'Change';
  what: string;
  took: string;
  note: string;
  /** The ids of the sources it rests on. */
  sources: string[];
}

export const DURATIONS: readonly Duration[] = [
  {
    kind: 'Reigns',
    what: 'An English or British monarch, 1066 to 2022',
    took: 'About 24 years on average',
    note: 'Forty monarchs in 956 years. The spread is the lesson: from a few months to seventy years.',
    sources: ['monarchs'],
  },
  { kind: 'Reigns', what: 'The longest verified reign of a sovereign: Louis XIV of France', took: '72 years', note: '1643 to 1715. He came to the throne aged four.', sources: ['monarchs'] },
  { kind: 'Reigns', what: 'A pope', took: 'About 7½ years on average', note: 'More than 260 popes in under 2,000 years. An office filled by election, usually with an old man, turns over three times as fast as a crown.', sources: ['popes'] },
  { kind: 'Reigns', what: 'Rome, 69 CE', took: 'Four emperors in one year', note: 'A succession crisis can run through rulers faster than coins can be struck for them.', sources: ['four-emperors'] },
  { kind: 'Dynasties', what: 'House of Romanov, Russia', took: '304 years', note: '1613 to 1917. Two to three centuries is a long, successful dynasty.', sources: ['dynasties'] },
  { kind: 'Dynasties', what: 'Qin dynasty, China', took: '15 years', note: '221 to 206 BCE. It unified China and outlived its founder by four years.', sources: ['dynasties'] },
  { kind: 'Dynasties', what: 'Ottoman dynasty', took: 'Over 600 years', note: 'About 1299 to 1922: among the longest-lived ruling houses, and rare.', sources: ['dynasties'] },
  { kind: 'Wars', what: 'Hundred Years’ War', took: '116 years', note: '1337 to 1453, but with truces lasting years. Long wars are a string of campaigns, not one long fight.', sources: ['wars'] },
  { kind: 'Wars', what: 'Thirty Years’ War', took: '30 years', note: '1618 to 1648. Long enough that soldiers at the end had not been born at the start.', sources: ['wars'] },
  { kind: 'Wars', what: 'Anglo-Zanzibar War', took: 'Under an hour', note: '27 August 1896, between 38 and 45 minutes. Wars can be very short when one side has the ships.', sources: ['zanzibar'] },
  { kind: 'Building', what: 'Notre-Dame de Paris', took: 'About 180 years', note: 'Begun in 1163, largely finished by 1345. Nobody who started it saw it done; nor did their grandchildren.', sources: ['cathedrals'] },
  { kind: 'Building', what: 'Cologne Cathedral', took: '632 years', note: 'Begun in 1248, finished in 1880, with nearly three centuries in between when no work was done and a crane stood on the unfinished tower.', sources: ['cathedrals'] },
  { kind: 'Building', what: 'Salisbury Cathedral, the main body', took: '38 years', note: '1220 to 1258. This is fast, and was thought so at the time.', sources: ['cathedrals'] },
  { kind: 'Journeys and news', what: 'Columbus’s first Atlantic crossing', took: 'Five weeks', note: 'From the Canary Islands on 6 September 1492 to landfall on 12 October.', sources: ['voyages'] },
  { kind: 'Journeys and news', what: 'The first voyage round the world', took: 'Nearly three years', note: 'September 1519 to September 1522. Of some 270 men who set out, 18 came home on the one ship left.', sources: ['voyages'] },
  { kind: 'Journeys and news', what: 'News of Trafalgar reaching London', took: '16 days', note: 'The battle was on 21 October 1805; the dispatch arrived on 6 November. That was good going.', sources: ['news'] },
  { kind: 'Journeys and news', what: 'A message from Rome to London under the empire', took: 'About four weeks', note: 'By the quickest route in summer, by the reckoning of Stanford’s ORBIS model. In winter, a good deal longer.', sources: ['orbis'] },
  { kind: 'Change', what: 'The printing press across Europe', took: 'About 50 years', note: 'From Gutenberg’s press around 1450 to presses in well over two hundred towns by 1500. Even a revolution takes two generations.', sources: ['printing'] },
  { kind: 'Change', what: 'The effects of the Black Death on wages and labour', took: 'A generation or more', note: 'The plague passed in four years; the changes it set off were still working through thirty years later.', sources: ['black-death'] },
];

/** A source: a book, a paper or a page. */
export interface Source {
  id: string;
  /** How it is cited, without the link. */
  citation: string;
  /** The title of a Wikipedia article, when that is the source. */
  wikipedia?: string;
  /** Any other address. */
  url?: string;
}

export const SOURCES: readonly Source[] = [
  { id: 'carr', citation: 'E. H. Carr, What Is History? (Macmillan, 1961): the chapter "Causation in History".' },
  { id: 'braudel', citation: 'Fernand Braudel, The Mediterranean and the Mediterranean World in the Age of Philip II (1949; English edition, Collins, 1972): the preface sets out the three speeds of time.' },
  { id: 'bloch', citation: 'Marc Bloch, The Historian’s Craft (1949; English edition, Manchester University Press, 1954): on evidence, doubt and how historians date things.' },
  { id: 'cartographies', citation: 'Daniel Rosenberg and Anthony Grafton, Cartographies of Time: A History of the Timeline (Princeton Architectural Press, 2010): Priestley’s charts and everything since.' },
  { id: 'priestley', citation: 'Joseph Priestley, A Chart of Biography (1765) and A New Chart of History (1769).', wikipedia: 'A New Chart of History' },
  { id: 'tambora', citation: 'Gillen D’Arcy Wood, Tambora: The Eruption That Changed the World (Princeton University Press, 2014).', wikipedia: 'Year Without a Summer' },
  { id: 'black-death', citation: 'Consequences of the Black Death, Wikipedia: population, wages and the revolts that followed.', wikipedia: 'Consequences of the Black Death' },
  { id: 'richards', citation: 'E. G. Richards, Mapping Time: The Calendar and Its History (Oxford University Press, 1998): how eras and year counts were chosen.' },
  { id: 'monarchs', citation: 'List of longest-reigning monarchs and List of English monarchs, Wikipedia.', wikipedia: 'List of longest-reigning monarchs' },
  { id: 'popes', citation: 'List of popes, Wikipedia.', wikipedia: 'List of popes' },
  { id: 'four-emperors', citation: 'Year of the Four Emperors, Wikipedia.', wikipedia: 'Year of the Four Emperors' },
  { id: 'dynasties', citation: 'List of dynasties, Wikipedia: founding and end dates of ruling houses.', wikipedia: 'List of dynasties' },
  { id: 'wars', citation: 'Hundred Years’ War and Thirty Years’ War, Wikipedia.', wikipedia: 'Hundred Years\' War' },
  { id: 'zanzibar', citation: 'Anglo-Zanzibar War, Wikipedia.', wikipedia: 'Anglo-Zanzibar War' },
  { id: 'cathedrals', citation: 'Notre-Dame de Paris, Cologne Cathedral and Salisbury Cathedral, Wikipedia: building histories.', wikipedia: 'Cologne Cathedral' },
  { id: 'voyages', citation: 'Voyages of Christopher Columbus and Magellan expedition, Wikipedia.', wikipedia: 'Magellan expedition' },
  { id: 'news', citation: 'Trafalgar Way, Wikipedia: the route and timing of the Trafalgar dispatch; Battle of New Orleans, Wikipedia.', wikipedia: 'Trafalgar Way' },
  { id: 'orbis', citation: 'Walter Scheidel and Elijah Meeks, ORBIS: The Stanford Geospatial Network Model of the Roman World.', url: 'https://orbis.stanford.edu/' },
  { id: 'printing', citation: 'Elizabeth L. Eisenstein, The Printing Press as an Agent of Change (Cambridge University Press, 1979).', wikipedia: 'Global spread of the printing press' },
];

/** Questions to ask of a timeline before showing it to anyone. */
export const CHECKLIST: readonly string[] = [
  'Does every large event have a cause on the timeline, and at least two consequences?',
  'Does at least one consequence land on another track?',
  'Are your reigns uneven: some long, some short, one a matter of months?',
  'Do wars, buildings and journeys take as long as the real ones in the table?',
  'Is there something slow under the events: an era, a trade, a dynasty?',
  'Do dates get vaguer as they get older, and is there a reason for the doubt?',
  'Is there a gap somewhere for a story nobody has thought of yet?',
];
