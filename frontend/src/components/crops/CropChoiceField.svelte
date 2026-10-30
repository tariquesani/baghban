<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import XIcon from '@lucide/svelte/icons/x';
  import { tick } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Command from '$lib/components/ui/command';
  import * as Field from '$lib/components/ui/field';
  import * as Popover from '$lib/components/ui/popover';

  type Choice = {
    id: number;
    name: string;
    emoji: string;
    aliases: string[];
  };

  let {
    label,
    choices,
    selfId,
    selected,
    blocked,
    onAdd,
    onRemove,
  }: {
    label: string;
    choices: Choice[];
    selfId: number | '';
    selected: number[];
    blocked: number[];
    onAdd: (id: number) => void;
    onRemove: (id: number) => void;
  } = $props();

  let open = $state(false);
  let search = $state('');
  let triggerRef = $state<HTMLButtonElement | null>(null);

  const available = $derived(
    choices.filter((crop) => {
      if (crop.id === selfId) return false;
      return !selected.includes(crop.id) && !blocked.includes(crop.id);
    }),
  );

  function nameOf(id: number) {
    return choices.find((crop) => crop.id === id)?.name ?? String(id);
  }

  function closeAndFocusTrigger() {
    open = false;
    search = '';
    tick().then(() => triggerRef?.focus());
  }
</script>

<Field.Set class="gap-3">
  <Field.Legend variant="label">{label}</Field.Legend>
  {#if selected.length}
    <div class="flex flex-wrap gap-2">
      {#each selected as id (id)}
        <Badge variant="secondary">
          {nameOf(id)}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${nameOf(id)}`}
            onclick={() => onRemove(id)}
          >
            <XIcon />
          </Button>
        </Badge>
      {/each}
    </div>
  {/if}
  <Popover.Root bind:open>
    <Popover.Trigger bind:ref={triggerRef}>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="outline"
          class="w-full justify-between font-normal"
          role="combobox"
          aria-expanded={open}
        >
          Search crops
          <ChevronDownIcon class="text-muted-foreground" />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-72 p-0" align="start">
      <Command.Root bind:value={search}>
        <Command.Input placeholder="Search crops" />
        <Command.List>
          <Command.Empty>No crops match.</Command.Empty>
          <Command.Group>
            {#each available as crop (crop.id)}
              <Command.Item
                value="{crop.name} {crop.aliases.join(' ')} {crop.id}"
                onSelect={() => {
                  onAdd(crop.id);
                  closeAndFocusTrigger();
                }}
              >
                {#if crop.emoji}<span aria-hidden="true">{crop.emoji}</span>{/if}
                {crop.name}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
</Field.Set>
