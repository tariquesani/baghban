<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  let {
    busy = false,
    onReset,
  }: {
    busy?: boolean;
    onReset: () => void;
  } = $props();

  let confirming = $state(false);

  function resetGarden() {
    if (busy) return;
    confirming = false;
    onReset();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Start again</Card.Title>
    <Card.Description>
      Clears the beds, plants, obstacles, plan photo, and scale. The name and place stay.
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
        Reset garden
      </Button>
    {:else}
      <Button type="button" variant="destructive" disabled={busy} onclick={resetGarden}>
        Yes, start fresh
      </Button>
      <Button type="button" variant="outline" disabled={busy} onclick={() => confirming = false}>
        Cancel
      </Button>
    {/if}
  </Card.Footer>
</Card.Root>
