<script>
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
</script>

<button
  type="button"
  class="btn btn-sm btn-secondary close-panel"
  title="Close panel"
  {@attach (element) => place(element, 'closePanelHost')}
  onclick={() => globalThis.select(null)}
>✕</button>

<div class="panel-actions" {@attach (element) => place(element, 'panelActionsHost')}>
  <button
    type="button"
    class="btn btn-sm btn-secondary"
    title="Duplicate (makes a copy offset by 1 ft)"
    onclick={() => globalThis.duplicateSelected()}
  >📋 Duplicate</button>
  <button type="button" class="btn btn-sm btn-danger" onclick={() => globalThis.deleteSelected()}>🗑 Remove</button>
</div>

<style>
  .close-panel {
    padding: 4px 8px;
    font-size: 13px;
    line-height: 1;
  }
</style>
