<script lang="ts">
  import {
    cropLabel,
    dayMarks,
    dayReading,
    formatDay,
    harvestPeaks,
    monthName,
    spanDays,
    spanMonths,
    yearDays,
    yearMonths,
    type CalendarEntry,
  } from '$lib/domain/calendar.js';
  import CropMark from '../crops/CropMark.svelte';
  import CalendarDay from './CalendarDay.svelte';

  let {
    year,
    rows,
    entries,
    kind,
    selectedDate,
    selectedCrop,
    activeDate = '',
    activeCrop = '',
    from = '',
    to = '',
    focus = '',
    reveal = '',
    marks,
    onSelect,
    onSelectDay,
    onSelectCrop,
  }: {
    year: number;
    rows: string[];
    entries: CalendarEntry[];
    kind: string;
    selectedDate: string;
    selectedCrop: string;
    activeDate?: string;
    activeCrop?: string;
    from?: string;
    to?: string;
    focus?: string;
    reveal?: string;
    marks?: Record<string, { id: number; icon: string; iconRev?: number | null; emoji: string }>;
    onSelect: (day: { date: string; crop: string }) => void;
    onSelectDay?: (date: string) => void;
    onSelectCrop?: (crop: string) => void;
  } = $props();

  let scroll = $state<HTMLDivElement | null>(null);

  const bounded = $derived(from !== '' && to !== '');
  const months = $derived(bounded ? spanMonths(from, to) : yearMonths(year));
  const days = $derived(bounded ? spanDays(from, to) : yearDays(year));

  function revealCurrentMonth(node: ParentNode | null | undefined) {
    revealMonth(node, monthName());
  }

  export function showCurrentMonth() {
    revealMonth(scroll, focus || monthName());
  }

  function revealMonth(node: ParentNode | null | undefined, name: string) {
    const month = node?.querySelector(`[data-month="${name}"]`);
    if (month instanceof HTMLElement) {
      month.scrollIntoView({ inline: 'start', block: 'nearest' });
    }
  }

  function revealDate(node: ParentNode | null | undefined, date: string) {
    const day = node?.querySelector(`[data-date="${date}"]`);
    if (day instanceof HTMLElement) {
      day.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }

  $effect(() => {
    if (reveal) revealDate(scroll, reveal);
    else if (focus) revealMonth(scroll, focus);
  });

  const byDay = $derived.by(() => {
    const grouped = new Map<string, CalendarEntry[]>();
    const prefix = `${year}-`;
    for (const entry of entries) {
      if (bounded) {
        if (entry.date < from || entry.date > to) continue;
      } else if (!entry.date.startsWith(prefix)) continue;
      const key = `${entry.crop}\n${entry.date}`;
      const list = grouped.get(key);
      if (list) list.push(entry);
      else grouped.set(key, [entry]);
    }
    return grouped;
  });

  const peaks = $derived(harvestPeaks(entries));
</script>

<div class="board" class:bare={bounded} style:--rows={rows.length} style:--days={days.length}>
  <div class="names">
    <div class="label head">Crop</div>
    <div class="date-gap" aria-hidden="true"></div>
    {#each rows as crop (crop || 'garden')}
      {@const mark = marks?.[crop]}
      {#if onSelectCrop}
        <button
          type="button"
          class={['label', { marked: Boolean(mark), selected: activeCrop === crop }]}
          aria-pressed={activeCrop === crop}
          aria-label="{cropLabel(crop)}, {year}"
          onclick={() => onSelectCrop(crop)}
        >{#if mark}<CropMark id={mark.id} icon={mark.icon} iconRev={mark.iconRev} emoji={mark.emoji} />{/if}<span class="name">{cropLabel(crop)}</span></button>
      {:else}
        <div class={['label', { marked: Boolean(mark) }]}>{#if mark}<CropMark id={mark.id} icon={mark.icon} iconRev={mark.iconRev} emoji={mark.emoji} />{/if}<span class="name">{cropLabel(crop)}</span></div>
      {/if}
    {/each}
  </div>
  <div class="scroll" bind:this={scroll} {@attach (node) => {
    if (reveal) revealDate(node, reveal);
    else if (focus) revealMonth(node, focus);
    else if (!bounded) revealCurrentMonth(node);
  }}>
    <div class="grid">
      {#each months as month (month.column)}
        <div
          class="month"
          data-month={month.name}
          style:grid-column="{month.column} / span {month.days}"
        >{month.name}</div>
      {/each}
      {#each days as day (day.date)}
        {#if onSelectDay}
          <button
            type="button"
            class={['date', { selected: activeDate === day.date }]}
            data-date={day.date}
            style:grid-column={day.column}
            aria-pressed={activeDate === day.date}
            aria-label="All crops on {formatDay(day.date)}"
            onclick={() => onSelectDay(day.date)}
          >{Number(day.date.slice(8, 10))}</button>
        {:else}
          <div class="date" data-date={day.date} style:grid-column={day.column}>{Number(day.date.slice(8, 10))}</div>
        {/if}
      {/each}
      {#each rows as crop, rowIndex (crop || 'garden')}
        {#each days as day (`${crop}-${day.date}`)}
          {@const cell = byDay.get(`${crop}\n${day.date}`) ?? []}
          {@const marks = dayMarks(cell, kind, peaks.get(crop) ?? 0)}
          <CalendarDay
            column={day.column}
            row={rowIndex + 3}
            {marks}
            recorded={cell.length > 0}
            reading={dayReading(day.date, crop, marks)}
            selected={selectedDate === day.date && selectedCrop === crop}
            onSelect={() => onSelect({ date: day.date, crop })}
          />
        {/each}
      {/each}
    </div>
  </div>
  <ul class="key">
    <li><i class="swatch sowing"></i> Sowing</li>
    <li><i class="swatch care"></i> Care</li>
    <li><i class="swatch pest"></i> Pest</li>
    <li><i class="swatch harvest"></i> Harvest, darker is more</li>
    <li><i class="swatch diary"></i> Diary</li>
    <li><i class="swatch planned"></i> Hollow is planned</li>
  </ul>
</div>

<style>
  .board.bare {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .board {
    --harvest-1: #b6f0d4;
    --harvest-2: #86e4bc;
    --harvest-3: #54d4a4;
    --harvest-4: #2cc48e;
    --harvest-5: #10b981;
    --harvest-6: #059669;
    --harvest-7: #047857;
    --harvest-8: #064e3b;
    display: grid;
    min-width: 0;
    grid-template-columns: 160px minmax(0, 1fr);
    column-gap: 16px;
    align-items: start;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
  }

  .names {
    display: grid;
    grid-template-rows: auto 16px repeat(var(--rows), 32px);
    gap: 4px;
    width: 160px;
  }

  .scroll {
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    padding-bottom: 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--days), 32px);
    grid-template-rows: auto 16px repeat(var(--rows), 32px);
    gap: 4px;
    width: max-content;
  }

  .month {
    display: flex;
    align-items: center;
    justify-content: center;
    grid-row: 1;
    padding-bottom: 12px;
    color: #6b7280;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
  }

  .date {
    display: flex;
    align-items: center;
    justify-content: center;
    grid-row: 2;
    color: #9ca3af;
    font-size: 10px;
    line-height: 1;
  }

  button.date,
  button.label {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }

  button.date {
    font-size: 10px;
    color: #9ca3af;
  }

  button.date:hover,
  button.label:hover {
    color: #386a20;
  }

  button.date.selected {
    color: #1f2937;
    font-weight: 700;
  }

  button.date:focus-visible,
  button.label:focus-visible {
    outline: 2px solid #386a20;
    outline-offset: 1px;
  }

  .label {
    display: flex;
    align-items: center;
    color: #1f2937;
    font-size: 16px;
  }

  .label.marked {
    gap: 6px;
  }

  .label.marked .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button.label {
    width: 100%;
    min-width: 0;
    font-size: 16px;
    color: #1f2937;
    text-align: start;
  }

  button.label.selected {
    font-weight: 650;
    color: #14532d;
  }

  .label.head {
    padding-bottom: 12px;
    color: #6b7280;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px 18px;
    grid-column: 2;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    color: #3d4a38;
    font-size: 0.85rem;
  }

  .key li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    display: inline-block;
  }

  .swatch.sowing { background: #a9762c; }
  .swatch.care { background: #3d7ea6; }
  .swatch.pest { background: #7b4b8a; }
  .swatch.harvest {
    background: linear-gradient(
      90deg,
      var(--harvest-1) 0 12.5%,
      var(--harvest-2) 12.5% 25%,
      var(--harvest-3) 25% 37.5%,
      var(--harvest-4) 37.5% 50%,
      var(--harvest-5) 50% 62.5%,
      var(--harvest-6) 62.5% 75%,
      var(--harvest-7) 75% 87.5%,
      var(--harvest-8) 87.5% 100%
    );
  }
  .swatch.diary { background: #5f6b76; }
  .swatch.planned {
    background:
      linear-gradient(#a9762c, #a9762c) top / 100% 2px no-repeat,
      linear-gradient(#a9762c, #a9762c) bottom / 100% 2px no-repeat,
      linear-gradient(#a9762c, #a9762c) left / 2px 100% no-repeat,
      linear-gradient(#a9762c, #a9762c) right / 2px 100% no-repeat,
      #fff;
  }
</style>
