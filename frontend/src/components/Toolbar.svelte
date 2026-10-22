<script>
  import ToolbarButton from './ToolbarButton.svelte';

  let { activeTool } = $props();

  function chooseTool(name) {
    globalThis.setTool(activeTool === name ? 'select' : name);
  }
</script>

<div
  class="toolbar"
  {@attach (element) => {
    const host = document.getElementById('toolbarHost');
    if (!host) return;
    host.replaceWith(element);
    return () => element.remove();
  }}
>
  <ToolbarButton
    label="Open menu"
    icon="menu"
    variant="menu"
    onPress={() => globalThis.openSidebar()}
  />
  <div class="tool-group">
    <ToolbarButton label="Calibrate" icon="ruler" tool="calibrate" active={activeTool === 'calibrate'} onPress={() => chooseTool('calibrate')} />
  </div>
  <div class="toolbar-actions">
    <ToolbarButton label="Save plan" icon="save" variant="action" onPress={() => globalThis.saveJSON()} />
    <ToolbarButton label="Load plan" icon="folder-open" variant="action" onPress={() => globalThis.loadJSON()} />
    <ToolbarButton label="Print plan" icon="printer" variant="action" onPress={() => globalThis.printPlan()} />
  </div>
  <div class="zoom-controls">
    <button type="button" title="Zoom in" onclick={() => globalThis.adjustZoom(1.2)}>＋</button>
    <button type="button" title="Fit to screen" onclick={() => { globalThis.fitView(); globalThis.draw(); }}>⤢</button>
    <button type="button" title="Zoom out" onclick={() => globalThis.adjustZoom(1 / 1.2)}>－</button>
  </div>
  <label class="snap-toggle">
    <input type="checkbox" id="snapToggle" checked /> Snap to ½ ft grid
  </label>
</div>
