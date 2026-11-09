<script lang="ts">
  import { cropIconUrl } from '$lib/api/crops.js';

  let {
    id = 0,
    icon = '',
    emoji = '',
    iconRev = null,
  }: {
    id?: number;
    icon?: string;
    emoji?: string;
    iconRev?: number | string | null;
  } = $props();

  const src = $derived(icon && id ? cropIconUrl(id, iconRev) : '');
</script>

{#if src}
  <img alt="" class="size-5 shrink-0 object-contain" src={src} />
{:else if emoji}
  <span aria-hidden="true">{emoji}</span>
{/if}
