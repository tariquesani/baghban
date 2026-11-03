<script lang="ts">
  import CalendarGrid from '../calendar/CalendarGrid.svelte';
  import { entryRows, formatDay, kindLabel, monthNameFromIso, shiftMonth } from '$lib/domain/calendar.js';
  import type { CalendarEntry } from '$lib/domain/calendar.js';

  type Brief = {
    id: string;
    date: string;
    crop: string;
    kind: string;
    bed: string;
  };

  let {
    start,
    end,
    entries,
    soon,
  }: {
    start: string;
    end: string;
    entries: CalendarEntry[];
    soon: Brief[];
  } = $props();

  const visible = $derived(entries.filter((entry) => entry.date >= start && entry.date <= end));
  const rows = $derived(entryRows(visible));
  const year = $derived(Number((start || '0000').slice(0, 4)));

  function openDay(day: { date: string }) {
    const next = `/calendar?date=${day.date}`;
    if (`${window.location.pathname}${window.location.search}` === next) return;
    history.pushState(null, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
</script>

<section class="card">
  <h2>Coming up</h2>
  <CalendarGrid
    {year}
    rows={rows}
    entries={entries}
    kind=""
    selectedDate=""
    selectedCrop=""
    from={start}
    to={end}
    focus={monthNameFromIso(shiftMonth(start, 1))}
    onSelect={openDay}
  />
  {#if soon.length}
    <div class="soon">
      {#each soon as entry (entry.id)}
        <a href="/calendar?date={entry.date}">
          <strong>{formatDay(entry.date)}</strong>
          <span>{kindLabel(entry.kind)}{entry.crop ? ` · ${entry.crop}` : ''}</span>
          {#if entry.bed}<em>{entry.bed}</em>{/if}
        </a>
      {/each}
    </div>
  {:else}
    <p class="empty">Nothing planned in the next two weeks.</p>
  {/if}
</section>

<style>
  .card {
    min-width: 0;
    padding: 20px;
    border: 1px solid rgba(25, 29, 23, 0.12);
    border-radius: 16px;
    background: #fff;
  }

  h2 {
    margin: 0;
    color: #191d17;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .soon {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  a {
    display: block;
    padding: 8px 10px;
    border: 1px solid rgba(25, 29, 23, 0.12);
    border-radius: 10px;
    background: #f4f7f4;
    color: #191d17;
    text-decoration: none;
  }

  a:hover { border-color: #386a20; }

  strong {
    display: block;
    color: #386a20;
    font-size: 0.72rem;
    font-weight: 600;
  }

  span, em {
    display: block;
    font-size: 0.8rem;
    font-style: normal;
    line-height: 1.3;
  }

  em { color: #5c6560; font-size: 0.72rem; }

  .empty {
    margin: 14px 0 0;
    color: #5c6560;
    font-size: 0.9rem;
  }
</style>
