<script>
  import Calendar from './routes/Calendar.svelte';
  import Home from './routes/Home.svelte';
  import Planner from './routes/Planner.svelte';

  const screens = {
    '/': Home,
    '/planner': Planner,
    '/calendar': Calendar,
  };

  /** @param {string} pathname */
  function normalize(pathname) {
    if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
    return pathname;
  }

  let path = $state(normalize(window.location.pathname));

  function syncPath() {
    path = normalize(window.location.pathname);
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
    if (next === path) return;
    history.pushState(null, '', next);
    path = next;
  }
</script>

<svelte:window onpopstate={syncPath} />
<svelte:document onclick={followLink} />

{#if path === '/planner'}
  <Planner />
{:else if path === '/calendar'}
  <Calendar />
{:else}
  <Home />
{/if}
