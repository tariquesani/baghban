<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  let {
    busy = false,
    onUproot,
  }: {
    busy?: boolean;
    onUproot: () => void;
  } = $props();

  let confirming = $state(false);

  function uprootAll() {
    if (busy) return;
    confirming = false;
    onUproot();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Uproot all plants</Card.Title>
    <Card.Description>
      Clears every crop from every bed, pot, tree, and planter. The layout, scale, and place stay.
    </Card.Description>
  </Card.Header>
  {#if confirming}
    <Card.Content>
      <p class="text-sm text-muted-foreground">This cannot be undone.</p>
    </Card.Content>
  {/if}
  <Card.Footer class="gap-2">
    {#if !confirming}
      <Button type="button" variant="destructive" disabled={busy} onclick={() => confirming = true}>
        Uproot all plants
      </Button>
    {:else}
      <Button type="button" variant="destructive" disabled={busy} onclick={uprootAll}>
        Yes, clear every crop
      </Button>
      <Button type="button" variant="outline" disabled={busy} onclick={() => confirming = false}>
        Cancel
      </Button>
    {/if}
  </Card.Footer>
</Card.Root>
