<script>
  import './app.css';
  import { Toaster } from '$lib/components/ui/sonner';
  import AppSidebar from './components/AppSidebar.svelte';
  import Calendar from './routes/Calendar.svelte';
  import Crops from './routes/Crops.svelte';
  import Home from './routes/Home.svelte';
  import Planner from './routes/Planner.svelte';
  import Setup from './routes/Setup.svelte';

  const screens = {
    '/': Home,
    '/planner': Planner,
    '/calendar': Calendar,
    '/crops': Crops,
    '/settings': Setup,
  };

  const railKey = 'sidebar-collapsed';
  const wideQuery = window.matchMedia('(min-width: 801px)');

  /** @param {string} pathname */
  function normalize(pathname) {
    if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
    return pathname;
  }

  let path = $state(normalize(window.location.pathname));
  let search = $state(window.location.search);
  let wide = $state(wideQuery.matches);
  let collapsed = $state(localStorage.getItem(railKey) === 'true');
  let drawerOpen = $state(false);
  let entryOpen = $state(false);
  let entrySession = $state(0);
  let entryKind = $state('sowing');
  let canvas = $state({
    ready: false,
    activeTool: 'select',
    /** @type {null | { addBed: () => void, setTool: (tool: string) => void, addPot: () => void, addPlanter: () => void, addObstacle: () => void, printPlan: () => void }} */
    actions: null,
  });

  let iconRail = $derived(wide && collapsed);
  let railWidth = $derived(wide ? (collapsed ? '72px' : '280px') : '0px');
  let showPlannerTools = $derived(path === '/planner' && canvas.ready && canvas.actions !== null);
  let pageTitle = $derived(
    path === '/calendar' ? 'Calendar'
    : path === '/crops' ? 'Crops'
    : path === '/planner' ? 'Planner'
    : path === '/settings' ? 'Setup'
    : 'Dashboard',
  );

  function syncPath() {
    path = normalize(window.location.pathname);
    search = window.location.search;
    entryOpen = false;
  }

  /** @param {string} kind */
  function askForEntry(kind) {
    entryKind = kind;
    entrySession += 1;
    entryOpen = true;
  }

  function noteViewport() {
    wide = wideQuery.matches;
    if (wide) drawerOpen = false;
  }

  function toggleRail() {
    if (!wide) {
      drawerOpen = false;
      return;
    }
    collapsed = !collapsed;
    localStorage.setItem(railKey, String(collapsed));
  }

  function openDrawer() {
    if (!wide) drawerOpen = true;
  }

  /**
   * @param {{ ready: boolean, activeTool: string, actions: typeof canvas.actions }} report
   */
  function noteCanvas(report) {
    canvas = report;
  }

  /** @param {MouseEvent} event */
  function followLink(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a');
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const next = normalize(url.pathname);
    if (!Object.hasOwn(screens, next)) return;
    event.preventDefault();
    drawerOpen = false;
    entryOpen = false;
    const nextSearch = url.search;
    if (next === path && nextSearch === search) return;
    history.pushState(null, '', next + nextSearch);
    path = next;
    search = nextSearch;
    drawerOpen = false;
  }
</script>

<svelte:window onpopstate={syncPath} onresize={noteViewport} />
<svelte:document onclick={followLink} onsidebaropen={openDrawer} />

<div class="shell" style:--rail-width={railWidth}>
  <Toaster position="top-right" />
  {#if drawerOpen}
    <button
      type="button"
      class="rail-backdrop"
      aria-label="Close sidebar"
      onclick={() => drawerOpen = false}
    ></button>
  {/if}
  <AppSidebar
    {path}
    {wide}
    {iconRail}
    {drawerOpen}
    {showPlannerTools}
    activeTool={canvas.activeTool}
    actions={canvas.actions}
    onToggle={toggleRail}
    onAddEntry={askForEntry}
  />
  <div class="shell-main">
    <header class="page-head">
      <h1>{pageTitle}</h1>
    </header>
    <div class="page-body">
      {#if path === '/planner'}
        <Planner {search} onCanvas={noteCanvas} />
      {:else if path === '/settings'}
        <Setup />
      {:else if path === '/calendar'}
        <Calendar bind:entryOpen {entrySession} {entryKind} />
      {:else if path === '/crops'}
        <Crops />
      {:else}
        <Home />
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  .shell {
    --page-head: 64px;
    display: flex;
    height: 100vh;
    min-width: 0;
    background: #f0f4f0;
  }

  .shell-main {
    flex: 1;
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-head {
    flex: 0 0 var(--page-head);
    height: var(--page-head);
    box-sizing: border-box;
    padding: 8px 24px 0;
  }

  .page-head h1 {
    margin: 0;
    font-family: Roboto, sans-serif;
    font-size: 2rem;
    font-weight: 500;
    color: #191d17;
  }

  .page-body {
    flex: 1;
    min-height: 0;
    min-width: 0;
    position: relative;
    overflow: auto;
  }

  .page-body :global(.map-host),
  .page-body :global(.map-host .app) {
    height: 100%;
  }

  .rail-backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
    border: 0;
    padding: 0;
    background: rgba(25, 29, 23, 0.4);
    cursor: pointer;
  }
</style>
