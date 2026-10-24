<script>
  import SidebarButton from './SidebarButton.svelte';

  let open = $state(false);
  let showForBed = $state(false);

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

  /** @param {CustomEvent} event */
  function noteDetails(event) {
    showForBed = Boolean(event.detail?.showPlants);
  }

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
  onselectiondetails={noteDetails}
  onorganizeropen={noteOpen}
  onorganizerclose={noteClose}
/>

<div {@attach (element) => place(element, 'organizerToolHost')}>
  <SidebarButton label="Plant organizer" icon="layout-grid" onPress={() => globalThis.openReport()} />
</div>

<div
  class="organizer-row"
  hidden={!showForBed}
  {@attach (element) => place(element, 'organizerHost')}
>
  <button type="button" class="btn btn-primary open-organizer" onclick={() => globalThis.openReport()}>
    🌱 Open Plant Organizer
  </button>
</div>

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

<style>
  .organizer-row {
    padding: 8px 14px;
    border-bottom: 1px solid #ddeadd;
  }
  .open-organizer {
    width: 100%;
    padding: 9px;
    font-size: 14px;
  }
</style>
