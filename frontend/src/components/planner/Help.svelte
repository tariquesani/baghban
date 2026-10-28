<script>
  let { open = false, onClose } = $props();

  function closeHelp() {
    onClose();
  }

  /** @param {MouseEvent} event */
  function dismissHelp(event) {
    if (event.target === event.currentTarget) closeHelp();
  }

  /** @param {KeyboardEvent} event */
  function closeHelpOnEscape(event) {
    if (event.key === 'Escape') closeHelp();
  }
</script>

{#if open}
  <div
    class="modal-overlay"
    role="presentation"
    onclick={dismissHelp}
    onkeydown={closeHelpOnEscape}
  >
    <div class="modal-card help-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="modal-header">
        <h2 id="help-title" class="help-title">Tips</h2>
        <button type="button" class="btn btn-sm btn-danger" onclick={closeHelp}>✕ Close</button>
      </div>
      <div class="modal-body">
        <ul class="help-tips">
          <li>Drag an item to move it. Drag empty ground to pan</li>
          <li>Hold Space, or use the middle mouse button, to pan from anywhere</li>
          <li>Drag the ↻ handle to rotate; hold Shift to snap to 15°</li>
          <li>Recalibrate a plan from Garden settings if the scale looks wrong</li>
          <li>Plot a bed by clicking corners</li>
          <li>Double-click to close a polygon or rename an item</li>
        </ul>
      </div>
    </div>
  </div>
{/if}
