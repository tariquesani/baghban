<script lang="ts">
  import type { DayMark } from '$lib/domain/calendar.js';

  let {
    column,
    row,
    reading,
    marks,
    recorded,
    selected,
    onSelect,
  }: {
    column: number;
    row: number;
    reading: string;
    marks: DayMark[];
    recorded: boolean;
    selected: boolean;
    onSelect: () => void;
  } = $props();
</script>

{#if recorded || selected}
  <button
    type="button"
    class="day"
    class:selected
    style:grid-column={column}
    style:grid-row={row}
    aria-label={reading}
    title={reading}
    aria-pressed={selected}
    onclick={onSelect}
  >
    {#if marks.length}
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {#each marks as mark (`${mark.kind}-${mark.status}`)}
          <polygon
            points={mark.points}
            class="{mark.kind} {mark.status}"
            data-shade={mark.shade ?? undefined}
          />
        {/each}
      </svg>
    {/if}
  </button>
{:else}
  <div class="day" style:grid-column={column} style:grid-row={row} aria-hidden="true"></div>
{/if}

<style>
  .day {
    position: relative;
    overflow: hidden;
    border-radius: 4px;
    background: #e2e8f0;
  }

  button.day {
    padding: 0;
    border: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  button.day:hover {
    box-shadow: inset 0 0 0 1px #94a3b8;
    z-index: 1;
  }

  button.day.selected,
  button.day.selected:hover {
    box-shadow: inset 0 0 0 1.5px #1f2937;
    z-index: 2;
  }

  svg {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  polygon.sowing.done { fill: #a9762c; }
  polygon.care.done { fill: #3d7ea6; }
  polygon.pest.done { fill: #7b4b8a; }
  polygon.harvest.done { fill: var(--harvest-5, #10b981); }
  polygon.harvest.done[data-shade='1'] { fill: var(--harvest-1, #b6f0d4); }
  polygon.harvest.done[data-shade='2'] { fill: var(--harvest-2, #86e4bc); }
  polygon.harvest.done[data-shade='3'] { fill: var(--harvest-3, #54d4a4); }
  polygon.harvest.done[data-shade='4'] { fill: var(--harvest-4, #2cc48e); }
  polygon.harvest.done[data-shade='5'] { fill: var(--harvest-5, #10b981); }
  polygon.harvest.done[data-shade='6'] { fill: var(--harvest-6, #059669); }
  polygon.harvest.done[data-shade='7'] { fill: var(--harvest-7, #047857); }
  polygon.harvest.done[data-shade='8'] { fill: var(--harvest-8, #064e3b); }
  polygon.diary.done { fill: #5f6b76; }
  polygon.uproot.done { fill: #a35d3a; }

  polygon.planned {
    fill: none;
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
  }

  polygon.sowing.planned { stroke: #a9762c; }
  polygon.care.planned { stroke: #3d7ea6; }
  polygon.pest.planned { stroke: #7b4b8a; }
  polygon.harvest.planned { stroke: #10b981; }
  polygon.diary.planned { stroke: #5f6b76; }
  polygon.uproot.planned { stroke: #a35d3a; }
</style>
