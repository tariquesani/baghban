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
            style:--i={mark.intensity ?? undefined}
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
  polygon.harvest.done { fill: rgb(16 185 129 / var(--i, 1)); }
  polygon.diary.done { fill: #5f6b76; }

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
</style>
