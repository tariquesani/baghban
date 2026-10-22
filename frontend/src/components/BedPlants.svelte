<script>
  /**
   * @param {{ details: { showPlants?: boolean } | null }} props
   */
  let { details } = $props();

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

<div
  class="panel-section"
  id="plantsSection"
  hidden={!details?.showPlants}
  {@attach (element) => place(element, 'plantsHost')}
>
  <h3>Plants</h3>
  <div id="plantTags"></div>
  <div class="add-plant-row">
    <select id="plantSelect">
      <option value="">Add plant…</option>
    </select>
    <button type="button" class="btn btn-primary btn-sm" onclick={() => globalThis.addPlant()}>Add</button>
  </div>
  <div
    id="plantAddWarn"
    style="display:none;margin-top:6px;padding:6px 10px;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;font-size:12px;color:#dc2626;line-height:1.4"
  ></div>
</div>
