<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { CALENDAR_KINDS, kindLabel } from '$lib/domain/calendar.js';

  let {
    kind,
    onKind,
    onShowOctober,
  }: {
    kind: string;
    onKind: (kind: string) => void;
    onShowOctober: () => void;
  } = $props();

  const choice = $derived(kind || 'all');
  const chipClass =
    'data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground data-[state=on]:hover:bg-primary/25 data-[state=on]:hover:text-foreground';

  function chooseKind(value: string) {
    if (!value) return;
    onKind(value === 'all' ? '' : value);
  }
</script>

<div class="tools">
  <ToggleGroup.Root
    type="single"
    variant="outline"
    spacing={2}
    class="flex-wrap justify-start"
    aria-label="Kind"
    value={choice}
    onValueChange={chooseKind}
  >
    <ToggleGroup.Item value="all" class={chipClass}>All</ToggleGroup.Item>
    {#each CALENDAR_KINDS as name (name)}
      <ToggleGroup.Item value={name} class={chipClass}>{kindLabel(name)}</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
  <Button variant="link" class="px-2" onclick={onShowOctober}>Go to October</Button>
</div>

<style>
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
</style>
