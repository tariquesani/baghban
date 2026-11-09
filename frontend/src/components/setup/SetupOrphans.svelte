<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  type OrphanBed = {
    id: number;
    name: string;
    kind: string;
  };

  let {
    beds = [],
    busy = false,
    error = '',
    onPurge,
  }: {
    beds?: OrphanBed[];
    busy?: boolean;
    error?: string;
    onPurge: (id: number) => void;
  } = $props();

  let confirmingId = $state<number | null>(null);

  function askPurge(id: number) {
    if (busy) return;
    confirmingId = id;
  }

  function confirmPurge(id: number) {
    if (busy) return;
    confirmingId = null;
    onPurge(id);
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Orphan beds</Card.Title>
    <Card.Description>
      Removed beds with no crop history and no diary or crop calendar entries. Purge deletes them for good.
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-3">
    {#if error}
      <p class="text-sm text-destructive" role="alert">{error}</p>
    {/if}
    {#if beds.length === 0}
      <p class="text-sm text-muted-foreground">No orphan beds.</p>
    {:else}
      <ul class="flex flex-col gap-2">
        {#each beds as bed (bed.id)}
          <li class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{bed.name || `Bed ${bed.id}`}</p>
              <p class="text-xs text-muted-foreground capitalize">{bed.kind}</p>
            </div>
            {#if confirmingId === bed.id}
              <div class="flex gap-2">
                <Button type="button" variant="destructive" size="sm" disabled={busy} onclick={() => confirmPurge(bed.id)}>
                  Yes, purge
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={busy} onclick={() => confirmingId = null}>
                  Cancel
                </Button>
              </div>
            {:else}
              <Button type="button" variant="destructive" size="sm" disabled={busy} onclick={() => askPurge(bed.id)}>
                Purge
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Card.Content>
</Card.Root>
