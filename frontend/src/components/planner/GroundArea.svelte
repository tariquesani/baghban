<script>
  import SidebarButton from './SidebarButton.svelte';

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

<div {@attach (element) => place(element, 'groundAreaHost')}>
  <div class="panel-block tool-options">
    <label class="snap-toggle" title="New polygons are ground areas instead of raised beds">
      <input type="checkbox" id="drawGroundToggle" /> Ground area
    </label>
  </div>
  <SidebarButton label="Add ground area" icon="trees" onPress={() => globalThis.addGroundArea()} />
</div>
