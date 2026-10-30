<script>
  let open = $state(false);

  function noteOpen() {
    if (open) globalThis.switchTab('plant');
    open = true;
  }

  function noteClose() {
    open = false;
  }

  /** @param {MouseEvent} event */
  function dismiss(event) {
    if (event.target === event.currentTarget) noteClose();
  }

  /** @param {KeyboardEvent} event */
  function closeOnEscape(event) {
    if (event.key === 'Escape') noteClose();
  }
</script>

<svelte:document
  onorganizeropen={noteOpen}
  onorganizerclose={noteClose}
/>

{#if open}
  <div
    class="modal-overlay"
    role="presentation"
    onclick={dismiss}
    onkeydown={closeOnEscape}
  >
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="tab-plant">
      <div class="modal-header">
        <div class="modal-tabs">
          <button class="tab-btn active" id="tab-plant" type="button">🌱 Plant Organizer</button>
        </div>
        <button type="button" class="btn btn-sm btn-danger" onclick={noteClose}>✕ Close</button>
      </div>
      <div
        class="modal-body"
        id="reportBody"
        {@attach () => { globalThis.switchTab('plant'); }}
      ></div>
    </div>
  </div>
{/if}

