<script lang="ts">
  import ComingUp from '../components/home/ComingUp.svelte';
  import Gallery from '../components/home/Gallery.svelte';
  import GardenHeader from '../components/home/GardenHeader.svelte';
  import GardenPlan from '../components/home/GardenPlan.svelte';
  import { listAssignments, listBeds } from '$lib/api/beds.js';
  import { listCalendarEntries } from '$lib/api/calendar.js';
  import { readGarden } from '$lib/api/garden.js';
  import { readSky } from '$lib/api/sky.js';
  import { calendarRecord, isEntryKind } from '$lib/domain/entryForm.js';
  import { browserTimeZone, headerView } from '$lib/domain/gardenHeader.js';
  import {
    civilDate,
    comingEntries,
    cropCount,
    entryTitle,
    galleryPhotos,
    growingCards,
    harvestByCrop,
    latelyNote,
    monthWindow,
    overdueEntries,
    planAreas,
    recentEntries,
    seasonWeight,
    todayEntries,
  } from '$lib/domain/home.js';
  import type { CalendarEntry } from '$lib/domain/calendar.js';

  type GardenPayload = {
    garden?: {
      name?: string;
      subtitle?: string;
      latitude?: number | null;
      longitude?: number | null;
      timezone?: string;
    };
    beds?: PlanBed[];
  } | null;

  type PlanBed = {
    areaSqFt?: number | null;
    w?: number | null;
    h?: number | null;
    plants?: string[];
    removed?: boolean;
  };

  type Forecast = {
    high: number;
    low: number;
    rainMm: number | null;
  };

  type SkyReading = {
    weatherUnavailable?: boolean;
    weather?: { temperature: number; phrase: string; icon: string } | null;
    wind?: { speed: number; icon: string } | null;
    sunrise?: string | null;
    sunset?: string | null;
    moon?: { name: string; illumination: number; icon: string } | null;
    forecast?: Forecast | null;
  } | null;

  type Assignment = {
    id: number;
    bedId: number;
    bedName: string;
    name: string;
    emoji: string;
    createdOn: string;
    daysToMaturity: number | null;
  };

  const browserZone = browserTimeZone();

  let garden = $state.raw<GardenPayload>(null);
  let sky = $state.raw<SkyReading>(null);
  let entries = $state.raw<CalendarEntry[]>([]);
  let assignments = $state.raw<Assignment[]>([]);
  let now = $state(new Date());
  let gardenReady = $state(false);

  let view = $derived(
    headerView({
      garden: garden?.garden ?? null,
      sky,
      now,
      browserZone,
    }),
  );

  const zone = $derived(garden?.garden?.timezone || browserZone);
  const today = $derived(civilDate(now, zone));
  const span = $derived(monthWindow(today));
  const growing = $derived(growingCards(assignments, entries, today));
  const overdue = $derived(overdueEntries(entries, today));
  const todayPlan = $derived(todayEntries(entries, today));
  const soon = $derived(comingEntries(entries, today));
  const lately = $derived(
    recentEntries(entries).map((entry) => ({ id: entry.id, ...latelyNote(entry) })),
  );
  const gallery = $derived(galleryPhotos(entries));
  const season = $derived(seasonWeight(entries, today));
  const harvests = $derived(harvestByCrop(entries, today));
  const forecast = $derived(sky?.forecast ?? null);

  function rainText(mm: number) {
    const rounded = Math.round(mm * 10) / 10;
    if (Number.isInteger(rounded) || rounded >= 10) return `${Math.round(rounded)} mm`;
    return `${rounded.toFixed(1)} mm`;
  }

  function asEntry(row: Record<string, unknown>, bedName: string): CalendarEntry | null {
    const kindName = row.kind;
    const status = row.status;
    if (typeof row.id !== 'number' || typeof row.date !== 'string' || typeof kindName !== 'string') return null;
    if (!isEntryKind(kindName) || (status !== 'planned' && status !== 'done')) return null;
    return calendarRecord(row, bedName);
  }

  function asAssignment(row: Record<string, unknown>): Assignment | null {
    if (typeof row.id !== 'number' || typeof row.bedId !== 'number') return null;
    if (typeof row.name !== 'string' || typeof row.createdOn !== 'string') return null;
    return {
      id: row.id,
      bedId: row.bedId,
      bedName: typeof row.bedName === 'string' ? row.bedName : '',
      name: row.name,
      emoji: typeof row.emoji === 'string' ? row.emoji : '',
      createdOn: row.createdOn,
      daysToMaturity: typeof row.daysToMaturity === 'number' ? row.daysToMaturity : null,
    };
  }

  $effect(() => {
    let ignore = false;
    (async () => {
      let payload: GardenPayload = null;
      const bedsPromise = listBeds().catch(() => []);
      const entriesPromise = listCalendarEntries().catch(() => []);
      const assignmentsPromise = listAssignments().catch(() => []);
      try {
        payload = (await readGarden()) as GardenPayload;
      } catch {
        payload = null;
      }
      const [bedRows, entryRows, assignmentRows] = await Promise.all([
        bedsPromise,
        entriesPromise,
        assignmentsPromise,
      ]);
      if (ignore) return;
      garden = payload;
      gardenReady = true;
      const names = new Map<number, string>();
      if (Array.isArray(bedRows)) {
        for (const row of bedRows) {
          if (row && typeof row.id === 'number') names.set(row.id, typeof row.name === 'string' ? row.name : '');
        }
      }
      const mapped: CalendarEntry[] = [];
      if (Array.isArray(entryRows)) {
        for (const row of entryRows) {
          if (!row || typeof row !== 'object') continue;
          const bedId = (row as { bedId?: unknown }).bedId;
          const bedName = typeof bedId === 'number' ? names.get(bedId) ?? '' : '';
          const entry = asEntry(row as Record<string, unknown>, bedName);
          if (entry) mapped.push(entry);
        }
      }
      entries = mapped;
      assignments = Array.isArray(assignmentRows)
        ? assignmentRows.flatMap((row) => {
            const assignment = row && typeof row === 'object' ? asAssignment(row as Record<string, unknown>) : null;
            return assignment ? [assignment] : [];
          })
        : [];
      const place = payload?.garden;
      const placed = typeof place?.latitude === 'number' && typeof place?.longitude === 'number';
      try {
        const reading = await readSky(place?.timezone || browserZone);
        if (!ignore) sky = reading;
      } catch {
        if (ignore) return;
        if (placed) {
          sky = {
            weatherUnavailable: true,
            weather: null,
            wind: null,
            sunrise: null,
            sunset: null,
            moon: null,
            forecast: null,
          };
        }
      }
    })();
    return () => {
      ignore = true;
    };
  });

  $effect(() => {
    let timer = 0;
    const arm = () => {
      const delay = 60_000 - (Date.now() % 60_000) || 60_000;
      timer = window.setTimeout(() => {
        now = new Date();
        arm();
      }, delay);
    };
    arm();
    return () => window.clearTimeout(timer);
  });
</script>

<main class="home">
  {#if gardenReady}
    <div class="columns">
      <div class="primary">
        <GardenHeader
          name={view.name}
          subtitle={view.subtitle}
          items={view.items}
          prompt={view.prompt}
          latitude={view.latitude}
          longitude={view.longitude}
        />

        <section class="card">
          <h2>Currently Growing</h2>
          {#if growing.length === 0}
            <p class="empty">Nothing in the ground — record a sowing to start a crop.</p>
          {:else}
            <div class="crops">
              {#each growing as card (card.id)}
                <article>
                  <h3>{card.emoji ? `${card.emoji} ` : ''}{card.name}</h3>
                  <p>{card.bedName}</p>
                  {#if card.days}<p>{card.days}</p>{/if}
                  <p>{card.harvest}</p>
                  {#if card.maturity}<p>{card.maturity}</p>{/if}
                </article>
              {/each}
            </div>
          {/if}
        </section>

        <ComingUp start={span.start} end={span.end} {entries} {soon} />

        <GardenPlan areas={planAreas(garden?.beds ?? [])} />

        <section class="card">
          <h2>This season</h2>
          <p class="stat">{season}</p>
          <p class="lead">{cropCount(growing.length)} in the ground</p>
        </section>
      </div>

      <aside>
        <section class="card">
          <h2>Overdue</h2>
          {#if overdue.length === 0}
            <p class="empty">Nothing overdue.</p>
          {:else}
            <ul>
              {#each overdue as entry (entry.id)}
                <li><a href="/calendar?date={entry.date}">{entryTitle(entry)}</a></li>
              {/each}
            </ul>
          {/if}
        </section>

        <section class="card">
          <h2>Today</h2>
          {#if todayPlan.length === 0}
            <p class="empty">Nothing planned for today.</p>
          {:else}
            <ul>
              {#each todayPlan as entry (entry.id)}
                <li><a href="/calendar?date={entry.date}">{entryTitle(entry)}</a></li>
              {/each}
            </ul>
          {/if}
        </section>

        <section class="card">
          <h2>Lately</h2>
          {#if lately.length === 0}
            <p class="empty">Nothing recorded yet.</p>
          {:else}
            {#each lately as note (note.id)}
              <p class="note"><b>{note.date}</b> {note.text}{#if note.bed}{' '}<span>{note.bed}</span>{/if}</p>
            {/each}
          {/if}
        </section>

        <Gallery photos={gallery} />

        <section class="card">
          <h2>Today's Forecast</h2>
          {#if forecast}
            <div class="sky">
              <p>High <strong>{forecast.high}°C</strong></p>
              <p>Low <strong>{forecast.low}°C</strong></p>
              {#if forecast.rainMm !== null}<p>Rain overnight <strong>{rainText(forecast.rainMm)}</strong></p>{/if}
            </div>
          {:else}
            <p class="empty">Forecast unavailable.</p>
          {/if}
        </section>

        <section class="card">
          <h2>Harvest this year</h2>
          {#if harvests.length === 0}
            <p class="empty">Nothing harvested yet.</p>
          {:else}
            <ul class="bars">
              {#each harvests as row (row.crop)}
                <li>
                  <span>{row.crop}</span>
                  <i style:width="{row.width}%"></i>
                  <em>{row.label}</em>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </aside>
    </div>
  {/if}
</main>

<style>
  .home {
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: 16px 24px 24px;
    background: #f0f4f0;
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 16px;
    align-items: start;
  }

  .primary, aside {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .card {
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

  .crops {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  article {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    border: 1px solid rgba(25, 29, 23, 0.1);
    border-radius: 12px;
    background: #f4f7f4;
  }

  h3, p, li {
    margin: 0;
    color: #191d17;
    font-size: 0.9rem;
  }

  h3 { font-size: 1rem; }

  article p:nth-of-type(1) { color: #5c6560; }

  .empty, .lead {
    margin: 4px 0 0;
    color: #5c6560;
    font-size: 0.9rem;
  }

  .stat {
    margin-top: 8px;
    color: #386a20;
    font-size: 1.6rem;
    font-weight: 600;
  }

  .sky {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
    margin-top: 14px;
  }

  .sky p {
    margin: 0;
    color: #5c6560;
    font-size: 0.85rem;
  }

  .sky strong {
    display: block;
    color: #191d17;
    font-size: 1rem;
    font-weight: 600;
  }

  ul {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  li + li { margin-top: 8px; }

  a {
    color: #191d17;
    text-decoration: none;
  }

  a:hover { color: #386a20; }

  .note {
    margin: 0;
    padding: 8px 0;
    border-top: 1px solid rgba(25, 29, 23, 0.08);
    color: #191d17;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .note b { font-weight: 600; }

  .note span { color: #5c6560; }

  .bars li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
    align-items: center;
  }

  .bars i {
    grid-column: 1 / -1;
    display: block;
    height: 8px;
    border-radius: 99px;
    background: #386a20;
  }

  .bars em {
    color: #5c6560;
    font-style: normal;
  }

  @media (max-width: 1100px) {
    .columns { grid-template-columns: 1fr; }
  }
</style>
