<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';

  let {
    item,
    onclick,
  }: {
    item: {
      id: number;
      name: string;
      description: string;
      quantity: number;
      locationPath: string;
      tags: string[];
    };
    onclick: () => void;
  } = $props();

  let quantityLabel = $derived(
    item.quantity === 1 || item.quantity === null || item.quantity === undefined
      ? 'Qty 1'
      : `Qty ${item.quantity}`,
  );
</script>

<button type="button" class="card-button" {onclick}>
  <Card.Root class="h-full transition-colors hover:bg-muted/40">
    <Card.Header class="gap-2">
      <Card.Title class="text-base leading-snug text-left">{item.name}</Card.Title>
      {#if item.locationPath}
        <Card.Description class="text-left">{item.locationPath}</Card.Description>
      {/if}
    </Card.Header>
    <Card.Content class="flex flex-col gap-3 text-left">
      <p class="text-sm text-muted-foreground">{quantityLabel}</p>
      {#if item.description}
        <p class="text-sm leading-relaxed text-foreground/90 line-clamp-3">{item.description}</p>
      {/if}
      {#if item.tags.length}
        <div class="flex flex-wrap gap-1.5">
          {#each item.tags as tag (tag)}
            <Badge variant="secondary">{tag}</Badge>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</button>

<style>
  .card-button {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: inherit;
    cursor: pointer;
  }
</style>
