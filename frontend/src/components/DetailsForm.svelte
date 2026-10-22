<script>
  /**
   * @param {{
   *   details: {
   *     name: string,
   *     width: number,
   *     length: number,
   *     notes: string,
   *     showSize: boolean,
   *     showNotes: boolean,
   *     focusName: boolean
   *   } | null,
   *   onName: (value: string) => void,
   *   onWidth: (value: string) => void,
   *   onLength: (value: string) => void,
   *   onNotes: (value: string) => void
   * }} props
   */
  let { details, onName, onWidth, onLength, onNotes } = $props();

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

  $effect(() => {
    if (!details?.focusName) return;
    const nameField = document.getElementById('propName');
    if (!(nameField instanceof HTMLInputElement)) return;
    nameField.focus();
    nameField.select();
  });
</script>

<div class="field" {@attach (element) => place(element, 'nameHost')}>
  {#if details}
    <label for="propName">Name</label>
    <input
      id="propName"
      type="text"
      value={details.name}
      oninput={(event) => onName(event.currentTarget.value)}
    />
  {/if}
</div>

<div {@attach (element) => place(element, 'sizeHost')}>
  {#if details && details.showSize}
    <div class="field-row">
      <div class="field">
        <label for="propWidth">Width (ft)</label>
        <input
          id="propWidth"
          type="number"
          min="1"
          max="40"
          step="0.5"
          value={details.width}
          oninput={(event) => onWidth(event.currentTarget.value)}
        />
      </div>
      <div class="field">
        <label for="propLength">Length (ft)</label>
        <input
          id="propLength"
          type="number"
          min="1"
          max="40"
          step="0.5"
          value={details.length}
          oninput={(event) => onLength(event.currentTarget.value)}
        />
      </div>
    </div>
  {/if}
</div>

<div {@attach (element) => place(element, 'notesHost')}>
  {#if details && details.showNotes}
    <div class="panel-section">
      <h3>Notes</h3>
      <div class="field">
        <textarea
          id="propNotes"
          placeholder="e.g. needs trellis, full sun, 18″ spacing…"
          value={details.notes}
          oninput={(event) => onNotes(event.currentTarget.value)}
        ></textarea>
      </div>
    </div>
  {/if}
</div>
