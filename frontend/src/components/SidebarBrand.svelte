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

<div
  class="sidebar-backdrop"
  role="presentation"
  {@attach (element) => place(element, 'backdropHost')}
  onclick={() => globalThis.closeSidebar()}
></div>

<div class="brand" {@attach (element) => place(element, 'brandHost')}>
  <div class="brand-mark" aria-hidden="true">
    <i data-lucide="sprout"></i>
  </div>
  <div class="brand-copy">
    <p class="title-medium">Garden Planner</p>
    <p class="body-small">Drag beds · Click to edit</p>
  </div>
  <button
    type="button"
    class="sidebar-toggle"
    id="sidebarToggle"
    aria-expanded="true"
    aria-label="Collapse sidebar"
    title="Collapse sidebar"
    onclick={() => globalThis.toggleSidebar()}
  >
    <i data-lucide="chevrons-left" class="when-open"></i>
    <i data-lucide="chevrons-right" class="when-closed"></i>
    <i data-lucide="x" class="when-drawer"></i>
  </button>
</div>
