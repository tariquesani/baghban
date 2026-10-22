<script>
  import SidebarButton from './SidebarButton.svelte';

  let open = $state(false);

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

  function openDialog() {
    open = true;
  }

  function closeDialog() {
    open = false;
  }

  function startFresh() {
    globalThis.confirmNewGarden();
    closeDialog();
  }

  /** @param {MouseEvent} event */
  function dismiss(event) {
    if (event.target === event.currentTarget) closeDialog();
  }

  /** @param {KeyboardEvent} event */
  function closeOnEscape(event) {
    if (event.key === 'Escape') closeDialog();
  }
</script>

<svelte:document onnewgarden={openDialog} />

<div {@attach (element) => place(element, 'newGardenHost')}>
  <SidebarButton label="New garden" icon="plus" onPress={() => globalThis.showNewGardenDialog()} />
</div>

{#if open}
  <div
    class="new-garden"
    role="presentation"
    onclick={dismiss}
    onkeydown={closeOnEscape}
  >
    <div class="new-garden-card" role="dialog" aria-modal="true" aria-labelledby="new-garden-title">
      <div class="new-garden-header">
        <div class="new-garden-mark" aria-hidden="true">🌿</div>
        <h2 id="new-garden-title">Start a New Garden?</h2>
      </div>
      <div class="new-garden-body">
        <p>This will <strong>clear all beds, obstacles, and plants</strong> from the canvas.</p>
        <p class="new-garden-warn">⚠️ Your current plan will not be saved automatically.</p>
        <button type="button" class="save-first" onclick={() => globalThis.saveJSON()}>💾 Save current plan first</button>
        <button type="button" class="start-fresh" onclick={startFresh}>🌿 Yes, start fresh</button>
        <button type="button" class="cancel" onclick={closeDialog}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .new-garden {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.5);
  }
  .new-garden-card {
    width: 100%;
    max-width: 360px;
    overflow: hidden;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
  }
  .new-garden-header {
    padding: 20px 22px 14px;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
  }
  .new-garden-mark {
    margin-bottom: 8px;
    font-size: 28px;
  }
  h2 {
    margin: 0;
    color: #991b1b;
    font-size: 17px;
    font-weight: 700;
  }
  .new-garden-body {
    padding: 16px 22px;
  }
  p {
    margin: 0 0 6px;
    color: #555;
    font-size: 13px;
    line-height: 1.5;
  }
  .new-garden-warn {
    margin-bottom: 16px;
    color: #e57373;
    font-size: 12px;
    font-weight: 600;
  }
  button {
    width: 100%;
    margin-bottom: 8px;
    padding: 9px;
    border-radius: 7px;
    font-size: 13px;
    cursor: pointer;
  }
  .save-first {
    border: 1px solid #b8d8b8;
    background: #e8f4e8;
    color: #2d6a30;
    font-weight: 600;
  }
  .start-fresh {
    border: none;
    background: #dc2626;
    color: #fff;
    font-weight: 700;
  }
  .cancel {
    padding: 8px;
    border: 1px solid #ddd;
    background: #f5f5f5;
    color: #666;
  }
</style>
