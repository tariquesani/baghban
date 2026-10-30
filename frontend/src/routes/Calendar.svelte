<script lang="ts">
  import { untrack } from 'svelte';
  import CalendarDayPanel from '../components/calendar/CalendarDayPanel.svelte';
  import CalendarGrid from '../components/calendar/CalendarGrid.svelte';
  import CalendarKindFilter from '../components/calendar/CalendarKindFilter.svelte';
  import EntryDialog from '../components/calendar/EntryDialog.svelte';
  import RecordDialog from '../components/calendar/RecordDialog.svelte';
  import { listBeds } from '$lib/api/beds.js';
  import { listCalendarEntries } from '$lib/api/calendar.js';
  import { calendarRows, dayEntries, type CalendarEntry } from '$lib/domain/calendar.js';
  import { calendarRecord, isEntryKind } from '$lib/domain/entryForm.js';

  let {
    entryOpen = $bindable(false),
    entrySession = 0,
    entryKind = 'sowing',
  }: {
    entryOpen?: boolean;
    entrySession?: number;
    entryKind?: string;
  } = $props();

  let year = $state(new Date().getFullYear());
  let kind = $state('');
  let selected = $state<{ date: string; crop: string } | null>(null);
  let saved = $state<CalendarEntry[]>([]);
  let grid = $state<{ showOctober: () => void } | null>(null);
  let detail = $state<CalendarEntry | null>(null);
  let formEntry = $state<CalendarEntry | null>(null);
  let editSession = $state(0);

  const entries = $derived(saved);
  const rows = $derived(calendarRows(entries, year));
  const shown = $derived(
    selected ? dayEntries(entries, selected.date, selected.crop, kind) : [],
  );
  const recorded = $derived(
    selected ? dayEntries(entries, selected.date, selected.crop, '') : [],
  );

  function showYear(next: number) {
    year = next;
    selected = null;
  }

  function showOctober() {
    grid?.showOctober();
  }

  function addSowing(entry: CalendarEntry) {
    saved = [...saved.filter((item) => item.id !== entry.id), entry];
    year = Number(entry.date.slice(0, 4));
    selected = { date: entry.date, crop: entry.crop };
  }

  function editEntry(entry: CalendarEntry) {
    formEntry = entry;
    editSession += 1;
    entryOpen = true;
  }

  function forgetEntry(id: string) {
    saved = saved.filter((item) => item.id !== id);
  }

  function storedEntry(row: Record<string, unknown>, bedName: string): CalendarEntry | null {
    const kindName = row.kind;
    const status = row.status;
    if (typeof row.id !== 'number' || typeof row.date !== 'string' || typeof kindName !== 'string') return null;
    if (!isEntryKind(kindName) || (status !== 'planned' && status !== 'done')) return null;
    return calendarRecord(
      {
        ...row,
        kind: kindName,
        status,
        crop: typeof row.crop === 'string' ? row.crop : '',
        note: typeof row.note === 'string' ? row.note : '',
        photoUrl: typeof row.photoUrl === 'string' ? row.photoUrl : '',
      },
      bedName,
    );
  }

  $effect(() => {
    let cancel = false;
    Promise.all([listCalendarEntries(), listBeds()])
      .then(([rows, beds]) => {
        if (cancel || !Array.isArray(rows)) return;
        const names = new Map<number, string>();
        if (Array.isArray(beds)) {
          for (const bed of beds) {
            if (bed && typeof bed === 'object' && typeof bed.id === 'number' && typeof bed.name === 'string') {
              names.set(bed.id, bed.name);
            }
          }
        }
        const loaded: CalendarEntry[] = [];
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const bedId = 'bedId' in row ? row.bedId : null;
          const bedName = typeof bedId === 'number' ? names.get(bedId) ?? '' : '';
          const entry = storedEntry(row, bedName);
          if (entry) loaded.push(entry);
        }
        const byId = new Map(loaded.map((entry) => [entry.id, entry]));
        for (const entry of untrack(() => saved)) byId.set(entry.id, entry);
        saved = [...byId.values()];
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  });
</script>

<main class="calendar">
  <div class="top">
    <CalendarKindFilter {kind} onKind={(value) => (kind = value)} onShowOctober={showOctober} />
    <p class="year">
      <button type="button" onclick={() => showYear(year - 1)}>{year - 1}</button>
      <strong>{year}</strong>
      <button type="button" onclick={() => showYear(year + 1)}>{year + 1}</button>
    </p>
  </div>

  <CalendarGrid
    bind:this={grid}
    {year}
    {rows}
    {entries}
    {kind}
    selectedDate={selected?.date ?? ''}
    selectedCrop={selected?.crop ?? ''}
    onSelect={(day) => (selected = day)}
  />

  <CalendarDayPanel
    date={selected?.date ?? ''}
    crop={selected?.crop ?? ''}
    entries={shown}
    hiddenByFilter={recorded.length > 0 && shown.length === 0}
    onOpen={(entry) => (detail = entry)}
  />

  <EntryDialog bind:entry={detail} onEdit={editEntry} onDeleted={forgetEntry} />

  <RecordDialog
    bind:open={entryOpen}
    kind={entryKind}
    addSession={entrySession}
    {editSession}
    entry={formEntry}
    selectedDate={selected?.date ?? ''}
    selectedCrop={selected?.crop ?? ''}
    onSaved={addSowing}
  />
</main>

<style>
  .calendar {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 100%;
    padding: 8px 24px 32px;
    color: #191d17;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 32px;
  }

  .year {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin: 0;
    font-size: 1.05rem;
  }

  .year button {
    padding: 0;
    border: 0;
    background: none;
    color: #8a9384;
    font: inherit;
    cursor: pointer;
  }

  .year button:hover {
    color: #386a20;
  }

  .year strong {
    font-size: 1.35rem;
    font-weight: 600;
  }

  @media (max-width: 800px) {
    .calendar { padding: 8px 16px 24px; }
  }
</style>
