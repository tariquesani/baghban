<script>
  /**
   * @param {{
   *   details: {
   *     showPot?: boolean,
   *     showPlanter?: boolean,
   *     showRotation?: boolean,
   *     showDepth?: boolean,
   *     showPosition?: boolean
   *   } | null
   * }} props
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

<div {@attach (element) => place(element, 'propertiesHost')}>
  <div class="field" id="potSection" hidden={!details?.showPot}>
    <label for="propDiam">Diameter</label>
    <select id="propDiam" onchange={(event) => globalThis.updatePotDiam(+event.currentTarget.value)}>
      <option value="1">1 ft (12")</option>
      <option value="1.5">1.5 ft (18")</option>
      <option value="2">2 ft (24")</option>
      <option value="2.5">2.5 ft (30")</option>
      <option value="3">3 ft (36")</option>
    </select>
  </div>

  <div id="planterSection" hidden={!details?.showPlanter}>
    <div class="field">
      <p class="preset-label">Size presets</p>
      <div class="preset-row">
        <button type="button" class="btn btn-sm btn-secondary planter-preset" data-l="24" data-w="8" onclick={() => globalThis.applyPlanterPreset(24, 8)}>24×8"</button>
        <button type="button" class="btn btn-sm btn-secondary planter-preset" data-l="36" data-w="12" onclick={() => globalThis.applyPlanterPreset(36, 12)}>36×12"</button>
        <button type="button" class="btn btn-sm btn-secondary planter-preset" data-l="48" data-w="16" onclick={() => globalThis.applyPlanterPreset(48, 16)}>48×16"</button>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="propPlanterL">Length (in)</label>
        <input id="propPlanterL" type="number" min="4" max="240" step="1" oninput={(event) => globalThis.updatePlanterInches('w', event.currentTarget.value)} />
      </div>
      <div class="field">
        <label for="propPlanterW">Width (in)</label>
        <input id="propPlanterW" type="number" min="4" max="240" step="1" oninput={(event) => globalThis.updatePlanterInches('h', event.currentTarget.value)} />
      </div>
    </div>
  </div>

  <div class="field" id="rotRow" hidden={!details?.showRotation}>
    <label for="propRot">Angle (°)</label>
    <input id="propRot" type="number" min="0" max="359" step="1" oninput={(event) => globalThis.updateRotation(event.currentTarget.value)} />
    <p class="plot-note">Drag the ↻ handle to turn. Hold Shift to snap to 15°.</p>
  </div>

  <div class="field" id="depthSection" hidden={!details?.showDepth}>
    <label for="propDepth">Depth</label>
    <select id="propDepth" onchange={(event) => globalThis.updateProp('depthIn', +event.currentTarget.value)}>
      <option value="8">8 in — 1× 2×8 (shallow)</option>
      <option value="12" selected>12 in — 2× 2×6 (most plants)</option>
      <option value="15">15 in — 2× 2×8 (deep roots)</option>
      <option value="18">18 in — 3× 2×6 (maximum)</option>
    </select>
  </div>

  <div class="field-row" id="posRow" hidden={!details?.showPosition}>
    <div class="field">
      <label for="propX">X from left (ft)</label>
      <input id="propX" type="number" min="0" step="0.1" oninput={(event) => globalThis.updateProp('x', +event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="propY">Y from top (ft)</label>
      <input id="propY" type="number" min="0" step="0.1" oninput={(event) => globalThis.updateProp('y', +event.currentTarget.value)} />
    </div>
  </div>
</div>

<style>
  .preset-label {
    display: block;
    margin-bottom: 2px;
    color: #4a6b4b;
    font-size: 11px;
  }
</style>
