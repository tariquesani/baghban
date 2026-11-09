<script>
  import SidebarButton from './SidebarButton.svelte';

  let { activeTool, onHelp } = $props();

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

<div {@attach (element) => place(element, 'bedActionsHost')}>
  <SidebarButton label="Add bed" icon="square" onPress={() => globalThis.addBed()} />
  <SidebarButton
    id="tool-draw"
    label="Plot a bed"
    icon="vector-polygon"
    tool="draw-bed"
    active={activeTool === 'draw-bed'}
    onPress={() => globalThis.setTool(activeTool === 'draw-bed' ? 'select' : 'draw-bed')}
  />
</div>

<div {@attach (element) => place(element, 'plantingActionsHost')}>
  <SidebarButton label="Add pot" icon="circle" onPress={() => globalThis.addPot()} />
  <SidebarButton label="Add tree" icon="tree-deciduous" onPress={() => globalThis.addTree()} />
  <SidebarButton label="Add planter" icon="rectangle-horizontal" onPress={() => globalThis.addPlanter()} />
  <SidebarButton label="Add obstacle" icon="mountain" onPress={() => globalThis.addObstacle()} />
</div>

<div {@attach (element) => place(element, 'helpHost')}>
  <SidebarButton label="Print plan" icon="printer" onPress={() => globalThis.printPlan()} />
  <SidebarButton label="Help" icon="circle-help" onPress={onHelp} />
</div>
