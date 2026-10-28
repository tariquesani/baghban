<script>
  import { loadLucide } from '$lib/planner/mount';

  /**
   * @param {{
   *   path: string,
   *   wide: boolean,
   *   iconRail: boolean,
   *   drawerOpen: boolean,
   *   showPlannerTools: boolean,
   *   activeTool: string,
   *   actions: null | {
   *     addBed: () => void,
   *     setTool: (tool: string) => void,
   *     addPot: () => void,
   *     addPlanter: () => void,
   *     addObstacle: () => void,
   *     printPlan: () => void,
   *   },
   *   onToggle: () => void,
   * }} props
   */
  let {
    path,
    wide,
    iconRail,
    drawerOpen,
    showPlannerTools,
    activeTool,
    actions,
    onToggle,
  } = $props();

  const entries = [
    { id: 'home', label: 'Home', icon: 'house', href: '/' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', href: '/calendar' },
    { id: 'crops', label: 'Crops', icon: 'leaf', href: '/crops' },
    { id: 'planner', label: 'Planner', icon: 'map', href: '/planner' },
    { id: 'planter', label: 'Planter', icon: 'layout-grid' },
    { id: 'inventory', label: 'Inventory', icon: 'package' },
    { id: 'setup', label: 'Setup', icon: 'ruler' },
    { id: 'help', label: 'Help', icon: 'circle-help' },
  ];

  let toggleLabel = $derived(
    wide ? (iconRail ? 'Expand sidebar' : 'Collapse sidebar') : 'Close sidebar',
  );

  /** @param {string} href */
  function current(href) {
    if (href === '/planner') return path === '/planner' || path === '/settings';
    return path === href;
  }

  function plotBed() {
    actions?.setTool(activeTool === 'draw-bed' ? 'select' : 'draw-bed');
  }

  $effect(() => {
    void [path, iconRail, drawerOpen, showPlannerTools, activeTool];
    let cancel = false;
    loadLucide().then(() => {
      if (!cancel) window.lucide?.createIcons();
    });
    return () => {
      cancel = true;
    };
  });
</script>

<aside class="app-rail" class:icon-rail={iconRail} class:is-open={drawerOpen}>
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">
      <i data-lucide="sprout"></i>
    </div>
    <div class="brand-copy">
      <p class="title">Baghban</p>
      <p class="subtitle">Garden Management System</p>
    </div>
    <button
      type="button"
      class="rail-toggle"
      aria-expanded={wide ? !iconRail : drawerOpen}
      aria-label={toggleLabel}
      title={toggleLabel}
      onclick={onToggle}
    >
      <i data-lucide="chevrons-left" class="when-open"></i>
      <i data-lucide="chevrons-right" class="when-closed"></i>
      <i data-lucide="x" class="when-drawer"></i>
    </button>
  </div>

  <div class="rail-scroll">
    {#each entries as entry (entry.id)}
      {#if entry.href}
        <a
          class="rail-btn"
          class:active={current(entry.href)}
          href={entry.href}
          aria-current={current(entry.href) ? 'page' : undefined}
          title={entry.label}
        >
          <i data-lucide={entry.icon}></i>
          <span class="rail-label">{entry.label}</span>
        </a>
      {:else}
        <button type="button" class="rail-btn" title={entry.label}>
          <i data-lucide={entry.icon}></i>
          <span class="rail-label">{entry.label}</span>
        </button>
      {/if}
      {#if entry.id === 'planner' && showPlannerTools && actions}
        <div class="rail-tools">
          <button type="button" class="rail-btn" title="Add bed" onclick={() => actions.addBed()}>
            <i data-lucide="square"></i>
            <span class="rail-label">Add rectangular bed</span>
          </button>
          <button
            type="button"
            class="rail-btn"
            title="Plot a bed"
            onclick={plotBed}
          >
            <i data-lucide="vector-polygon"></i>
            <span class="rail-label">Add polygonal bed</span>
          </button>
          <button type="button" class="rail-btn" title="Add pot" onclick={() => actions.addPot()}>
            <i data-lucide="circle"></i>
            <span class="rail-label">Add pot</span>
          </button>
          <button type="button" class="rail-btn" title="Add planter" onclick={() => actions.addPlanter()}>
            <i data-lucide="rectangle-horizontal"></i>
            <span class="rail-label">Add planter</span>
          </button>
          <button type="button" class="rail-btn" title="Add obstacle" onclick={() => actions.addObstacle()}>
            <i data-lucide="mountain"></i>
            <span class="rail-label">Add obstacle</span>
          </button>
          <button type="button" class="rail-btn" title="Print plan" onclick={() => actions.printPlan()}>
            <i data-lucide="printer"></i>
            <span class="rail-label">Print plan</span>
          </button>
        </div>
      {/if}
    {/each}
  </div>
</aside>

<style>
  .app-rail {
    --md-primary: #386a20;
    --md-on-primary: #ffffff;
    --md-surface-container-high: #e6eee2;
    --md-on-surface: #191d17;
    --md-on-surface-variant: #42493d;
    --md-outline-variant: #c2c9bb;
    box-sizing: border-box;
    width: var(--rail-width);
    flex: 0 0 var(--rail-width);
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100vh;
    background: #fff;
    border-right: 1px solid var(--md-outline-variant);
    color: var(--md-on-surface);
    font-family: Roboto, sans-serif;
    overflow: hidden;
  }

  .app-rail :global(*),
  .app-rail :global(*::before) {
    box-sizing: border-box;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 12px 8px 8px 12px;
  }

  .brand-mark {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--md-primary);
    color: var(--md-on-primary);
  }

  .brand-copy { min-width: 0; }
  .title { margin: 0; font-size: 1rem; line-height: 1.5rem; font-weight: 500; }
  .subtitle {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--md-on-surface-variant);
    white-space: nowrap;
  }

  .rail-toggle {
    margin-left: auto;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    background: transparent;
    color: var(--md-on-surface-variant);
    cursor: pointer;
  }

  .rail-toggle:hover { background: var(--md-surface-container-high); }
  .when-closed, .when-drawer { display: none; }

  .rail-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
  }

  .rail-btn {
    width: 100%;
    min-height: 40px;
    margin: 2px 0;
    padding: 8px 12px;
    border: 0;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: transparent;
    color: var(--md-on-surface-variant);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }

  .rail-btn:hover { background: var(--md-surface-container-high); }
  .rail-btn.active { background: var(--md-primary); color: var(--md-on-primary); }
  .rail-btn.active:hover { background: var(--md-primary); color: var(--md-on-primary); }

  .rail-tools {
    margin: 0 4px 8px 22px;
    padding-left: 8px;
    border-left: 2px solid var(--md-outline-variant);
  }

  .app-rail :global(svg.lucide) {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
  }

  .icon-rail .brand { flex-direction: column; padding: 12px 8px 4px; gap: 4px; }
  .icon-rail .brand-copy { display: none; }
  .icon-rail .rail-toggle { margin-left: 0; }
  .icon-rail .when-open { display: none; }
  .icon-rail .when-closed { display: block; }
  .icon-rail .rail-label { display: none; }
  .icon-rail .rail-btn {
    box-sizing: border-box;
    width: 100%;
    height: 40px;
    min-height: 40px;
    padding: 0;
    justify-content: center;
    gap: 0;
  }
  .icon-rail .rail-tools {
    position: relative;
    margin: 0 0 8px;
    padding-left: 0;
    border-left: 0;
  }
  .icon-rail .rail-tools::before {
    content: "";
    position: absolute;
    left: 10px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--md-outline-variant);
  }
  .icon-rail .rail-tools .rail-btn {
    width: 30px;
    height: 30px;
    min-height: 30px;
    margin: 5px auto;
    padding: 0;
    border-radius: 8px;
    justify-content: center;
  }

  @media (max-width: 800px) {
    .app-rail {
      position: fixed;
      z-index: 200;
      left: 0;
      top: 0;
      width: min(320px, 88vw);
      flex: none;
      transform: translateX(-105%);
      transition: transform 0.2s ease;
      box-shadow: none;
    }

    .app-rail.is-open {
      transform: none;
      box-shadow: 0 8px 28px rgba(25, 29, 23, 0.24);
    }

    .when-open, .when-closed { display: none; }
    .when-drawer { display: block; }
  }

  @media (prefers-reduced-motion: reduce) {
    .app-rail { transition: none; }
  }
</style>
