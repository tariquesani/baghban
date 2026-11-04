<script lang="ts">
  let {
    open = false,
    title = 'Tips',
    tips = [],
    onClose,
  }: {
    open?: boolean;
    title?: string;
    tips?: string[];
    onClose: () => void;
  } = $props();

  function dismissHelp(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function closeHelpOnEscape(event: KeyboardEvent) {
    if (open && event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={closeHelpOnEscape} />

{#if open}
  <div
    class="overlay"
    role="presentation"
    onclick={dismissHelp}
  >
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="header">
        <h2 id="help-title">{title}</h2>
        <button type="button" class="close" onclick={onClose}>✕ Close</button>
      </div>
      <ul>
        {#each tips as tip (tip)}
          <li>{tip}</li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 32px 16px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.45);
  }

  .card {
    width: 100%;
    max-width: 420px;
    margin-top: 10vh;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid #e0ece0;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    color: #2d3a2e;
  }

  .close {
    width: auto;
    padding: 4px 9px;
    border: 1px solid #fca5a5;
    border-radius: 5px;
    background: #fee2e2;
    color: #dc2626;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .close:hover { background: #fecaca; }

  ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 20px 24px;
    list-style: none;
  }

  li {
    padding: 10px 12px;
    border-radius: 8px;
    background: #f4faf4;
    color: #2d3a2e;
    font-size: 13px;
    line-height: 1.4;
  }
</style>
