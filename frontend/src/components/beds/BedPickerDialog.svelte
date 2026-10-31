<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { mountBedPicker } from '$lib/planner/mount.js';

  type Picker = ReturnType<typeof mountBedPicker>;

  let {
    open = $bindable(false),
    bedId,
    onPick,
  }: {
    open?: boolean;
    bedId: string;
    onPick: (id: number) => void;
  } = $props();

  let picker = $state<Picker | null>(null);

  function mountPick(element: HTMLElement) {
    const visit = mountBedPicker(element);
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

  $effect(() => {
    picker?.showBed(bedId);
  });

  function onBedPick(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    const id = event.detail?.id;
    if (typeof id !== 'number') return;
    onPick(id);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[calc(100vh-2rem)] flex-col gap-4 sm:max-w-4xl">
    <Dialog.Header class="shrink-0 pr-8">
      <Dialog.Title>Click a bed to select, Drag to move around</Dialog.Title>
    </Dialog.Header>
    <div class="bed-picker relative h-[min(60vh,32rem)] overflow-hidden rounded-lg border" onbedpick={onBedPick}>
      {#if open}
        <div class="size-full" {@attach mountPick}></div>
      {/if}
      <div class="zoom-tools">
        <button type="button" aria-label="Zoom in" disabled={!picker} onclick={() => picker?.zoom(1.2)}>＋</button>
        <button type="button" aria-label="Zoom out" disabled={!picker} onclick={() => picker?.zoom(1 / 1.2)}>－</button>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

<style>
  .bed-picker :global(.app) {
    display: flex;
    width: 100%;
    height: 100%;
    background: #f0f4f0;
  }

  .bed-picker :global(.main) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .bed-picker :global(.canvas-area) {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .bed-picker :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .bed-picker :global(#toolbarHost) {
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
