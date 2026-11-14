<script>
  import './app.css';
  import { Toaster } from '$lib/components/ui/sonner';
  import { ApiError } from '$lib/api/api.js';
  import { login, logout, me } from '$lib/api/auth.js';
  import AppSidebar from './components/AppSidebar.svelte';
  import Help from './components/Help.svelte';
  import { helpForPath } from '$lib/domain/help.js';
  import Calendar from './routes/Calendar.svelte';
  import Crops from './routes/Crops.svelte';
  import Home from './routes/Home.svelte';
  import Inventory from './routes/Inventory.svelte';
  import Login from './routes/Login.svelte';
  import Planner from './routes/Planner.svelte';
  import Setup from './routes/Setup.svelte';
  import SiteFooter from './components/SiteFooter.svelte';

  const screens = {
    '/': Home,
    '/planner': Planner,
    '/calendar': Calendar,
    '/crops': Crops,
    '/inventory': Inventory,
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
  let helpOpen = $state(false);
  let authChecked = $state(false);
  let authenticated = $state(false);
  /** @type {string} */
  let authUsername = $state('');
  let loginBusy = $state(false);
  let loginError = $state('');
  let canvas = $state({
    ready: false,
    activeTool: 'select',
    /** @type {null | { addBed: () => void, setTool: (tool: string) => void, addPot: () => void, addTree: () => void, addPlanter: () => void, addObstacle: () => void, printPlan: () => void }} */
    actions: null,
  });

  let iconRail = $derived(wide && collapsed);
  let railWidth = $derived(wide ? (collapsed ? '72px' : '280px') : '0px');
  let showPlannerTools = $derived(path === '/planner' && canvas.ready && canvas.actions !== null);
  let pageTitle = $derived(
    path === '/calendar' ? 'Calendar'
    : path === '/crops' ? 'Crops'
    : path === '/inventory' ? 'Inventory'
    : path === '/planner' ? 'Planner'
    : path === '/settings' ? 'Settings'
    : 'Dashboard',
  );
  let documentTitle = $derived(authenticated ? `Baghban: ${pageTitle}` : 'Baghban: Login');
  let help = $derived(helpForPath(path));
  let fillsScreen = $derived(path === '/planner' || path === '/crops');

  async function checkAuth() {
    try {
      const session = await me();
      authenticated = true;
      authUsername = typeof session?.username === 'string' ? session.username : '';
      loginError = '';
    } catch (err) {
      authenticated = false;
      authUsername = '';
      if (err instanceof ApiError && err.status === 503) {
        loginError = err.message || 'Auth is not configured on the server.';
      }
    } finally {
      authChecked = true;
    }
  }

  /**
   * @param {string} username
   * @param {string} password
   */
  async function submitLogin(username, password) {
    if (loginBusy) return;
    loginBusy = true;
    loginError = '';
    try {
      await login(username, password);
      await checkAuth();
      if (!authenticated) loginError = 'Login failed.';
    } catch (err) {
      loginError = err instanceof Error && err.message ? err.message : 'Login failed.';
      authenticated = false;
    } finally {
      loginBusy = false;
    }
  }

  async function signOut() {
    drawerOpen = false;
    helpOpen = false;
    entryOpen = false;
    try {
      await logout();
    } catch {
      // Still clear local auth state if the cookie clear request fails.
    }
    authenticated = false;
    authUsername = '';
    loginError = '';
  }

  function syncPath() {
    path = normalize(window.location.pathname);
    search = window.location.search;
    entryOpen = false;
    helpOpen = false;
  }

  function openHelp() {
    helpOpen = true;
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
    helpOpen = false;
    const nextSearch = url.search;
    if (next === path && nextSearch === search) return;
    history.pushState(null, '', next + nextSearch);
    path = next;
    search = nextSearch;
    drawerOpen = false;
  }

  void checkAuth();
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>
<svelte:window onpopstate={syncPath} onresize={noteViewport} />
<svelte:document onclick={followLink} onsidebaropen={openDrawer} />

{#if !authChecked}
  <div class="auth-boot">Loading…</div>
{:else if !authenticated}
  <Toaster position="top-right" />
  <Login error={loginError} busy={loginBusy} onLogin={submitLogin} />
{:else}
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
    onClose={() => drawerOpen = false}
    onHelp={openHelp}
    onAddEntry={askForEntry}
    onLogout={signOut}
  />
  <div class={['shell-main', fillsScreen && 'fills-screen']}>
    <header class="page-head">
      {#if !wide}
        <button
          type="button"
          class="nav-menu"
          aria-label="Open menu"
          title="Open menu"
          onclick={openDrawer}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      {/if}
      <h1>{pageTitle}</h1>
    </header>
    <div class="page-body">
      {#if path === '/planner'}
        <Planner {search} onCanvas={noteCanvas} />
      {:else if path === '/settings'}
        <Setup username={authUsername} onUsername={name => { authUsername = name; }} />
      {:else if path === '/calendar'}
        <Calendar bind:entryOpen {entrySession} {entryKind} {search} />
      {:else if path === '/crops'}
        <Crops />
      {:else if path === '/inventory'}
        <Inventory />
      {:else}
        <Home />
      {/if}
    </div>
    <SiteFooter />
  </div>
  <Help open={helpOpen} title={help.title} tips={help.tips} onClose={() => helpOpen = false} />
</div>
{/if}

<style>
  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    height: 100dvh;
    overflow: hidden;
  }

  .shell {
    --page-head: 64px;
    display: flex;
    height: 100vh;
    height: 100dvh;
    min-width: 0;
    background: #f0f4f0;
  }

  .shell-main {
    flex: 1;
    min-width: 0;
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .shell-main.fills-screen {
    overflow: hidden;
  }

  .page-head {
    flex: 0 0 var(--page-head);
    height: var(--page-head);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 24px;
  }

  .nav-menu {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-left: -8px;
    padding: 0;
    border: 0;
    border-radius: 20px;
    background: transparent;
    color: #2d3a2e;
    cursor: pointer;
    flex: 0 0 auto;
  }

  .nav-menu:hover { background: #e6eee2; }

  .nav-menu svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .page-head h1 {
    margin: 0;
    font-family: Roboto, sans-serif;
    font-size: 2rem;
    font-weight: 500;
    color: #191d17;
  }

  .page-body {
    flex: 1 0 auto;
    min-width: 0;
    position: relative;
  }

  .shell-main.fills-screen .page-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  @media (max-width: 800px) {
    .page-head {
      position: sticky;
      top: 0;
      z-index: 5;
      background: #f0f4f0;
    }
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

  .auth-boot {
    display: grid;
    place-items: center;
    min-height: 100vh;
    min-height: 100dvh;
    font-family: Roboto, sans-serif;
    color: #42493d;
    background: #f0f4f0;
  }
</style>
