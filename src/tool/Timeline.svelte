<script lang="ts">
  /*
   * Time, the tool: one Svelte component, hydrated on the start page and, read-only, on the
   * embed page. It holds the state and the wiring; the logic is in the plain modules beside it
   * (model, axis, layout, describe, link, profile and the exports), which is where the tests are.
   *
   *   - the timeline lives in the link (?t=… and ?cal=…), read safely on arrival and kept in
   *     step after; a timeline too long for a link is saved in the nation's profile file;
   *   - nothing is stored: undo is a list of timelines in memory, for this visit only;
   *   - everything on the chart is also there as words, with a full-size button for each thing;
   *   - only tokens and eu- classes: no colour, font or spacing of its own.
   */
  import {
    faArrowDown,
    faArrowUp,
    faCheck,
    faCode,
    faDownload,
    faExpand,
    faFileImport,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faPen,
    faPlus,
    faPrint,
    faRotateLeft,
    faRotateRight,
    faTable,
    faTrash,
    faXmark,
  } from '@fortawesome/free-solid-svg-icons';
  import { createProfile, getSection, pickProfile, setSection, type EurthProfile } from '@eurth/profile';
  import ProfileButtons from '@eurth/profile/ProfileButtons.svelte';
  import { PICTURE_SIZES, calm, copyText, download, fileSlug, getPrefs, resolveColors, svgToPicture, toast } from '@eurth/style';
  import Icon from '@eurth/style/components/Icon.svelte';
  import ShareButtons from '@eurth/style/components/ShareButtons.svelte';
  import tokens from '@eurth/style/tokens.json';
  import { onMount } from 'svelte';
  import { EXAMPLES } from '../content/examples';
  import { clampView, defaultView, fitView, panView, resizeView, viewLabel, viewPrecision, xOf, zoomView, type View } from './axis';
  import Chart from './Chart.svelte';
  import { canConvert, convertDate, convertTimeline, sameCalendar } from './convert';
import { timelineCsv, timelineFromCsv } from './csv';
  import { calendarName, countLine, describeItem, describeTimeline, descriptionText, formatStretch } from './describe';
  import { embedCode, embedHeight, embedLink } from './embed';
  import { GREGORIAN_CALENDAR, engineFor, type CalendarData } from './engine';
  import { dateOfDay, dateRange, formatDate, isBeforeBigBang, parseDate, type FuzzyDate } from './fuzzy';
  import { canRedo, canUndo, record, redo, startHistory, undo } from './history';
  import { extentOf, guessWidth, type LayoutOptions } from './layout';
  import { encodeTimeline, linkFits, timelineFromLink, timelineLink } from './link';
  import { LIMITS, TRACK_KINDS, emptyTimeline, getItem, sameRef, titleOf, type Ref, type Timeline, type Track, type TrackKind } from './model';
  import { KEY_HELP, move, navOrder, revealView, type KeyAction } from './nav';
  import { cleanUrl } from './normalize';
import { SHEET_CHOICES, printSheets } from './print';
  import { addEra, addEvent, addSpan, addTrack, addedLine, appendTracks, mergeTimeline, moveItem, moveTrack, removeItem, removeTrack, setAlso, setCalendar, setTitle, updateItem, updateTrack } from './ops';
  import { readProfile, toProfileSection } from './profile';
import { reviewTimeline } from './review';
  import { pictureName, timelineSvg } from './svg';
  import { TONES, svgTheme } from './theme';
  import { timelineWikitext } from './wikitext';

  // Passed in by the page: browser code never imports eurth.config.mjs (see the note there).
  let {
    siteName,
    siteUrl,
    embed = false,
    calendarMaker = null,
  }: {
    siteName: string;
    /** The site's own address, without a slash at the end. */
    siteUrl: string;
    /** The read-only timeline of the embed page. */
    embed?: boolean;
    /** The calendar maker's address, once it has launched; the page knows, the browser must not guess. */
    calendarMaker?: string | null;
  } = $props();

  /** What the plain address opens: the first example, so that a newcomer sees a timeline and not an empty box. */
  const START = EXAMPLES[0]!.timeline;
  const START_PACKED = encodeTimeline(START);

  /** The chart on a screen: rows tall enough to press, labels in the suite's 14-pixel type. */
  const SCREEN: Partial<LayoutOptions> = { eraHeight: 44, spanHeight: 44, eventHeight: 44, rowGap: 6, trackPad: 10, axisHeight: 40, marker: 16, labelGap: 8, barPad: 12 };

  let story = $state.raw(startHistory<Timeline>(embed ? emptyTimeline() : START));
  let width = $state(1000);
  let view = $state.raw<View>(wholeView(embed ? emptyTimeline() : START, 1000));
  let measure = $state.raw<(text: string, bold: boolean) => number>((text, bold) => guessWidth(text, bold) * 1.1);
  let active = $state.raw<Ref | null>(null);
  let selected = $state.raw<Ref | null>(null);
  let selectedTrack = $state<number | null>(null);
  let editing = $state(false);
  let profile = $state.raw<EurthProfile | null>(null);
  let offered = $state.raw<{ calendar: CalendarData; reigns: Track | null }>({ calendar: null, reigns: null });
  let ready = $state(false);
  let fitted = false;

  const timeline = $derived(story.present);
  const engine = $derived(engineFor(timeline.calendar));
  /** The second calendar the axis and the cards are read in, when there is one. */
  const also = $derived(timeline.also === null ? null : engineFor(timeline.also));
  const options = $derived<Partial<LayoutOptions>>({ ...SCREEN, measure });
  const description = $derived(describeTimeline(timeline, engine));
  const order = $derived(navOrder(timeline, engine));
  const card = $derived(selected === null ? null : describeItem(timeline, engine, selected));
  const track = $derived(selectedTrack === null ? null : (timeline.tracks[selectedTrack] ?? null));
  const empty = $derived(timeline.tracks.length === 0 && timeline.eras.length === 0);
  const findings = $derived(embed ? [] : reviewTimeline(timeline, engine));

  // The link. The plain address is the starting example; anything else, an emptied timeline
  // included, carries itself.
  // Before the page has loaded there is no address to read: the site's own, then. After, the
  // address the page is really at, which is the same thing once the site is live.
  const base = $derived(ready ? `${location.origin}/` : `${siteUrl}/`);
  const isStart = $derived(timeline.calendar === null && encodeTimeline(timeline) === START_PACKED);
  const link = $derived(isStart ? base : timelineLink(base, timeline, true));
  const fits = $derived(linkFits(link));
  const name = $derived(timeline.title === '' ? 'A timeline' : timeline.title);

  function wholeView(of: Timeline, across: number): View {
    const dated = engineFor(of.calendar);
    const extent = extentOf(of, dated);
    return extent === null ? defaultView(dated, across) : fitView(dated, extent, across);
  }

  onMount(() => {
    // A link is someone else's input: timelineFromLink never throws and cleans every value.
    const arrived = timelineFromLink(location.search);
    if (arrived !== null) {
      story = startHistory(arrived.timeline);
      if (arrived.issues.length > 0) toast("Some of this link couldn't be read. What could be is here.");
    }
    // Measure labels with the page's own type, so they fit as drawn and not as guessed.
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      const family = getComputedStyle(document.body).fontFamily;
      const known = new Map<string, number>();
      measure = (text, bold) => {
        const key = `${bold ? 'b' : 'n'}${text}`;
        let size = known.get(key);
        if (size === undefined) {
          context.font = `${bold ? 700 : 400} 14px ${family}`;
          size = context.measureText(text).width;
          if (known.size < 5000) known.set(key, size);
        }
        return size;
      };
    }
    ready = true;
  });

  // The chart reports its width; the view follows. The first time, and whenever a whole new
  // timeline arrives, the view shows all of it.
  $effect(() => {
    if (!ready || width <= 0) return;
    if (!fitted) {
      fitted = true;
      view = wholeView(timeline, width);
    } else if (view.width !== width) view = resizeView(view, width);
  });

  // The address bar follows the timeline, so the link can be copied from there too.
  $effect(() => {
    if (!ready || embed) return;
    history.replaceState(history.state, '', fits ? link : location.pathname);
  });

  let frame = 0;
  /** Where a glide in progress is heading. A second press of + zooms from there, not from half-way. */
  let goal: View | null = null;
  const heading = (): View => goal ?? view;

  function settle() {
    cancelAnimationFrame(frame);
    goal = null;
  }

  /** Moves the view there in a fifth of a second, or at once when motion is switched off. */
  function glide(to: View) {
    cancelAnimationFrame(frame);
    const target = clampView(engine, to);
    if (calm()) {
      goal = null;
      view = target;
      return;
    }
    goal = target;
    const from = view;
    const began = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 180);
      const eased = 1 - (1 - t) ** 3;
      view = { start: from.start + (target.start - from.start) * eased, end: from.end + (target.end - from.end) * eased, width: target.width };
      if (t < 1) frame = requestAnimationFrame(step);
      else goal = null;
    };
    frame = requestAnimationFrame(step);
  }

  function commit(next: Timeline) {
    story = record(story, next);
  }

  /** A whole new timeline: from a profile, or a clean slate. */
  function replace(next: Timeline) {
    commit(next);
    clear();
    settle();
    view = wholeView(next, width);
  }

  function clear() {
    selected = null;
    active = null;
    selectedTrack = null;
    editing = false;
  }

  function stretchOf(ref: Ref) {
    return order.find((item) => sameRef(item.ref, ref));
  }

  function reveal(ref: Ref) {
    const item = stretchOf(ref);
    if (!item) return;
    const from = heading();
    const next = revealView(from, { first: item.first, last: item.last });
    if (next !== from) glide(next);
  }

  function pick(ref: Ref) {
    active = ref;
    selected = ref;
    selectedTrack = null;
    editing = false;
  }

  function show(ref: Ref) {
    pick(ref);
    reveal(ref);
  }

  function zoom(factor: number) {
    // About the thing the keyboard is on when it is in view; otherwise about the middle.
    const item = active === null ? undefined : stretchOf(active);
    const from = heading();
    const at = item === undefined ? -1 : xOf(from, item.first);
    glide(zoomView(engine, from, factor, at >= 0 && at <= from.width ? at : from.width / 2));
  }

  function key(action: KeyAction) {
    if (action.type === 'move') {
      const next = move(order, active, action.how);
      if (next !== null) {
        active = next;
        reveal(next);
      }
    } else if (action.type === 'zoom') zoom(action.factor);
    else if (action.type === 'pan') glide(panView(engine, heading(), action.fraction * view.width));
    else if (action.type === 'fit') glide(wholeView(timeline, width));
    else if (action.type === 'open') {
      if (active !== null) pick(active);
    } else clear();
  }

  function step(to: typeof story) {
    story = to;
    if (selected !== null && getItem(story.present, selected) === null) selected = null;
    if (active !== null && getItem(story.present, active) === null) active = null;
    if (selectedTrack !== null && story.present.tracks[selectedTrack] === undefined) selectedTrack = null;
    editing = false;
  }

  // Adding. A new thing lands in the middle of what is on screen, on the track last touched,
  // and opens for editing at once.
  const at = (fraction: number): FuzzyDate => dateOfDay(engine, view.start + (view.end - view.start) * fraction, viewPrecision(engine, view));

  function trackToAddTo(): { timeline: Timeline; index: number } {
    if (timeline.tracks.length === 0) return { timeline: addTrack(timeline, ''), index: 0 };
    const index = selectedTrack ?? (selected !== null && selected.kind !== 'era' ? selected.track : active !== null && active.kind !== 'era' ? active.track : 0);
    return { timeline, index: Math.min(index, timeline.tracks.length - 1) };
  }

  function added(result: { timeline: Timeline; ref: Ref | null }, full: string) {
    if (result.ref === null) {
      toast(full);
      return;
    }
    commit(result.timeline);
    pick(result.ref);
    edit();
  }

  function newEvent() {
    const where = trackToAddTo();
    added(addEvent(where.timeline, where.index, { title: 'New event', date: at(0.5) }), `A track holds at most ${LIMITS.events} events, and this one is full.`);
  }

  function newSpan() {
    const where = trackToAddTo();
    added(addSpan(where.timeline, where.index, { label: 'New span', from: at(0.4), to: at(0.6) }), `A track holds at most ${LIMITS.spans} spans, and this one is full.`);
  }

  function newEra() {
    added(addEra(timeline, { label: 'New era', from: at(0.3), to: at(0.7) }), `A timeline holds at most ${LIMITS.eras} eras.`);
  }

  function newTrack() {
    if (timeline.tracks.length >= LIMITS.tracks) {
      toast(`A timeline holds at most ${LIMITS.tracks} tracks.`);
      return;
    }
    commit(addTrack(timeline, ''));
    clear();
    selectedTrack = timeline.tracks.length - 1;
  }

  function startAgain() {
    replace({ ...emptyTimeline(), calendar: timeline.calendar });
    toast('A clean slate. Undo brings it all back.');
  }

  // Editing: the card turns into a form. Dates are typed as they are written.
  interface Draft {
    title: string;
    from: string;
    to: string;
    ongoing: boolean;
    text: string;
    tone: number;
    track: number;
    links: { label: string; url: string }[];
  }
  let draft = $state<Draft>({ title: '', from: '', to: '', ongoing: false, text: '', tone: 0, track: 0, links: [] });
  let problems = $state<{ from?: string; to?: string; links?: string }>({});

  function edit() {
    if (selected === null) return;
    const item = getItem(timeline, selected);
    if (item === null) return;
    const from = 'date' in item ? item.date : item.from;
    const to = 'date' in item ? null : item.to;
    const links = 'links' in item ? item.links.map((one) => ({ ...one })) : [];
    while (links.length < LIMITS.links) links.push({ label: '', url: '' });
    draft = {
      title: titleOf(item),
      from: formatDate(engine, from),
      to: to === null ? '' : formatDate(engine, to),
      ongoing: !('date' in item) && to === null,
      text: 'text' in item ? item.text : '',
      tone: 'tone' in item ? item.tone : 0,
      track: selected.kind === 'era' ? 0 : selected.track,
      links,
    };
    problems = {};
    editing = true;
  }

  /** What to say when a date can't be read: the calendar's name, and four dates it would take. */
  function dateHelp(): string {
    const first = selected === null ? 0 : (stretchOf(selected)?.first ?? 0);
    const sample = dateOfDay(engine, first, 'year').year;
    const day = formatDate(engine, { year: sample, month: 1, day: 12 });
    return `That isn't a date in ${calendarName(engine)}. Try "${day}", "${formatDate(engine, { year: sample })}", "c. ${sample}" or "${Math.floor(Math.abs(sample) / 10) * 10}s".`;
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (selected === null) return;
    const found: typeof problems = {};
    const from = parseDate(engine, draft.from);
    if (from === null) found.from = dateHelp();
    let to: FuzzyDate | null = null;
    if (selected.kind !== 'event' && !draft.ongoing) {
      to = parseDate(engine, draft.to);
      if (to === null) found.to = draft.to.trim() === '' ? 'Give an end date, or tick "Still going on".' : dateHelp();
      else if (from !== null && dateRange(engine, to).last < dateRange(engine, from).first) found.to = 'The end comes before the start. Swap them, or change one.';
    }
    const links: { label: string; url: string }[] = [];
    for (const row of draft.links) {
      const url = row.url.trim();
      if (url === '') continue;
      if (cleanUrl(url) === null) found.links = 'A link must be a whole address that starts with https://.';
      else links.push({ label: row.label, url });
    }
    problems = found;
    if (from === null || Object.keys(found).length > 0) return;

    let ref = selected;
    let next: Timeline;
    if (ref.kind === 'era') next = updateItem(timeline, ref, { label: draft.title, from, to });
    else if (ref.kind === 'span') next = updateItem(timeline, ref, { label: draft.title, from, to, text: draft.text, links, tone: draft.tone });
    else next = updateItem(timeline, ref, { title: draft.title, date: from, text: draft.text, links });
    if (ref.kind !== 'era' && draft.track !== ref.track) {
      const moved = moveItem(next, ref, draft.track);
      next = moved.timeline;
      ref = moved.ref;
    }
    commit(next);
    pick(ref);
    reveal(ref);
    // Time's own easter egg.
    toast(isBeforeBigBang(engine, from) ? 'Ambitious.' : 'Saved.');
  }

  function remove() {
    if (selected === null) return;
    commit(removeItem(timeline, selected));
    clear();
    toast('Gone. Undo brings it back.');
  }

  // Tracks.
  function renameTrack(index: number, value: string) {
    commit(updateTrack(timeline, index, { name: value }));
  }

  function shiftTrack(index: number, by: number) {
    const next = moveTrack(timeline, index, index + by);
    if (next === timeline) return;
    commit(next);
    selectedTrack = index + by;
  }

  function dropTrack(index: number) {
    commit(removeTrack(timeline, index));
    clear();
    toast('The track is gone, with everything on it. Undo brings it back.');
  }

  // The calendar.
  function useCalendar(calendar: CalendarData) {
    const changed = setCalendar(timeline, calendar);
    replace(changed.timeline);
    const moved = changed.issues.length;
    toast(moved === 0 ? `Now dated in ${calendarName(engineFor(calendar))}.` : `Now dated in ${calendarName(engineFor(calendar))}. ${moved} ${moved === 1 ? 'date' : 'dates'} had to move to fit.`);
  }

  // A second calendar on the axis: the Gregorian one, or the profile's, when both it and the
  // timeline's own are tied to Earth. The one in use stays in the list wherever it came from.
  const alsoChoices = $derived.by(() => {
    const choices: { name: string; calendar: CalendarData }[] = [];
    const offer = (calendar: CalendarData) => {
      if (calendar === null || sameCalendar(calendar, timeline.calendar) || choices.some((one) => sameCalendar(one.calendar, calendar))) return;
      const other = engineFor(calendar);
      if (canConvert(engine, other)) choices.push({ name: other.name === '' ? 'Another calendar' : other.name, calendar });
    };
    offer(timeline.also);
    offer(GREGORIAN_CALENDAR);
    offer(offered.calendar);
    return choices;
  });
  const alsoIndex = $derived(timeline.also === null ? -1 : alsoChoices.findIndex((one) => sameCalendar(one.calendar, timeline.also)));

  /** A date or a stretch as the second calendar has it, for the card. */
  const alsoWhen = $derived.by(() => {
    if (also === null || selected === null) return '';
    const item = getItem(timeline, selected);
    if (item === null) return '';
    const turn = (date: FuzzyDate) => convertDate(engine, also, date);
    return 'date' in item ? formatDate(also, turn(item.date)) : formatStretch(also, turn(item.from), item.to === null ? null : turn(item.to));
  });

  const profileCalendarDiffers = $derived(offered.calendar !== null && JSON.stringify(offered.calendar) !== JSON.stringify(timeline.calendar));

  function addReigns() {
    if (offered.reigns === null) return;
    const before = timeline.tracks.length;
    const next = appendTracks(timeline, [offered.reigns]);
    if (next.tracks.length === before) {
      toast(`A timeline holds at most ${LIMITS.tracks} tracks.`);
      return;
    }
    commit(next);
    offered = { ...offered, reigns: null };
    view = wholeView(next, width);
    toast('The reigns are on a track of their own.');
  }

  // The nation's profile file.
  function loaded(next: EurthProfile) {
    profile = next;
    const read = readProfile(next);
    offered = { calendar: read.profileCalendar, reigns: read.reigns };
    const nation = next.meta.nation || 'Your nation';
    if (read.found) {
      replace(read.timeline);
      toast(`${nation} is loaded, timeline and all.`);
    } else if (empty && read.profileCalendar !== null) {
      replace(read.timeline);
      toast(`${nation} is loaded, with its calendar. It has no timeline yet.`);
    } else toast(`${nation} is loaded. It has no timeline yet, so this one stays.`);
  }

  // What "Save profile" writes: Time's own section and nothing else. Every other section stays
  // exactly as it was, the ones Time has never heard of included.
  const saved = $derived.by(() => {
    const from = profile ?? createProfile('');
    const { link: _old, ...kept } = (getSection(from, 'timeline') ?? {}) as Record<string, unknown>;
    return setSection(from, 'timeline', { ...kept, ...toProfileSection(timeline, fits ? { link } : {}) });
  });

  // Exports: the picture is of what is on screen, in the theme that is on screen.
  function picture() {
    const chosen = getPrefs().theme;
    const dark = chosen === 'dark' || (chosen === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const theme = svgTheme(resolveColors(tokens, dark ? 'dark' : 'light'), tokens.type.families);
    return { ...timelineSvg(timeline, engine, resizeView(view, 1200), { theme, also }), background: theme.background };
  }

  const slug = $derived(fileSlug(timeline.title, 'timeline'));

  function saveSvg() {
    download(picture().svg, `${slug}.svg`, 'image/svg+xml');
  }

  /** The size of a PNG or WebP: the timeline's own shape, or one of the suite's sizes for sharing, with the timeline fitted inside. */
  let pictureSize = $state('own');

  async function savePicture(type: 'image/png' | 'image/webp') {
    const made = picture();
    const size = PICTURE_SIZES.find((one) => one.id === pictureSize);
    const box = size ?? { width: made.width * 2, height: made.height * 2 };
    const blob = await svgToPicture(made.svg, { width: box.width, height: box.height, background: made.background, type, quality: 0.92 });
    // A browser that can't make a WebP hands back a PNG. Say so, and name the file for what it is.
    if (type === 'image/webp' && blob.type !== 'image/webp') toast("This browser can't make a WebP, so here is a PNG.");
    download(blob, pictureName(slug, size?.id, blob.type));
  }

  function saveCsv() {
    download(timelineCsv(timeline, engine), `${slug}.csv`, 'text/csv');
  }

  /** Asks for a file and gives its text, or null when none is chosen or it is too big to be a timeline. */
  function pickText(accept: string): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file === undefined || file.size > 2_000_000 ? null : await file.text().catch(() => null));
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  /** Brings another timeline's tracks and eras into this one, and says what came in. */
  function bringIn(other: Timeline, from: string) {
    const merged = mergeTimeline(timeline, other);
    if (merged.timeline === timeline || addedLine(merged.added) === 'nothing new') {
      toast(`Nothing new in ${from}: everything in it is here already.`);
      return;
    }
    commit(merged.timeline);
    clear();
    settle();
    view = wholeView(merged.timeline, width);
    toast(`Added ${addedLine(merged.added)} from ${from}. Undo takes them out again.`);
  }

  // Tracks from someone else's timeline: this is how a shared history is built without accounts.
  // Their dates are turned into this timeline's calendar when the two calendars can be compared.
  let otherLink = $state('');

  function addOther(other: Timeline | null, from: string) {
    if (other === null || (other.tracks.length === 0 && other.eras.length === 0)) {
      toast(`There is no timeline in ${from}.`);
      return false;
    }
    const turned = convertTimeline(other, timeline.calendar);
    if (turned === null) {
      toast(`Its dates are in ${calendarName(engineFor(other.calendar))}, and can't be turned into ${calendarName(engine)}: both calendars need a link to Earth's for that.`);
      return false;
    }
    bringIn(turned.timeline, turned.converted ? `${from}, with its dates turned into ${calendarName(engine)}` : from);
    return true;
  }

  function addFromLink(event: SubmitEvent) {
    event.preventDefault();
    // Only read, never opened: the timeline is in the link's own text.
    if (addOther(timelineFromLink(otherLink.trim())?.timeline ?? null, 'that link')) otherLink = '';
  }

  async function addFromProfile() {
    const picked = await pickProfile();
    if (picked === null) return;
    if (!picked.ok) {
      toast(picked.errors[0]?.message ?? "That file isn't a nation profile. Pick one that ends in .eurth.json.");
      return;
    }
    const read = readProfile(picked.profile);
    addOther(read.found ? read.timeline : null, `${picked.profile.meta.nation || 'that nation'}'s profile`);
  }

  async function importCsv() {
    const text = await pickText('.csv,text/csv');
    if (text === null) return;
    // The sheet's dates are read in this timeline's calendar: it is being added to this timeline.
    const read = timelineFromCsv(text, timeline.calendar);
    if (read === null || (read.timeline.tracks.length === 0 && read.timeline.eras.length === 0)) {
      toast("That file isn't a timeline sheet. It needs a title column and a from or date column, with a date in each row.");
      return;
    }
    bringIn(read.timeline, 'the sheet');
  }

  // Print: what is on screen, spread across a number of sheets, one to a page. The browser's
  // own print dialogue does the rest, saving as a PDF included.
  let sheetCount = $state(2);

  async function print() {
    const light = svgTheme(resolveColors(tokens, 'light'), tokens.type.families);
    const sheets = printSheets(timeline, engine, { first: view.start, last: view.end }, sheetCount, light, { also });
    const holder = document.createElement('div');
    holder.className = 'time-sheets';
    for (const sheet of sheets) {
      const image = new Image(sheet.width, sheet.height);
      image.alt = sheet.label;
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sheet.svg)}`;
      holder.append(image);
    }
    document.body.append(holder);
    document.documentElement.classList.add('time-printing');
    await Promise.all([...holder.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
    const tidy = () => {
      holder.remove();
      document.documentElement.classList.remove('time-printing');
      removeEventListener('afterprint', tidy);
    };
    addEventListener('afterprint', tidy);
    window.print();
  }

  async function copyWiki() {
    toast((await copyText(timelineWikitext(timeline, engine))) ? 'Wiki table copied. Paste it into your history section.' : "That didn't copy. Your browser may not allow it here.");
  }

  async function copyEmbed() {
    const address = embedLink(base, timeline);
    if (!linkFits(address)) {
      toast('This timeline is too long to embed. Embeds carry the timeline in their link.');
      return;
    }
    toast((await copyText(embedCode(address, timeline.title, embedHeight(timeline, engine, SCREEN)))) ? 'Embed code copied. Paste it where the timeline should show.' : "That didn't copy. Your browser may not allow it here.");
  }

  const kindName: Record<TrackKind, string> = { nation: 'A nation', dynasty: 'A dynasty', world: 'The shared world', other: 'Something else' };
  const where = (ref: Ref): string => (ref.kind === 'era' ? 'Era' : (timeline.tracks[ref.track]?.name ?? ''));
</script>

<div class="eu-stack time" class:embed>
  <div class="bar">
    <div class="eu-stack heading">
      <h2 class="title">{name}</h2>
      <p class="eu-data eu-muted">{viewLabel(engine, view)} · dates in {calendarName(engine)}</p>
    </div>
    <div class="eu-row">
      <button type="button" class="eu-btn eu-btn--icon" data-tip="Zoom out" aria-label="Zoom out" onclick={() => zoom(1 / 1.5)}><Icon icon={faMagnifyingGlassMinus} /></button>
      <button type="button" class="eu-btn eu-btn--icon" data-tip="Zoom in" aria-label="Zoom in" onclick={() => zoom(1.5)}><Icon icon={faMagnifyingGlassPlus} /></button>
      <button type="button" class="eu-btn" onclick={() => glide(wholeView(timeline, width))}><Icon icon={faExpand} /> Show all</button>
    </div>
  </div>

  {#if !embed}
    <div class="eu-row">
      <button type="button" class="eu-btn eu-btn--primary" onclick={newEvent}><Icon icon={faPlus} /> Add event</button>
      <button type="button" class="eu-btn" onclick={newSpan}><Icon icon={faPlus} /> Add span</button>
      <button type="button" class="eu-btn" onclick={newEra}><Icon icon={faPlus} /> Add era</button>
      <button type="button" class="eu-btn" onclick={newTrack}><Icon icon={faPlus} /> Add track</button>
      <button type="button" class="eu-btn" disabled={!canUndo(story)} onclick={() => step(undo(story))}><Icon icon={faRotateLeft} /> Undo</button>
      <button type="button" class="eu-btn" disabled={!canRedo(story)} onclick={() => step(redo(story))}><Icon icon={faRotateRight} /> Redo</button>
      <button type="button" class="eu-btn" data-click="spin" disabled={empty && timeline.title === ''} onclick={startAgain}><Icon icon={faXmark} /> Start again</button>
    </div>
  {/if}

  <div class="eu-card sheet">
    <Chart {timeline} {engine} {also} bind:view bind:width {options} {active} {selected} {selectedTrack} readonly={embed} onpick={pick} onkey={key} ongrab={settle} ontrack={(index) => { clear(); selectedTrack = index; }} />
    {#if empty}
      <p class="eu-muted">{embed ? 'There is no timeline in this link.' : 'Nothing here yet. Add a track for a nation, then give it an event or a span.'}</p>
    {/if}
    <p id="time-keys" class="eu-visually-hidden">
      Arrow keys move from one thing to the next, Enter opens its card, plus and minus zoom, and nought shows the whole timeline.
    </p>
  </div>

  <div class="below">
    <section class="eu-card" class:eu-card--outline={card !== null || track !== null} aria-live="polite" aria-labelledby="time-card">
      {#if selected !== null && card !== null && editing && !embed}
        <h3 id="time-card" class="eu-kicker">Editing · {where(selected)}</h3>
        <form class="eu-stack" onsubmit={save} novalidate>
          <label class="eu-field">
            <span class="eu-label">{selected.kind === 'event' ? 'Title' : 'Label'}</span>
            <input class="eu-input" bind:value={draft.title} maxlength={LIMITS.label} autocomplete="off" />
          </label>
          <div class="pair">
            <label class="eu-field">
              <span class="eu-label">{selected.kind === 'event' ? 'Date' : 'From'}</span>
              <input class="eu-input eu-input--data" bind:value={draft.from} autocomplete="off" aria-invalid={problems.from !== undefined} aria-describedby="time-date-help" />
              {#if problems.from}<span class="eu-error">{problems.from}</span>{/if}
            </label>
            {#if selected.kind !== 'event'}
              <label class="eu-field">
                <span class="eu-label">To</span>
                <input class="eu-input eu-input--data" bind:value={draft.to} disabled={draft.ongoing} autocomplete="off" aria-invalid={problems.to !== undefined} aria-describedby="time-date-help" />
                {#if problems.to}<span class="eu-error">{problems.to}</span>{/if}
              </label>
            {/if}
          </div>
          <p class="eu-help" id="time-date-help">A day, a month or a year, as you would write it. "c." in front for about; "1650s" or "17th century" when that is all anyone knows.</p>
          {#if selected.kind !== 'event'}
            <label class="eu-pill">
              <input type="checkbox" bind:checked={draft.ongoing} />
              <span class="eu-check"><Icon icon={faCheck} /></span>
              Still going on
            </label>
          {/if}
          {#if selected.kind !== 'era'}
            <label class="eu-field">
              <span class="eu-label">Track</span>
              <select class="eu-select" bind:value={draft.track}>
                {#each timeline.tracks as one, index (index)}
                  <option value={index}>{one.name}</option>
                {/each}
              </select>
            </label>
            <label class="eu-field">
              <span class="eu-label">What happened</span>
              <textarea class="eu-textarea" bind:value={draft.text} maxlength={LIMITS.text} rows="3"></textarea>
            </label>
          {/if}
          {#if selected.kind === 'span'}
            <fieldset class="plain">
              <legend class="eu-label">Tone</legend>
              <div class="eu-row">
                {#each TONES as tone, index (tone.token)}
                  <label class="eu-pill">
                    <input type="radio" name="tone" value={index} bind:group={draft.tone} />
                    <span class="eu-check"><Icon icon={faCheck} /></span>
                    <span class="eu-swatch tone-{index}" aria-hidden="true"></span>
                    {tone.name}
                  </label>
                {/each}
              </div>
              <p class="eu-help">A tone is only a help to the eye. The label on the bar is what tells spans apart.</p>
            </fieldset>
          {/if}
          {#if selected.kind !== 'era'}
            <fieldset class="plain">
              <legend class="eu-label">Links</legend>
              {#each draft.links as row, index (index)}
                <div class="pair">
                  <label class="eu-field">
                    <span class="eu-visually-hidden">Name of link {index + 1}</span>
                    <input class="eu-input" bind:value={row.label} maxlength={LIMITS.linkLabel} placeholder="Forum thread" autocomplete="off" />
                  </label>
                  <label class="eu-field">
                    <span class="eu-visually-hidden">Address of link {index + 1}</span>
                    <input class="eu-input eu-input--data" bind:value={row.url} maxlength={LIMITS.url} placeholder="https://" autocomplete="off" inputmode="url" />
                  </label>
                </div>
              {/each}
              {#if problems.links}<span class="eu-error">{problems.links}</span>{/if}
            </fieldset>
          {/if}
          <div class="eu-row">
            <button type="submit" class="eu-btn eu-btn--primary"><Icon icon={faCheck} /> Save</button>
            <button type="button" class="eu-btn" onclick={() => (editing = false)}>Cancel</button>
            <button type="button" class="eu-btn" onclick={remove}><Icon icon={faTrash} /> Delete</button>
          </div>
        </form>
      {:else if selected !== null && card !== null}
        <h3 id="time-card" class="eu-kicker">Selected · {where(selected)}</h3>
        <p class="what">{card.title} <span class="eu-data eu-muted">{card.when}{card.duration === '' ? '' : ` · ${card.duration}`}</span></p>
        {#if alsoWhen !== ''}<p class="eu-data eu-muted">In {calendarName(also ?? engine)}: {alsoWhen}</p>{/if}
        {#if card.text !== ''}<p>{card.text}</p>{/if}
        {#if card.links.length > 0}
          <p class="eu-row">
            {#each card.links as one (one.url)}
              <a href={one.url} rel="noopener">{one.label}</a>
            {/each}
          </p>
        {/if}
        <div class="eu-row">
          {#if !embed}
            <button type="button" class="eu-btn" onclick={edit}><Icon icon={faPen} /> Edit</button>
            <button type="button" class="eu-btn" onclick={remove}><Icon icon={faTrash} /> Delete</button>
          {/if}
          <button type="button" class="eu-btn" onclick={clear}>Close</button>
        </div>
      {:else if track !== null && selectedTrack !== null && !embed}
        {@const index = selectedTrack}
        <h3 id="time-card" class="eu-kicker">Track {index + 1} of {timeline.tracks.length}</h3>
        {#key `${index}:${track.name}`}
          <label class="eu-field">
            <span class="eu-label">Name</span>
            <input class="eu-input" value={track.name} maxlength={LIMITS.name} autocomplete="off" onchange={(event) => renameTrack(index, event.currentTarget.value)} />
          </label>
        {/key}
        <label class="eu-field">
          <span class="eu-label">It follows</span>
          <select class="eu-select" value={track.kind} onchange={(event) => commit(updateTrack(timeline, index, { kind: event.currentTarget.value as TrackKind }))}>
            {#each TRACK_KINDS as kind (kind)}
              <option value={kind}>{kindName[kind]}</option>
            {/each}
          </select>
        </label>
        <div class="eu-row">
          <button type="button" class="eu-btn" disabled={index === 0} onclick={() => shiftTrack(index, -1)}><Icon icon={faArrowUp} /> Move up</button>
          <button type="button" class="eu-btn" disabled={index === timeline.tracks.length - 1} onclick={() => shiftTrack(index, 1)}><Icon icon={faArrowDown} /> Move down</button>
          <button type="button" class="eu-btn" onclick={() => dropTrack(index)}><Icon icon={faTrash} /> Delete track</button>
          <button type="button" class="eu-btn" onclick={clear}>Close</button>
        </div>
      {:else}
        <h3 id="time-card" class="eu-kicker">Nothing selected</h3>
        <p class="eu-muted">
          {embed ? 'Choose an event or a span to read about it.' : 'Choose an event or a span to read about it and change it, or a track’s name to rename, move or delete the track.'}
        </p>
      {/if}
    </section>

    <section class="eu-card" aria-labelledby="time-about">
      <h3 id="time-about" class="eu-kicker">This timeline</h3>
      {#if !embed}
        {#key timeline.title}
          <label class="eu-field">
            <span class="eu-label">Title</span>
            <input class="eu-input" value={timeline.title} maxlength={LIMITS.title} autocomplete="off" placeholder="History of…" onchange={(event) => commit(setTitle(timeline, event.currentTarget.value))} />
          </label>
        {/key}
      {/if}
      <p>{empty ? 'Empty so far.' : `${countLine(timeline)}.`} Dated in {calendarName(engine)}.</p>
      {#if !embed}
        <div class="eu-row">
          {#if timeline.calendar !== null}
            <button type="button" class="eu-btn" onclick={() => useCalendar(null)}>Use the Gregorian calendar</button>
          {/if}
          {#if profileCalendarDiffers}
            <button type="button" class="eu-btn" onclick={() => useCalendar(offered.calendar)}>Use {calendarName(engineFor(offered.calendar))}</button>
          {/if}
          {#if offered.reigns !== null}
            <button type="button" class="eu-btn" onclick={addReigns}><Icon icon={faPlus} /> Add the reigns of {offered.reigns.name}</button>
          {/if}
          {#if calendarMaker !== null}
            <a class="eu-btn" href={calendarMaker} data-same-tab>Make a calendar of your own</a>
          {/if}
        </div>
        {#if alsoChoices.length > 0}
          <label class="eu-field">
            <span class="eu-label">Second calendar on the axis</span>
            <select class="eu-select" value={alsoIndex} onchange={(event) => commit(setAlso(timeline, alsoChoices[Number(event.currentTarget.value)]?.calendar ?? null))}>
              <option value={-1}>None</option>
              {#each alsoChoices as choice, index (choice.name)}
                <option value={index}>{choice.name}</option>
              {/each}
            </select>
          </label>
        {/if}
        <form class="eu-stack other" onsubmit={addFromLink}>
          <label class="eu-field">
            <span class="eu-label">Add tracks from another timeline</span>
            <input class="eu-input eu-input--data" bind:value={otherLink} placeholder="Paste its link" autocomplete="off" inputmode="url" aria-describedby="time-other-help" />
          </label>
          <div class="eu-row">
            <button type="submit" class="eu-btn" disabled={otherLink.trim() === ''}><Icon icon={faPlus} /> Add its tracks</button>
            <button type="button" class="eu-btn" onclick={addFromProfile}><Icon icon={faFileImport} /> From a profile</button>
          </div>
          <p class="eu-help" id="time-other-help">A friend's nation beside yours: their tracks join this timeline, and theirs stays as it was.</p>
        </form>
      {:else}
        <p><a class="eu-btn" href={timelineLink(base, timeline, true)} target="_top">Open in {siteName}</a></p>
      {/if}
    </section>
  </div>

  {#if !embed}
    <section class="eu-stack" aria-labelledby="time-take">
      <h3 id="time-take" class="eu-visually-hidden">Share and save</h3>
      <ShareButtons
        url={fits ? link : base}
        title={name}
        text={`${description.summary} Made with ${siteName}.`}
        description={() => descriptionText(description)}
        picture={() => {
          const made = picture();
          return svgToPicture(made.svg, { width: 1200, height: 630, background: made.background });
        }}
        heading={`Share ${name}`}
        said={{ link: fits ? 'Link copied: the whole timeline is in it.' : 'Link copied. This timeline is too long to ride in it: save the profile file as well.' }}
      />
      <div class="eu-row">
        <button type="button" class="eu-btn" data-click="bounce" onclick={saveSvg}><Icon icon={faDownload} /> SVG</button>
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => savePicture('image/png')}><Icon icon={faDownload} /> PNG</button>
        <button type="button" class="eu-btn" data-click="bounce" onclick={() => savePicture('image/webp')}><Icon icon={faDownload} /> WebP</button>
        <label class="size">
          <span class="eu-visually-hidden">Size of the PNG or WebP</span>
          <select class="eu-select" bind:value={pictureSize}>
            <option value="own">Picture as on screen</option>
            {#each PICTURE_SIZES as size (size.id)}
              <option value={size.id}>{size.name}, {size.width} × {size.height}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="eu-btn" data-click="bounce" onclick={saveCsv}><Icon icon={faDownload} /> CSV</button>
        <button type="button" class="eu-btn" onclick={print}><Icon icon={faPrint} /> Print</button>
        <label class="size">
          <span class="eu-visually-hidden">How many sheets to print across</span>
          <select class="eu-select" bind:value={sheetCount}>
            {#each SHEET_CHOICES as count (count)}
              <option value={count}>{count === 1 ? 'On 1 sheet' : `Across ${count} sheets`}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="eu-btn" onclick={importCsv}><Icon icon={faFileImport} /> Import CSV</button>
        <button type="button" class="eu-btn" onclick={copyWiki}><Icon icon={faTable} /> Copy wiki table</button>
        <button type="button" class="eu-btn" onclick={copyEmbed}><Icon icon={faCode} /> Copy embed code</button>
        <ProfileButtons profile={saved} onload={loaded} onerror={(errors) => toast(errors[0]?.message ?? "That file isn't a nation profile. Pick one that ends in .eurth.json.")} />
      </div>
      <p class="eu-help">
        {#if fits}
          The link holds the whole timeline, and the pictures show what is on screen now. The profile file carries your nation from one Eurth tool to the next; nothing is kept in this browser.
        {:else}
          This timeline has outgrown its link. Save it as a profile file: that holds all of it, and opens here again. Nothing is kept in this browser.
        {/if}
      </p>
    </section>
  {/if}

  {#if !embed && !empty}
    <section class="eu-card" aria-labelledby="time-check">
      <h3 id="time-check" class="eu-kicker">Reality check</h3>
      {#if findings.length === 0}
        <p>Nothing stands out against how long things have really taken. That is not the same as believable: the <a href="/guide/">guide</a> has the rest.</p>
      {:else}
        <p class="eu-muted">Where this history differs from how things have gone on Earth. It may be the point; it is worth knowing.</p>
        <ul class="findings">
          {#each findings as finding, index (`${finding.id}${index}`)}
            <li>
              <p>{finding.message}</p>
              {#if finding.refs.length > 0}
                <div class="eu-row">
                  {#each finding.refs.slice(0, 4) as ref (`${ref.kind}${ref.kind === 'era' ? '' : ref.track}-${ref.index}`)}
                    <button type="button" class="eu-btn eu-btn--quiet" onclick={() => show(ref)}>Show {titleOf(getItem(timeline, ref) ?? { title: 'it', date: { year: 1 }, text: '', links: [] })}</button>
                  {/each}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="eu-help">The figures behind these are in the <a href="/guide/#durations">guide</a>, with their sources.</p>
      {/if}
    </section>
  {/if}

  <section class="eu-card words" aria-labelledby="time-words">
    <h3 id="time-words" class="eu-kicker">The timeline in words</h3>
    <p>{description.summary}</p>
    {#if description.eras.length > 0}
      <h4>Eras</h4>
      <ul>
        {#each description.eras as era (era.ref.index)}
          <li>
            <button type="button" class="eu-btn eu-btn--quiet" aria-pressed={sameRef(selected, era.ref)} onclick={() => show(era.ref)}>{era.title}</button>
            <span><span class="eu-data">{era.when}</span>{era.duration === '' ? '' : ` (${era.duration})`}</span>
          </li>
        {/each}
      </ul>
    {/if}
    {#each description.tracks as one (one.index)}
      <h4>{one.name}</h4>
      {#if one.items.length === 0}
        <p class="eu-muted">Nothing yet.</p>
      {:else}
        <ul>
          {#each one.items as item (`${item.kind}${item.ref.index}`)}
            <li>
              <button type="button" class="eu-btn eu-btn--quiet" aria-pressed={sameRef(selected, item.ref)} onclick={() => show(item.ref)}>{item.title}</button>
              <span><span class="eu-data">{item.when}</span>{item.duration === '' ? '' : ` (${item.duration})`}{item.text === '' ? '' : `. ${item.text}`}</span>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
    <details>
      <summary>Keys</summary>
      <dl class="keys">
        {#each KEY_HELP as row (row.keys)}
          <dt>{row.keys}</dt>
          <dd>{row.does}</dd>
        {/each}
      </dl>
    </details>
  </section>
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .heading {
    gap: var(--space-1);
    min-width: 0;
  }

  .title {
    margin: 0;
    font: var(--type-title);
    overflow-wrap: anywhere;
  }

  .heading p,
  .what {
    margin: 0;
  }

  .sheet {
    padding: var(--space-4);
  }

  .below {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: var(--space-4);
    align-items: start;
  }

  .what {
    font: var(--type-subtitle);
  }

  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-3);
  }

  .plain {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  h3 {
    margin: 0;
  }

  .words h4 {
    margin: var(--space-3) 0 0;
    font: var(--type-heading);
  }

  .words ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .words li {
    display: grid;
    grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
  }

  .words li .eu-btn {
    justify-self: start;
    max-width: 100%;
    text-align: left;
  }

  summary {
    display: flex;
    align-items: center;
    min-height: var(--size-target);
    font: var(--type-label);
    cursor: pointer;
  }

  .findings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .findings p {
    margin: 0 0 var(--space-1);
  }

  .keys {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-1) var(--space-4);
    margin: var(--space-3) 0 0;
  }

  .keys dt {
    font: var(--type-label);
  }

  .keys dd {
    margin: 0;
  }

  /* The tone picker's swatches use the same tokens as the bars. */
  .tone-0 {
    background: var(--accent-text);
  }
  .tone-1 {
    background: var(--caution-text);
  }
  .tone-2 {
    background: var(--ink-muted);
  }
  .tone-3 {
    background: var(--success-text);
  }
  .tone-4 {
    background: var(--danger-text);
  }
  .tone-5 {
    background: var(--ink);
  }

  /* Printing: the sheets and nothing else, one to a page, on paper turned on its side. */
  :global(.time-sheets) {
    display: none;
  }

  @media print {
    :global(html.time-printing body > *:not(.time-sheets)) {
      display: none !important;
    }

    :global(html.time-printing .time-sheets) {
      display: block;
    }

    :global(html.time-printing .time-sheets img) {
      display: block;
      width: 100%;
      height: auto;
      max-height: 100vh;
      object-fit: contain;
      break-after: page;
    }

    :global(html.time-printing .time-sheets img:last-child) {
      break-after: auto;
    }
  }

  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  @media (max-width: 800px) {
    .below,
    .pair,
    .words li {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
