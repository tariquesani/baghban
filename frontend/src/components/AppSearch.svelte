<script lang="ts">
  import { searchGarden } from '$lib/api/search.js';
  import { Input } from '$lib/components/ui/input';

  type SearchHit = {
    entity: string;
    id: string;
    title: string;
    snippet: string;
    href: string;
    inactive: boolean;
    inactiveLabel: string;
    group: string;
  };

  let query = $state('');
  let open = $state(false);
  let results = $state.raw<SearchHit[]>([]);
  let busy = $state(false);
  let activeIndex = $state(-1);
  let inputEl = $state<HTMLInputElement | null>(null);
  let rootEl = $state<HTMLDivElement | null>(null);
  let requestId = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let groups = $derived.by(() => {
    const order: string[] = [];
    const map = new Map<string, SearchHit[]>();
    for (const hit of results) {
      if (!map.has(hit.group)) {
        map.set(hit.group, []);
        order.push(hit.group);
      }
      map.get(hit.group)!.push(hit);
    }
    return order.map((name) => ({ name, hits: map.get(name)! }));
  });

  let flatHits = $derived(groups.flatMap((group) => group.hits));
  let showPanel = $derived(open && query.trim().length > 0);

  function clearTimer() {
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  async function runSearch(text: string) {
    const trimmed = text.trim();
    const id = ++requestId;
    if (!trimmed) {
      results = [];
      busy = false;
      activeIndex = -1;
      return;
    }
    busy = true;
    try {
      const payload = await searchGarden(trimmed, { limit: 24 });
      if (id !== requestId) return;
      results = Array.isArray(payload?.results) ? payload.results : [];
      activeIndex = results.length ? 0 : -1;
    } catch {
      if (id !== requestId) return;
      results = [];
      activeIndex = -1;
    } finally {
      if (id === requestId) busy = false;
    }
  }

  function scheduleSearch(text: string) {
    clearTimer();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runSearch(text);
    }, 160);
  }

  function onQueryInput() {
    open = true;
    scheduleSearch(query);
  }

  function closePanel() {
    open = false;
    activeIndex = -1;
  }

  function focusSearch() {
    inputEl?.focus();
    inputEl?.select();
    open = true;
    if (query.trim()) scheduleSearch(query);
  }

  function chooseHit(hit: SearchHit) {
    closePanel();
    query = '';
    results = [];
    const url = new URL(hit.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    history.pushState(null, '', url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function onKeydown(event: KeyboardEvent) {
    if (!showPanel || flatHits.length === 0) {
      if (event.key === 'Escape') closePanel();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % flatHits.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + flatHits.length) % flatHits.length;
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      chooseHit(flatHits[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  }

  function onGlobalKey(event: KeyboardEvent) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    focusSearch();
  }

  function onPointerDown(event: PointerEvent) {
    if (!open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (rootEl?.contains(target)) return;
    closePanel();
  }

  $effect(() => {
    return () => clearTimer();
  });
</script>

<svelte:window onkeydown={onGlobalKey} />
<svelte:document onpointerdown={onPointerDown} />

<div class="app-search" bind:this={rootEl}>
  <div class="app-search-field">
    <svg class="app-search-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <Input
      bind:ref={inputEl}
      bind:value={query}
      type="search"
      placeholder="Search..."
      aria-label="Search"
      aria-expanded={showPanel}
      aria-controls="app-search-results"
      autocomplete="off"
      spellcheck="false"
      class="app-search-input"
      oninput={onQueryInput}
      onfocus={() => {
        open = true;
      }}
      onkeydown={onKeydown}
    />
  </div>

  {#if showPanel}
    <div
      id="app-search-results"
      class="app-search-panel"
      role="listbox"
      aria-label="Search results"
    >
      {#if busy && results.length === 0}
        <p class="app-search-empty">Searching…</p>
      {:else if results.length === 0}
        <p class="app-search-empty">No matches</p>
      {:else}
        {@const indexed = flatHits}
        {#each groups as group (group.name)}
          <section class="app-search-group">
            <h2>{group.name}</h2>
            <ul>
              {#each group.hits as hit (hit.entity + ':' + hit.id)}
                {@const index = indexed.findIndex(
                  (item) => item.entity === hit.entity && item.id === hit.id,
                )}
                <li>
                  <a
                    href={hit.href}
                    class={[
                      'app-search-hit',
                      hit.inactive && 'is-inactive',
                      index === activeIndex && 'is-active',
                    ]}
                    role="option"
                    aria-selected={index === activeIndex}
                    onclick={(event) => {
                      event.preventDefault();
                      chooseHit(hit);
                    }}
                    onpointerenter={() => {
                      activeIndex = index;
                    }}
                  >
                    <span class="app-search-hit-main">
                      <span class="app-search-hit-title">{hit.title}</span>
                      {#if hit.snippet}
                        <span class="app-search-hit-snip">{hit.snippet}</span>
                      {/if}
                    </span>
                    {#if hit.inactive && hit.inactiveLabel}
                      <span class="app-search-hit-flag">{hit.inactiveLabel}</span>
                    {/if}
                  </a>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .app-search {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 28rem;
    margin-left: auto;
  }

  .app-search-field {
    position: relative;
    display: flex;
    align-items: center;
  }

  .app-search-icon {
    position: absolute;
    left: 12px;
    z-index: 1;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: #5c6b5e;
    stroke-width: 2;
    stroke-linecap: round;
    pointer-events: none;
  }

  .app-search :global(.app-search-input) {
    height: 40px;
    padding-left: 36px;
    border-radius: 999px;
    background: #e8eee6;
    border-color: transparent;
    box-shadow: none;
    color: #191d17;
  }

  .app-search :global(.app-search-input::placeholder) {
    color: #5c6b5e;
  }

  .app-search :global(.app-search-input:focus-visible) {
    background: #fff;
    border-color: #c5d0c2;
  }

  .app-search-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    left: 0;
    z-index: 40;
    max-height: min(70vh, 28rem);
    overflow: auto;
    border-radius: 12px;
    border: 1px solid #d5ddd2;
    background: #fff;
    box-shadow: 0 12px 32px rgb(25 29 23 / 12%);
  }

  .app-search-empty {
    margin: 0;
    padding: 14px 16px;
    color: #5c6b5e;
    font: 400 0.875rem/1.4 Roboto, sans-serif;
  }

  .app-search-group {
    padding: 8px 0;
  }

  .app-search-group + .app-search-group {
    border-top: 1px solid #e6eee2;
  }

  .app-search-group h2 {
    margin: 0;
    padding: 6px 14px 4px;
    font: 500 0.7rem/1.2 Roboto, sans-serif;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #5c6b5e;
  }

  .app-search-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .app-search-hit {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 14px;
    text-decoration: none;
    color: #191d17;
  }

  .app-search-hit.is-active {
    background: #eef3eb;
  }

  .app-search-hit.is-inactive {
    background: #f3f1ea;
  }

  .app-search-hit.is-inactive.is-active {
    background: #ebe6da;
  }

  .app-search-hit-main {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .app-search-hit-title {
    font: 500 0.9375rem/1.3 Roboto, sans-serif;
  }

  .app-search-hit-snip {
    overflow: hidden;
    color: #5c6b5e;
    font: 400 0.8125rem/1.35 Roboto, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-search-hit-flag {
    flex: 0 0 auto;
    margin-top: 2px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #e4dcc8;
    color: #5a5140;
    font: 500 0.6875rem/1.2 Roboto, sans-serif;
  }

  @media (max-width: 800px) {
    .app-search {
      max-width: none;
      margin-left: 0;
    }
  }
</style>
