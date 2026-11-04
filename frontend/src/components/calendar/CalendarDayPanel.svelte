<script lang="ts">
  import { cropLabel, entryWhere, formatDay, markKind, markTitle, type CalendarEntry } from '$lib/domain/calendar.js';
  import { actionLabel } from '$lib/domain/entryForm.js';

  let {
    scope = '',
    date,
    crop,
    year,
    entries,
    hiddenByFilter,
    onOpen,
  }: {
    scope?: '' | 'cell' | 'day' | 'crop';
    date: string;
    crop: string;
    year: number;
    entries: CalendarEntry[];
    hiddenByFilter: boolean;
    onOpen: (entry: CalendarEntry) => void;
  } = $props();

  const heading = $derived(
    scope === 'day' ? formatDay(date)
    : scope === 'crop' ? `${cropLabel(crop)} · ${year}`
    : scope === 'cell' ? `${formatDay(date)} · ${cropLabel(crop)}`
    : '',
  );
  const kicker = $derived(scope === 'crop' ? 'Selected crop' : 'Selected day');
  const bed = $derived(scope === 'cell' ? entries.find((entry) => entry.bed)?.bed ?? '' : '');
</script>

<section class="panel" aria-label={heading || 'Calendar entries'}>
  {#if scope}
    <div class="panel-head">
      <div>
        <p class="kicker">{kicker}</p>
        <h2>{heading}</h2>
        {#if bed}
          <p class="bed">{bed}</p>
        {/if}
      </div>
    </div>
    {#if entries.length}
      {#each entries as entry (entry.id)}
        {@const shown = markKind(entry)}
        <button type="button" class="entry" onclick={() => onOpen(entry)}>
          <span class="pip {shown}"></span>
          <div class="copy">
            {#if scope === 'day' || scope === 'crop'}
              <p class="where">{entryWhere(entry, scope)}</p>
            {/if}
            <header>
              <span class="kind">{markTitle(shown)}</span>
              <em class="status {entry.status}">{entry.status === 'done' ? 'Done' : 'Planned'}</em>
            </header>
            {#if entry.action}
              <p>{actionLabel(entry.action)}</p>
            {/if}
            {#if entry.problem}
              <p>{entry.problem}</p>
            {/if}
            {#if entry.product}
              <p>{entry.product}</p>
            {/if}
            {#if entry.detail}
              <p>{entry.detail}</p>
            {/if}
            {#if entry.note}
              <p class="note">{entry.note}</p>
            {/if}
          </div>
          {#if entry.photoUrl}
            <img class="photo" src={entry.photoUrl} alt="" />
          {/if}
        </button>
      {/each}
    {:else}
      <p class="empty">{hiddenByFilter ? 'Nothing of this kind.' : 'Nothing recorded.'}</p>
    {/if}
  {:else}
    <p class="empty">Select a day or a crop.</p>
  {/if}
</section>

<style>
  .panel {
    max-width: 640px;
    padding: 8px 8px 4px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
  }

  .panel-head {
    padding: 12px 12px 8px;
  }

  .kicker {
    margin: 0 0 2px;
    color: #6b7280;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 550;
  }

  .bed {
    margin: 4px 0 0;
    color: #4b5563;
  }

  .entry {
    display: flex;
    gap: 12px;
    width: calc(100% - 16px);
    margin: 8px 8px 12px;
    padding: 12px;
    border: 0;
    border-radius: 8px;
    background: #f7f8f6;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .entry:hover {
    background: #eef1ea;
  }

  .entry:focus-visible {
    outline: 2px solid #386a20;
    outline-offset: 2px;
  }

  .copy {
    flex: 1;
    min-width: 0;
  }

  .pip {
    width: 8px;
    flex: none;
    border-radius: 99px;
  }

  .pip.sowing { background: #a9762c; }
  .pip.care { background: #3d7ea6; }
  .pip.pest { background: #7b4b8a; }
  .pip.harvest { background: #10b981; }
  .pip.diary { background: #5f6b76; }

  header {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }

  .kind {
    font-size: 1rem;
    font-weight: 650;
  }

  .status {
    font-size: 0.85rem;
    font-style: normal;
    font-weight: 600;
  }

  .status.done { color: #386a20; }
  .status.planned { color: #6b7280; }

  p { margin: 4px 0 0; }

  .where {
    margin: 0;
    color: #1f2937;
    font-weight: 650;
  }

  .note { color: #3d4a38; }

  .photo {
    width: 128px;
    height: 128px;
    flex: none;
    align-self: flex-start;
    object-fit: cover;
    border-radius: 8px;
  }

  .empty {
    margin: 0;
    padding: 4px 12px 16px;
    color: #4b5563;
  }
</style>
