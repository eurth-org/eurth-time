<script lang="ts">
  /*
   * The chart: eras across the top, a row per track, the year axis below. It draws what
   * layout.ts and axis.ts work out and decides nothing itself.
   *
   * For the keyboard and for screen readers the plot is a list to choose from (a listbox): each
   * era, span and event is an option with its name and date, grouped by track. Focus stays on
   * the plot; the arrow keys move a ring from one thing to the next. A bar is as wide as its
   * time is long, so some are far narrower than a finger: the text version under the chart has
   * a full-size button for every one of them.
   *
   * Dragging slides the view, pinching or Ctrl with the wheel zooms about the pointer, and a
   * plain wheel scrolls the page as it always does.
   */
  import { labelShown, panView, ticks, zoomView, type View } from './axis';
  import { describeItem } from './describe';
  import type { DateEngine } from './engine';
  import { layoutTimeline, type LayoutOptions } from './layout';
  import { sameRef, type Ref, type Timeline } from './model';
  import { keyAction, type KeyAction } from './nav';

  let {
    timeline,
    engine,
    view = $bindable(),
    width = $bindable(),
    options,
    active,
    selected,
    selectedTrack = null,
    readonly = false,
    onpick,
    onkey,
    ontrack,
  }: {
    timeline: Timeline;
    engine: DateEngine;
    /** The stretch of time on screen. The chart changes it when dragged or pinched. */
    view: View;
    /** The width of the plot in pixels, as measured on the page. */
    width: number;
    options: Partial<LayoutOptions>;
    /** The thing the keyboard is on, and the thing whose card is open. */
    active: Ref | null;
    selected: Ref | null;
    selectedTrack?: number | null;
    /** In an embed there is nothing to edit, so track names are not buttons. */
    readonly?: boolean;
    onpick: (ref: Ref) => void;
    onkey: (action: KeyAction) => void;
    ontrack?: (index: number) => void;
  } = $props();

  let plot: HTMLDivElement | undefined = $state();

  const layout = $derived(layoutTimeline(timeline, engine, view, options));
  const tickList = $derived(ticks(engine, view));
  const marker = $derived(options.marker ?? 16);
  const barPad = $derived(options.barPad ?? 12);
  const labelGap = $derived(options.labelGap ?? 8);
  const top = $derived(layout.tracks[0]?.y ?? layout.axisY);
  // A list to choose from needs something in it; an empty timeline is only a place to drag and zoom.
  const hasItems = $derived(timeline.eras.length > 0 || timeline.tracks.some((track) => track.spans.length > 0 || track.events.length > 0));

  const idOf = (ref: Ref): string => (ref.kind === 'era' ? `time-era-${ref.index}` : `time-${ref.kind}-${ref.track}-${ref.index}`);
  const nameOf = (ref: Ref): string => {
    const item = describeItem(timeline, engine, ref);
    return item === null ? '' : `${item.title}, ${item.when}${item.duration === '' ? '' : `, ${item.duration}`}`;
  };

  // Dragging and pinching. A drag that has moved is not a click.
  const pointers = new Map<number, number>();
  let drag: { x: number; view: View; moved: boolean } | null = null;
  let pinch: { distance: number; view: View; middle: number } | null = null;
  let dragged = false;

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, event.clientX);
    if (pointers.size === 1) drag = { x: event.clientX, view, moved: false };
    else if (pointers.size === 2 && plot) {
      const [a, b] = [...pointers.values()] as [number, number];
      pinch = { distance: Math.max(1, Math.abs(a - b)), view, middle: (a + b) / 2 - plot.getBoundingClientRect().left };
      drag = null;
    }
  }

  function moved(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event.clientX);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [number, number];
      view = zoomView(engine, pinch.view, Math.max(1, Math.abs(a - b)) / pinch.distance, pinch.middle);
      dragged = true;
    } else if (drag) {
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      if (!drag.moved) plot?.setPointerCapture(event.pointerId);
      drag.moved = true;
      dragged = true;
      view = panView(engine, drag.view, -dx);
    }
  }

  function up(event: PointerEvent) {
    pointers.delete(event.pointerId);
    drag = null;
    if (pointers.size < 2) pinch = null;
    // The click that follows a drag arrives after this; let it pass unanswered, then listen again.
    if (dragged) setTimeout(() => (dragged = false), 0);
  }

  function pick(ref: Ref) {
    if (dragged) return;
    // Focus stays on the plot, so the arrow keys carry on from the thing just clicked.
    plot?.focus({ preventScroll: true });
    onpick(ref);
  }

  function keydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const action = keyAction(event.key, { shift: event.shiftKey });
    if (action === null) return;
    event.preventDefault();
    onkey(action);
  }

  // The wheel: only with Ctrl (which is also what a trackpad pinch sends) or sideways. It has to
  // be able to stop the page from zooming, which a listener written in the markup may not.
  $effect(() => {
    const element = plot;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        view = zoomView(engine, view, Math.exp(-event.deltaY * 0.01), event.clientX - element.getBoundingClientRect().left);
      } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        view = panView(engine, view, event.deltaX);
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  });
</script>

<div class="chart">
  <div class="names" style:height="{layout.height}px">
    {#each layout.tracks as track (track.index)}
      {#if readonly}
        <p class="name" style:top="{track.y}px" style:height="{track.height}px">{track.name}</p>
      {:else}
        <button
          type="button"
          class="name"
          class:chosen={selectedTrack === track.index}
          aria-pressed={selectedTrack === track.index}
          style:top="{track.y}px"
          style:height="{track.height}px"
          onclick={() => ontrack?.(track.index)}
        >
          <span class="eu-visually-hidden">Track: </span>{track.name}
        </button>
      {/if}
    {/each}
  </div>

  <div
    bind:this={plot}
    bind:clientWidth={width}
    class="plot"
    role={hasItems ? 'listbox' : 'group'}
    tabindex="0"
    aria-label={timeline.title === '' ? 'Timeline' : `Timeline: ${timeline.title}`}
    aria-describedby="time-keys"
    aria-activedescendant={active === null ? undefined : idOf(active)}
    style:height="{layout.height}px"
    onkeydown={keydown}
    onpointerdown={down}
    onpointermove={moved}
    onpointerup={up}
    onpointercancel={up}
  >
    <div class="lines" aria-hidden="true">
      {#each layout.tracks as track (track.index)}
        <div class="row-line" style:top="{track.y}px"></div>
      {/each}
      <div class="row-line strong" style:top="{layout.axisY}px"></div>
      {#each tickList as tick (tick.days)}
        <div class="tick" style:left="{tick.x}px" style:top="{top}px" style:height="{layout.axisY - top + 6}px" style:opacity={tick.opacity}></div>
        <span class="tick-label eu-data" class:shown={labelShown(tick)} style:left="{tick.x}px" style:top="{layout.axisY + 8}px">{tick.label}</span>
      {/each}
    </div>

    {#if layout.eras.length > 0}
      <div role="group" aria-label="Eras">
        {#each layout.eras as era (era.ref.index)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
          <div
            role="option"
            id={idOf(era.ref)}
            class="era"
            class:active={sameRef(active, era.ref)}
            class:selected={sameRef(selected, era.ref)}
            aria-selected={sameRef(selected, era.ref)}
            aria-label={nameOf(era.ref)}
            style:left="{era.x}px"
            style:top="{era.y}px"
            style:width="{era.w}px"
            style:height="{era.h}px"
            onclick={() => pick(era.ref)}
          >
            <span class="era-label" aria-hidden="true">{era.text}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#each layout.tracks as track (track.index)}
      <div role="group" aria-label={track.name}>
        {#each track.spans as span (span.ref.index)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
          <div
            role="option"
            id={idOf(span.ref)}
            class="span tone-{span.tone}"
            class:active={sameRef(active, span.ref)}
            class:selected={sameRef(selected, span.ref)}
            aria-selected={sameRef(selected, span.ref)}
            aria-label={nameOf(span.ref)}
            style:left="{span.x}px"
            style:top="{span.y}px"
            style:width="{span.w}px"
            style:height="{span.h}px"
            onclick={() => pick(span.ref)}
          >
            {#if span.softStart > 0 || span.softEnd > 0}<span class="soft" aria-hidden="true"></span>{/if}
            <span class="solid" class:cut={span.softStart > 0 || span.softEnd > 0} aria-hidden="true" style:left="{span.softStart}px" style:right="{span.softEnd}px"></span>
            {#if span.place === 'inside'}<span class="bar-label" aria-hidden="true" style:left="{span.softStart + barPad}px">{span.text}</span>{/if}
            {#if span.ongoing && span.w >= 32}<span class="going" aria-hidden="true"></span>{/if}
          </div>
          {#if span.place === 'after'}
            <span class="beside bold" aria-hidden="true" style:left="{span.x + span.w + labelGap}px" style:top="{span.y}px" style:height="{span.h}px">{span.text}</span>
          {/if}
        {/each}
        {#each track.events as event (event.ref.index)}
          {#if event.to - event.from > marker}
            <span class="whisker" aria-hidden="true" style:left="{Math.max(event.from, -marker)}px" style:width="{Math.min(event.to, width + marker) - Math.max(event.from, -marker)}px" style:top="{event.y + event.h / 2 - 5}px"></span>
          {/if}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
          <div
            role="option"
            id={idOf(event.ref)}
            class="event"
            class:uncertain={event.uncertain}
            class:active={sameRef(active, event.ref)}
            class:selected={sameRef(selected, event.ref)}
            aria-selected={sameRef(selected, event.ref)}
            aria-label={nameOf(event.ref)}
            style:left="{event.x - event.h / 2}px"
            style:top="{event.y}px"
            style:width="{event.h}px"
            style:height="{event.h}px"
            onclick={() => pick(event.ref)}
          >
            <span class="diamond" aria-hidden="true" style:width="{marker * 0.72}px" style:height="{marker * 0.72}px"></span>
          </div>
          {#if event.text !== ''}
            <span class="beside" aria-hidden="true" style:left="{event.x + marker / 2 + labelGap}px" style:top="{event.y}px" style:height="{event.h}px">{event.text}</span>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .chart {
    display: grid;
    grid-template-columns: minmax(0, 9.5rem) minmax(0, 1fr);
  }

  .names {
    position: relative;
  }

  .name {
    position: absolute;
    left: 0;
    right: var(--space-2);
    display: flex;
    align-items: flex-start;
    margin: 0;
    padding: var(--space-4) var(--space-2) 0 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink);
    font: var(--type-label);
    text-align: left;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  button.name {
    cursor: pointer;
  }

  button.name:hover,
  .name.chosen {
    background: var(--hover);
  }

  .plot {
    position: relative;
    overflow: hidden;
    cursor: grab;
    touch-action: pan-y;
    user-select: none;
    border-radius: var(--radius-sm);
  }

  .plot:active {
    cursor: grabbing;
  }

  .lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .row-line {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid var(--line);
  }

  .row-line.strong {
    border-top-color: var(--line-strong);
  }

  .tick {
    position: absolute;
    border-left: 1px solid var(--line-strong);
    transition: opacity 0.25s;
  }

  /* The signature touch: a label fades in as its tick gains room, and out as it loses it. At
     rest it is wholly there or wholly gone, so it always reads. */
  .tick-label {
    position: absolute;
    transform: translateX(-50%);
    color: var(--ink-muted);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.25s,
      visibility 0s 0.25s;
  }

  .tick-label.shown {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.25s;
  }

  [role='option'] {
    position: absolute;
    box-sizing: border-box;
    cursor: pointer;
  }

  .plot:focus-visible {
    outline-offset: calc(-1 * var(--size-ring));
  }

  /* The ring the arrow keys move, and the ring around the thing whose card is open. */
  .plot:focus-visible .active,
  .selected {
    outline: var(--size-ring) solid var(--focus-ring);
    outline-offset: var(--size-ring);
    z-index: 2;
  }

  .era {
    display: flex;
    align-items: center;
    border-left: 1px solid var(--line-strong);
  }

  .era:hover {
    background: var(--hover);
  }

  .era-label {
    padding-left: var(--space-3);
    color: var(--ink-muted);
    font: var(--type-kicker);
    white-space: nowrap;
  }

  .era:hover .era-label {
    color: var(--ink);
  }

  /* A tone is one of the suite's text colours used as a fill, with the surface colour for the
     words on it: the same contrast as text on the page, turned inside out. */
  .tone-0 {
    --fill: var(--accent-text);
  }
  .tone-1 {
    --fill: var(--caution-text);
  }
  .tone-2 {
    --fill: var(--ink-muted);
  }
  .tone-3 {
    --fill: var(--success-text);
  }
  .tone-4 {
    --fill: var(--danger-text);
  }
  .tone-5 {
    --fill: var(--ink);
  }

  .span {
    border-radius: var(--radius-md);
  }

  .solid {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: var(--radius-md);
    background: var(--fill);
  }

  .solid.cut {
    border-radius: 0;
  }

  /* An uncertain end is hollow with a dashed edge, as an uncertain event's marker is hollow. */
  .soft {
    position: absolute;
    inset: 0;
    border: 2px dashed var(--fill);
    border-radius: var(--radius-md);
  }

  .bar-label {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    color: var(--surface);
    font: var(--type-kicker);
    white-space: nowrap;
  }

  /* Still going on: an arrowhead at the end of the bar. */
  .going {
    position: absolute;
    right: var(--space-3);
    top: 50%;
    width: 9px;
    height: 9px;
    border-top: 2px solid var(--surface);
    border-right: 2px solid var(--surface);
    transform: translateY(-50%) rotate(45deg);
  }

  .beside {
    position: absolute;
    display: flex;
    align-items: center;
    color: var(--ink);
    font: var(--type-body-sm);
    white-space: nowrap;
    pointer-events: none;
  }

  .beside.bold {
    font: var(--type-kicker);
  }

  .event {
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
  }

  .event:hover {
    background: var(--hover);
  }

  .diamond {
    box-sizing: border-box;
    border: 2px solid var(--ink);
    background: var(--ink);
    transform: rotate(45deg);
  }

  /* An uncertain date: a hollow marker. */
  .uncertain .diamond {
    background: var(--surface-raised);
  }

  .whisker {
    position: absolute;
    height: 10px;
    box-sizing: border-box;
    border: solid var(--ink-muted);
    border-width: 0 2px;
    pointer-events: none;
  }

  .whisker::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 4px;
    border-top: 2px solid var(--ink-muted);
  }

  @media (max-width: 640px) {
    .chart {
      grid-template-columns: minmax(0, 6rem) minmax(0, 1fr);
    }
  }
</style>
