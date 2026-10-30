<script lang="ts">
  import {
    cropLabel,
    dayMarks,
    dayReading,
    yearDays,
    yearMonths,
    type CalendarEntry,
  } from '$lib/domain/calendar.js';
  import CalendarDay from './CalendarDay.svelte';

  let {
    year,
    rows,
    entries,
    kind,
    selectedDate,
    selectedCrop,
    onSelect,
  }: {
    year: number;
    rows: string[];
    entries: CalendarEntry[];
    kind: string;
    selectedDate: string;
    selectedCrop: string;
    onSelect: (day: { date: string; crop: string }) => void;
  } = $props();

  let scroll = $state<HTMLDivElement | null>(null);

  const months = $derived(yearMonths(year));
  const days = $derived(yearDays(year));

  function revealOctober(node: ParentNode | null | undefined) {
    const october = node?.querySelector('[data-month="Oct"]');
    if (october instanceof HTMLElement) {
      october.scrollIntoView({ inline: 'start', block: 'nearest' });
    }
  }

  export function showOctober() {
    revealOctober(scroll);
  }

  const byDay = $derived.by(() => {
    const grouped = new Map<string, CalendarEntry[]>();
    const prefix = `${year}-`;
    for (const entry of entries) {
      if (!entry.date.startsWith(prefix)) continue;
      const key = `${entry.crop}\n${entry.date}`;
      const list = grouped.get(key);
      if (list) list.push(entry);
      else grouped.set(key, [entry]);
    }
    return grouped;
  });
</script>

<div class="board" style:--rows={rows.length} style:--days={days.length}>
  <div class="names">
    <div class="label head">Crop</div>
    <div class="date-gap" aria-hidden="true"></div>
    {#each rows as crop (crop || 'garden')}
      <div class="label">{cropLabel(crop)}</div>
    {/each}
  </div>
  <div class="scroll" bind:this={scroll} {@attach revealOctober}>
    <div class="grid">
      {#each months as month (month.name)}
        <div
          class="month"
          data-month={month.name}
          style:grid-column="{month.column} / span {month.days}"
        >{month.name}</div>
      {/each}
      {#each days as day (day.date)}
        <div class="date" style:grid-column={day.column}>{Number(day.date.slice(8, 10))}</div>
      {/each}
      {#each rows as crop, rowIndex (crop || 'garden')}
        {#each days as day (`${crop}-${day.date}`)}
          {@const cell = byDay.get(`${crop}\n${day.date}`) ?? []}
          {@const marks = dayMarks(cell, kind)}
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
  .board {
    display: grid;
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

  .label {
    display: flex;
    align-items: center;
    color: #1f2937;
    font-size: 16px;
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
  .swatch.harvest { background: linear-gradient(90deg, rgb(16 185 129 / 0.35), rgb(16 185 129)); }
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
