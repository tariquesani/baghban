<script>
  /**
   * @param {{
   *   areas: Array<{ id: string, name: string, color: string, size: string, plants?: string }>,
   *   selectedId: string | null,
   *   hostId: string,
   *   emptyLabel: string,
   *   selectType: 'bed' | 'obstacle'
   * }} props
   */
  let { areas, selectedId, hostId, emptyLabel, selectType } = $props();

  /**
   * @param {HTMLElement} element
   * @param {string} id
   */
  function place(element, id) {
    const host = document.getElementById(id);
    if (!host) return;
    host.replaceWith(element);
    return () => element.remove();
  }
</script>

<div class="panel-block" {@attach (element) => place(element, hostId)}>
  {#each areas as area (area.id)}
    <button
      type="button"
      class={['list-item', area.id === selectedId && 'selected']}
      onclick={() => globalThis.select(area.id, selectType)}
    >
      <div class="list-item-header">
        <div class="list-item-title">
          <div class="color-dot" style:background={area.color}></div>
          <span class="list-item-name">{area.name}</span>
        </div>
        <span class="list-item-sub">{area.size}</span>
      </div>
      {#if selectType === 'bed'}
        <div class="list-item-sub plant-line">{area.plants}</div>
      {/if}
    </button>
  {:else}
    <p class="list-item-sub">{emptyLabel}</p>
  {/each}
</div>

<style>
  .list-item-title {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .plant-line {
    margin-top: 3px;
  }
</style>
