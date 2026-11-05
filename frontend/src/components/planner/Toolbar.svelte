<script>
  import ToolbarButton from './ToolbarButton.svelte';

  let snapped = $state(false);

  /**
   * @param {HTMLElement} element
   * @param {string} hostId
   */
  function place(element, hostId) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.replaceWith(element);
    return () => element.remove();
  }

  function toggleSnap() {
    snapped = !snapped;
  }
</script>

<div
  class="map-tools"
  {@attach (element) => place(element, 'toolbarHost')}
>
  <ToolbarButton
    id="snapToggle"
    label="Snap to ½ ft grid"
    icon="magnet"
    pressed={snapped}
    active={snapped}
    onPress={toggleSnap}
  />
  <button type="button" class="zoom" title="Zoom in" aria-label="Zoom in" onclick={() => globalThis.adjustZoom(1.2)}>＋</button>
  <button type="button" class="zoom" title="Fit to screen" aria-label="Fit to screen" onclick={() => { globalThis.fitView(); globalThis.draw(); }}>⤢</button>
  <button type="button" class="zoom" title="Zoom out" aria-label="Zoom out" onclick={() => globalThis.adjustZoom(1 / 1.2)}>－</button>
</div>

<style>
  .map-tools {
    position: absolute;
    z-index: 5;
    right: 12px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border: 1px solid #c6d9c6;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 10px rgba(25, 29, 23, 0.16);
  }

  .zoom {
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

  .zoom:hover { background: #e0eee0; }

  .map-tools :global(.tool-btn) {
    width: 36px;
    height: 36px;
    border-radius: 8px;
  }

  :global(.app.panel-open) .map-tools {
    bottom: 12px;
  }

  @media (max-width: 680px) {
    :global(.app.panel-open) .map-tools {
      bottom: calc(62vh + 12px);
    }
  }
</style>
