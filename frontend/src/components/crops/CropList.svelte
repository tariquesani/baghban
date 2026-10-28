<script>
  import { CROP_CATEGORIES } from '$lib/domain/crop.js';

  /**
   * @param {{
   *   crops: Array<{ id: string, name: string, category: string, emoji: string }>,
   *   selectedId: string,
   *   query: string,
   *   category: string,
   *   showArchived: boolean,
   *   onQuery: (value: string) => void,
   *   onCategory: (value: string) => void,
   *   onShowArchived: (value: boolean) => void,
   *   onAdd: () => void,
   *   onSelect: (crop: { id: string }) => void,
   *   ready: boolean,
   * }} props
   */
  let {
    crops,
    selectedId,
    query,
    category,
    showArchived,
    onQuery,
    onCategory,
    onShowArchived,
    onAdd,
    onSelect,
    ready,
  } = $props();
</script>

<div class="list">
  <div class="tools">
    <button type="button" class="add" onclick={onAdd}>Add crop</button>
    <label class="search">
      <span class="label">Search</span>
      <input
        type="search"
        value={query}
        placeholder="Name or alias"
        oninput={(event) => onQuery(event.currentTarget.value)}
      />
    </label>
    <div class="chips" role="group" aria-label="Category">
      <button
        type="button"
        class={{ chip: true, on: category === '' }}
        onclick={() => onCategory('')}
      >All</button>
      {#each CROP_CATEGORIES as name (name)}
        <button
          type="button"
          class={{ chip: true, on: category === name }}
          onclick={() => onCategory(name)}
        >{name}</button>
      {/each}
    </div>
    <label class="archived">
      <input
        type="checkbox"
        checked={showArchived}
        onchange={(event) => onShowArchived(event.currentTarget.checked)}
      />
      Show archived
    </label>
  </div>

  {#if ready && crops.length === 0}
    <p class="empty">{showArchived ? 'No archived crops.' : 'No crops match.'}</p>
  {:else}
    <ul>
      {#each crops as crop (crop.id)}
        <li>
          <button
            type="button"
            class={{ row: true, selected: crop.id === selectedId }}
            aria-current={crop.id === selectedId ? 'true' : undefined}
            onclick={() => onSelect(crop)}
          >
            {#if crop.emoji}<span class="emoji" aria-hidden="true">{crop.emoji}</span>{/if}
            <span class="name">{crop.name}</span>
            <span class="category">{crop.category}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .list {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .add {
    align-self: flex-start;
    border: 0;
    border-radius: 8px;
    padding: 10px 16px;
    background: #386a20;
    color: #fff;
    font: inherit;
    font-weight: 550;
    cursor: pointer;
  }

  .add:hover { background: #2f5a1b; }

  .search {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #42493d;
  }

  input[type="search"] {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #c2c9bb;
    border-radius: 8px;
    padding: 8px 10px;
    font: inherit;
    background: #fff;
    color: #191d17;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    border: 1px solid #c5d0c2;
    border-radius: 999px;
    padding: 6px 12px;
    background: #fff;
    color: #3d4a38;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .chip.on {
    border-color: #386a20;
    background: #386a20;
    color: #fff;
  }

  .archived {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #3d4a38;
    font-size: 0.9rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: auto;
    min-height: 0;
  }

  .row {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 4px;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #191d17;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row:hover { background: #e6eee2; }

  .row.selected,
  .row.selected:hover {
    background: #386a20;
    color: #fff;
  }

  .name { font-weight: 550; }

  .category {
    margin-left: auto;
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .empty {
    margin: 0;
    color: #42493d;
  }
</style>
