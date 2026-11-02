<script lang="ts">
  import { mountBedPicker } from '$lib/planner/mount.js';

  type Picker = ReturnType<typeof mountBedPicker>;

  let {
    areas,
  }: {
    areas: { planted: string; empty: string; total: string };
  } = $props();

  let picker = $state<Picker | null>(null);

  function mountPlan(element: HTMLElement) {
    const visit = mountBedPicker(element, { occupancy: true });
    let stopped = false;
    visit.ready.then(() => {
      if (stopped) return;
      picker = visit;
    });
    return () => {
      stopped = true;
      picker = null;
      visit.destroy();
    };
  }
</script>

<section class="card">
  <h2>Garden plan</h2>
  <p class="lead">
    Planted: <strong>{areas.planted}</strong> sqft | Empty: <strong>{areas.empty}</strong> sqft | Total: <strong>{areas.total}</strong> sqft
  </p>
  <div class="stage">
    <div class="host" {@attach mountPlan}></div>
    <div class="zoom-tools">
      <button type="button" aria-label="Zoom in" disabled={!picker} onclick={() => picker?.zoom(1.2)}>＋</button>
      <button type="button" aria-label="Zoom out" disabled={!picker} onclick={() => picker?.zoom(1 / 1.2)}>－</button>
    </div>
  </div>
</section>

<style>
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

  .lead {
    margin: 4px 0 0;
    color: #5c6560;
    font-size: 0.9rem;
  }

  .lead strong {
    color: #191d17;
    font-weight: 700;
  }

  .stage {
    position: relative;
    height: 70vh;
    min-height: 36rem;
    margin-top: 16px;
    overflow: hidden;
    border: 1px solid #a8c8a8;
    border-radius: 12px;
    background: #f0f4f0;
  }

  .host {
    width: 100%;
    height: 100%;
  }

  .stage :global(.app) {
    display: flex;
    width: 100%;
    height: 100%;
    background: #f0f4f0;
  }

  .stage :global(.main) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .stage :global(.canvas-area) {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .stage :global(#toolbarHost) {
    display: none;
  }

  .zoom-tools {
    position: absolute;
    z-index: 5;
    right: 12px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .zoom-tools button {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid #c6d9c6;
    border-radius: 8px;
    background: #f0f4f0;
    color: #2d3a2e;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .zoom-tools button:hover {
    background: #e0eee0;
  }

  .zoom-tools button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
