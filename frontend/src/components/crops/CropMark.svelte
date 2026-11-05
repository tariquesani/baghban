<script lang="ts">
  import { cropIconUrl } from '$lib/api/crops.js';

  let { id = 0, icon = '', emoji = '' }: { id?: number; icon?: string; emoji?: string } = $props();

  const src = $derived(icon && id ? cropIconUrl(id) : '');
</script>

{#if src}
  <img alt="" class="size-5 shrink-0 object-contain" src={src} />
{:else if emoji}
  <span aria-hidden="true">{emoji}</span>
{/if}
