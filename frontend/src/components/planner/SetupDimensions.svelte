<script>
  import { parseDimension } from '$lib/domain/scale';

  let { onBack = null, onDone } = $props();

  let widthText = $state('');
  let lengthText = $state('');
  let error = $state('');

  /** @param {SubmitEvent} event */
  function confirmSize(event) {
    event.preventDefault();
    const width = parseDimension(widthText);
    const length = parseDimension(lengthText);
    if (!width || !length) {
      error = 'Enter a width and length in feet, from 1 to 500.';
      return;
    }
    const saved = globalThis.confirmDimensions(width.text, length.text, width.value, length.value);
    if (!saved) {
      error = 'Enter a width and length in feet, from 1 to 500.';
      return;
    }
    onDone();
  }
</script>

<h2>Garden dimensions</h2>
<p>Width and length of the rectangular plot.</p>
<form onsubmit={confirmSize}>
  <label>
    Width
    <input bind:value={widthText} inputmode="decimal" autocomplete="off" />
    <span>ft</span>
  </label>
  <label>
    Length
    <input bind:value={lengthText} inputmode="decimal" autocomplete="off" />
    <span>ft</span>
  </label>
  {#if error}<p class="error">{error}</p>{/if}
  <button type="submit">Confirm</button>
</form>
{#if onBack}
  <button type="button" class="back" onclick={onBack}>Back</button>
{/if}

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 1.25rem;
    font-weight: 500;
  }

  p { margin: 0 0 16px; color: #42493d; line-height: 1.45; }

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

  .back {
    background: transparent;
    color: #386a20;
  }

  .error { color: #9b1c1c; }
</style>
