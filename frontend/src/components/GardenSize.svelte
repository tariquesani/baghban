<script>
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
</script>

<div {@attach (element) => place(element, 'dimensionsHost')}>
  <p class="title-small">Dimensions</p>
  <div class="input-row">
    <label for="gardenWidth">Width</label>
    <input id="gardenWidth" type="number" value="20" min="5" max="200" aria-label="Width in feet" />
    <span>ft</span>
  </div>
  <div class="input-row">
    <label for="gardenHeight">Length</label>
    <input id="gardenHeight" type="number" value="18" min="5" max="200" aria-label="Length in feet" />
    <span>ft</span>
  </div>
  <button type="button" class="text-btn filled" onclick={() => globalThis.applyGardenSize()}>Apply size</button>
</div>
