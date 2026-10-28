<script>
  import { itemsOutside, parseDimension } from '$lib/domain/scale';

  let {
    scale,
    sizeLabel,
    widthText = '',
    heightText = '',
    onRecalibrate,
    onReset,
  } = $props();

  let widthField = $state(widthText);
  let lengthField = $state(heightText);
  let notice = $state('');
  let outside = $state([]);
  let confirmingReset = $state(false);
  let resetting = $state(false);

  /** @param {SubmitEvent} event */
  function saveDimensions(event) {
    event.preventDefault();
    notice = '';
    const width = parseDimension(widthField);
    const length = parseDimension(lengthField);
    if (!width || !length) {
      notice = 'Enter a width and length in feet, from 1 to 500.';
      outside = [];
      return;
    }
    const saved = globalThis.reviseDimensions(width.text, length.text, width.value, length.value);
    if (!saved) {
      notice = 'Enter a width and length in feet, from 1 to 500.';
      return;
    }
    const snapshot = globalThis.currentPlan();
    outside = itemsOutside(snapshot.beds, snapshot.obstacles, width.value, length.value);
    notice = 'Saved.';
  }

  function resetGarden() {
    if (resetting) return;
    resetting = true;
    onReset();
  }
</script>

<h2>Garden settings</h2>

{#if scale === 'plan'}
  <p class="size">{sizeLabel}</p>
  <button type="button" class="quiet" onclick={onRecalibrate}>Recalibrate</button>
{:else}
  <form onsubmit={saveDimensions}>
    <label>
      Width
      <input bind:value={widthField} inputmode="decimal" autocomplete="off" />
      <span>ft</span>
    </label>
    <label>
      Length
      <input bind:value={lengthField} inputmode="decimal" autocomplete="off" />
      <span>ft</span>
    </label>
    <button type="submit">Save dimensions</button>
  </form>
  {#if notice}<p class="notice">{notice}</p>{/if}
  {#if outside.length}
    <p>These no longer fit in the plot:</p>
    <ul>
      {#each outside as item (item.id)}
        <li>{item.name}</li>
      {/each}
    </ul>
  {/if}
{/if}

<section class="reset">
  <h2>Start again</h2>
  <p>Clears the beds, plants, obstacles, and plan photo. Setup starts over.</p>
  {#if !confirmingReset}
    <button type="button" class="danger" onclick={() => confirmingReset = true}>Reset garden</button>
  {:else}
    <p>This cannot be undone.</p>
    <button type="button" class="danger" disabled={resetting} onclick={resetGarden}>Yes, start fresh</button>
    <button type="button" class="quiet" disabled={resetting} onclick={() => confirmingReset = false}>Cancel</button>
  {/if}
</section>

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 1.25rem;
    font-weight: 500;
  }

  p { margin: 0 0 12px; color: #42493d; line-height: 1.45; }

  .size {
    font-size: 1.15rem;
    font-weight: 600;
    color: #191d17;
  }

  form { margin-bottom: 8px; }

  label {
    display: grid;
    grid-template-columns: 4.5rem 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }

  input {
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid #c2c9bb;
    border-radius: 8px;
    font: inherit;
  }

  button {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 10px 14px;
    border: none;
    border-radius: 8px;
    background: #386a20;
    color: #fff;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  button:disabled { opacity: 0.6; cursor: default; }

  .quiet {
    background: transparent;
    color: #386a20;
  }

  .danger { background: #9b1c1c; }

  .reset {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid #c2c9bb;
  }

  .notice { margin-top: 12px; }

  ul { margin: 0 0 12px; padding-left: 1.2rem; color: #42493d; }
</style>
