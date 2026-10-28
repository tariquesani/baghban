<script>
  let {
    step,
    sizeLabel,
    lengthText = $bindable(''),
    lengthError = '',
    photoReady = false,
    canCancel = false,
    onStep,
    onUpload,
    onLength,
    onRecalibrate,
    onContinue,
    onCancel,
    onBack,
  } = $props();

  const steps = [
    { id: 'upload', label: 'Upload the plan' },
    { id: 'draw', label: 'Draw a line of known length' },
    { id: 'length', label: 'Enter that length' },
  ];

  /**
   * @param {string} id
   */
  function reachable(id) {
    if (step === 'done') return true;
    if (id === 'upload') return true;
    if (id === 'draw') return photoReady || step === 'draw' || step === 'length';
    return step === 'length';
  }

  /** @param {SubmitEvent} event */
  function submitLength(event) {
    event.preventDefault();
    onLength();
  }
</script>

<h2>Upload a plan</h2>
<ol>
  {#each steps as item (item.id)}
    <li>
      <button
        type="button"
        class={[step === item.id && 'current']}
        aria-current={step === item.id ? 'step' : undefined}
        disabled={!reachable(item.id)}
        onclick={() => onStep(item.id)}
      >{item.label}</button>
    </li>
  {/each}
</ol>

{#if step === 'upload'}
  <p>The plan stays on the canvas. Draw on it after it loads.</p>
  <button type="button" class="primary" onclick={onUpload}>Upload plan</button>
{:else if step === 'draw'}
  <p>Draw a line across something whose length you know. You can drag its ends to adjust it.</p>
{:else if step === 'length'}
  <form onsubmit={submitLength}>
    <label>
      Length of the line
      <input bind:value={lengthText} inputmode="decimal" autocomplete="off" />
      <span>ft</span>
    </label>
    {#if lengthError}<p class="error">{lengthError}</p>{/if}
    <button type="submit" class="primary">Use this length</button>
  </form>
{:else}
  <p class="result">{sizeLabel}</p>
  <button type="button" class="link" onclick={onRecalibrate}>Recalibrate</button>
  <button type="button" class="primary" onclick={onContinue}>Continue</button>
{/if}

{#if canCancel}
  <button type="button" class="back" onclick={onCancel}>Cancel</button>
{:else if onBack}
  <button type="button" class="back" onclick={onBack}>Back</button>
{/if}

<style>
  h2 {
    margin: 0 0 12px;
    font-size: 1.25rem;
    font-weight: 500;
  }

  ol {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }

  li + li { margin-top: 6px; }

  li button {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #42493d;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  li button.current {
    border-color: #386a20;
    background: #eef4ea;
    color: #191d17;
    font-weight: 600;
  }

  li button:disabled { cursor: default; opacity: 0.55; }

  p { margin: 0 0 12px; color: #42493d; line-height: 1.45; }

  .result {
    font-size: 1.15rem;
    font-weight: 600;
    color: #191d17;
  }

  label {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  input {
    grid-column: 1 / -1;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid #c2c9bb;
    border-radius: 8px;
    font: inherit;
  }

  .primary, .link, .back {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .primary {
    border: none;
    background: #386a20;
    color: #fff;
  }

  .link, .back {
    border: none;
    background: transparent;
    color: #386a20;
  }

  .error { color: #9b1c1c; }
</style>
