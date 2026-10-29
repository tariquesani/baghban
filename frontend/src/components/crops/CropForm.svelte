<script>
  import { CROP_CATEGORIES, SUNS, WATERS, optionalNumber } from '$lib/domain/crop.js';

  /**
   * @param {{
   *   draft: {
   *     id: number | '',
   *     name: string,
   *     category: string,
   *     emoji: string,
   *     sqft: number | null,
   *     spacing: number | null,
   *     depthIn: number | null,
   *     sowingDepthMm: number | null,
   *     daysToMaturity: number | null,
   *     sun: string,
   *     water: string,
   *     trellis: boolean,
   *     notes: string,
   *     archived: boolean,
   *     aliases: string[],
   *     companions: number[],
   *     avoid: number[],
   *   },
   *   creating: boolean,
   *   choices: Array<{ id: number, name: string, emoji: string, aliases: string[] }>,
   *   busy: boolean,
   *   error: string,
   *   narrow: boolean,
   *   aliasText: string,
   *   companionQuery: string,
   *   avoidQuery: string,
   *   onSave: () => void,
   *   onArchive: () => void,
   *   onRestore: () => void,
   *   onBack: () => void,
   * }} props
   */
  let {
    draft,
    creating,
    choices,
    busy,
    error,
    narrow,
    aliasText = $bindable(''),
    companionQuery = $bindable(''),
    avoidQuery = $bindable(''),
    onSave,
    onArchive,
    onRestore,
    onBack,
  } = $props();

  let aliasError = $state('');

  /**
   * @param {string} query
   * @param {number[]} selected
   * @param {number[]} blocked
   */
  function matching(query, selected, blocked) {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return choices.filter((crop) => {
      if (crop.id === draft.id) return false;
      if (selected.includes(crop.id) || blocked.includes(crop.id)) return false;
      if (crop.name.toLowerCase().includes(needle)) return true;
      return (crop.aliases || []).some((alias) => alias.toLowerCase().includes(needle));
    }).slice(0, 6);
  }

  /** @param {number} id */
  function cropName(id) {
    const found = choices.find((crop) => crop.id === id);
    return found ? found.name : id;
  }

  function addAlias() {
    const alias = aliasText.trim();
    if (!alias) return;
    const folded = alias.toLowerCase();
    if (folded === draft.name.trim().toLowerCase()) {
      aliasError = 'An alias cannot match the crop name';
      return;
    }
    if (draft.aliases.some((item) => item.toLowerCase() === folded)) {
      aliasError = 'That alias is already on this crop';
      return;
    }
    draft.aliases = [...draft.aliases, alias];
    aliasText = '';
    aliasError = '';
  }

  /** @param {string} alias */
  function removeAlias(alias) {
    draft.aliases = draft.aliases.filter((item) => item !== alias);
  }

  /**
   * @param {string} key
   * @param {string} text
   */
  function setNumber(key, text) {
    draft[key] = optionalNumber(text);
  }

  /** @param {number} id */
  function addCompanion(id) {
    draft.companions = [...draft.companions, id];
    companionQuery = '';
  }

  /** @param {number} id */
  function removeCompanion(id) {
    draft.companions = draft.companions.filter((item) => item !== id);
  }

  /** @param {number} id */
  function addAvoid(id) {
    draft.avoid = [...draft.avoid, id];
    avoidQuery = '';
  }

  /** @param {number} id */
  function removeAvoid(id) {
    draft.avoid = draft.avoid.filter((item) => item !== id);
  }
</script>

{#snippet picker(label, selected, query, setQuery, blocked, add, remove)}
  <fieldset>
    <legend>{label}</legend>
    {#if selected.length}
      <ul class="picked">
        {#each selected as id (id)}
          <li>
            <span>{cropName(id)}</span>
            <button type="button" aria-label={`Remove ${cropName(id)}`} onclick={() => remove(id)}>Remove</button>
          </li>
        {/each}
      </ul>
    {/if}
    <input
      type="search"
      value={query}
      placeholder="Search crops"
      aria-label={`Search ${label}`}
      oninput={(event) => setQuery(event.currentTarget.value)}
      onkeydown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const found = matching(query, selected, blocked)[0];
        if (found) add(found.id);
      }}
    />
    {#if matching(query, selected, blocked).length}
      <ul class="matches">
        {#each matching(query, selected, blocked) as crop (crop.id)}
          <li>
            <button type="button" onclick={() => add(crop.id)}>
              {#if crop.emoji}<span aria-hidden="true">{crop.emoji}</span>{/if}
              {crop.name}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </fieldset>
{/snippet}

<form class="form" aria-busy={busy} onsubmit={(event) => { event.preventDefault(); onSave(); }}>
  {#if narrow}
    <button type="button" class="back" onclick={onBack}>Back</button>
  {/if}
  <h2>{creating ? 'New crop' : draft.name || 'Crop'}</h2>

  <label>
    Display name
    <input
      name="name"
      required
      value={draft.name}
      oninput={(event) => { draft.name = event.currentTarget.value; }}
    />
  </label>

  <label>
    Category
    <select
      name="category"
      required
      value={draft.category}
      onchange={(event) => { draft.category = event.currentTarget.value; }}
    >
      <option value="">Choose a category</option>
      {#each CROP_CATEGORIES as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  <label>
    Emoji
    <input
      name="emoji"
      value={draft.emoji}
      oninput={(event) => { draft.emoji = event.currentTarget.value; }}
    />
  </label>

  <fieldset>
    <legend>Aliases</legend>
    <p class="hint">Extra names used only when searching.</p>
    {#if draft.aliases.length}
      <ul class="picked">
        {#each draft.aliases as alias (alias)}
          <li>
            <span>{alias}</span>
            <button type="button" aria-label={`Remove ${alias}`} onclick={() => removeAlias(alias)}>Remove</button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="alias-row">
      <input
        name="alias"
        value={aliasText}
        placeholder="Dhaniya"
        aria-label="New alias"
        oninput={(event) => { aliasText = event.currentTarget.value; aliasError = ''; }}
        onkeydown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          addAlias();
        }}
      />
      <button type="button" onclick={addAlias}>Add alias</button>
    </div>
    {#if aliasError}<p class="error">{aliasError}</p>{/if}
  </fieldset>

  <div class="grid">
    <label>
      Square feet
      <input
        name="sqft"
        type="number"
        min="0"
        step="any"
        value={draft.sqft ?? ''}
        oninput={(event) => setNumber('sqft', event.currentTarget.value)}
      />
    </label>
    <label>
      Spacing (inches)
      <input
        name="spacing"
        type="number"
        min="0"
        step="any"
        value={draft.spacing ?? ''}
        oninput={(event) => setNumber('spacing', event.currentTarget.value)}
      />
    </label>
    <label>
      Soil depth (inches)
      <input
        name="depth"
        type="number"
        min="0"
        step="any"
        value={draft.depthIn ?? ''}
        oninput={(event) => setNumber('depthIn', event.currentTarget.value)}
      />
    </label>
  </div>

  <div class="grid">
    <label>
      Sun
      <select name="sun" value={draft.sun} onchange={(event) => { draft.sun = event.currentTarget.value; }}>
        {#each SUNS as choice (choice.value)}
          <option value={choice.value}>{choice.label}</option>
        {/each}
      </select>
    </label>
    <label>
      Water
      <select name="water" value={draft.water} onchange={(event) => { draft.water = event.currentTarget.value; }}>
        {#each WATERS as choice (choice.value)}
          <option value={choice.value}>{choice.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="check">
    <input
      type="checkbox"
      checked={draft.trellis}
      onchange={(event) => { draft.trellis = event.currentTarget.checked; }}
    />
    Needs a trellis
  </label>

  <div class="grid">
    <label>
      Sowing depth (mm)
      <input
        name="sowing-depth"
        type="number"
        min="0"
        step="any"
        value={draft.sowingDepthMm ?? ''}
        oninput={(event) => setNumber('sowingDepthMm', event.currentTarget.value)}
      />
    </label>
    <label>
      Days to maturity
      <input
        name="days"
        type="number"
        min="0"
        step="1"
        value={draft.daysToMaturity ?? ''}
        oninput={(event) => setNumber('daysToMaturity', event.currentTarget.value)}
      />
    </label>
  </div>

  <label>
    Notes
    <textarea
      name="notes"
      rows="4"
      value={draft.notes}
      oninput={(event) => { draft.notes = event.currentTarget.value; }}
    ></textarea>
  </label>

  {@render picker(
    'Companions',
    draft.companions,
    companionQuery,
    (value) => { companionQuery = value; },
    draft.avoid,
    addCompanion,
    removeCompanion,
  )}

  {@render picker(
    'Plants to avoid',
    draft.avoid,
    avoidQuery,
    (value) => { avoidQuery = value; },
    draft.companions,
    addAvoid,
    removeAvoid,
  )}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if !creating && draft.archived}
      <button type="button" class="restore" disabled={busy} onclick={onRestore}>Restore</button>
    {:else if !creating}
      <button type="button" class="archive" disabled={busy} onclick={onArchive}>Archive</button>
    {:else}
      <span></span>
    {/if}
    <button type="submit" class="save" disabled={busy}>Save</button>
  </div>
</form>

<style>
  .form {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
  }

  h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 550;
  }

  .back {
    align-self: flex-start;
    border: 0;
    padding: 0;
    background: transparent;
    color: #386a20;
    font: inherit;
    font-weight: 550;
    cursor: pointer;
  }

  label, fieldset {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: 0;
    color: #191d17;
  }

  legend {
    padding: 0;
    font-weight: 550;
  }

  .hint {
    margin: 0;
    color: #42493d;
    font-size: 0.85rem;
  }

  input, select, textarea {
    box-sizing: border-box;
    width: 100%;
    border: 1px solid #c2c9bb;
    border-radius: 8px;
    padding: 8px 10px;
    font: inherit;
    color: #191d17;
    background: #fff;
  }

  textarea { resize: vertical; }

  .check {
    flex-direction: row;
    align-items: center;
  }

  .check input { width: auto; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .alias-row {
    display: flex;
    gap: 8px;
  }

  .alias-row input { flex: 1; }

  .alias-row button,
  .picked button,
  .matches button,
  .restore,
  .archive,
  .save {
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    font: inherit;
    cursor: pointer;
  }

  .alias-row button,
  .matches button,
  .restore {
    background: #e6eee2;
    color: #191d17;
  }

  .picked, .matches {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .picked li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .picked button {
    background: transparent;
    color: #386a20;
    font-weight: 550;
  }

  .matches button {
    width: 100%;
    display: flex;
    gap: 8px;
    text-align: left;
  }

  .error {
    margin: 0;
    color: #8a1f11;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .archive {
    background: transparent;
    color: #8a1f11;
    font-weight: 550;
  }

  .save {
    background: #386a20;
    color: #fff;
    font-weight: 550;
    padding: 10px 16px;
  }

  .save:disabled,
  .archive:disabled,
  .restore:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
