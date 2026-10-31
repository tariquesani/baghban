<script lang="ts">
  import MapIcon from '@lucide/svelte/icons/map';
  import BedPickerDialog from './BedPickerDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';

  type Item = { value: string; label: string };

  let {
    id,
    label = 'Bed',
    hint = '',
    items,
    disabled = false,
    emptyLabel = 'Not in a bed',
    value = $bindable('none'),
  }: {
    id: string;
    label?: string;
    hint?: string;
    items: Item[];
    disabled?: boolean;
    emptyLabel?: string;
    value?: string;
  } = $props();

  const shown = $derived(
    items.find((item) => item.value === value)?.label
      ?? (items.length === 1 ? items[0].label : emptyLabel),
  );

  let pickerOpen = $state(false);

  function chooseBed(bedId: number) {
    const next = String(bedId);
    if (!items.some((item) => item.value === next)) return;
    value = next;
    pickerOpen = false;
  }
</script>

<Field.Field>
  <Field.Label for={id}>{label}</Field.Label>
  {#if disabled}
    <Input {id} class="w-full" value={shown} disabled />
  {:else}
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <Select.Root type="single" name="bed" {items} bind:value>
          <Select.Trigger {id} class="w-full">
            <Select.Value placeholder="Choose a bed" />
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each items as item (item.value)}
                <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Choose a bed on the map"
        onclick={() => (pickerOpen = true)}
      >
        <MapIcon />
      </Button>
    </div>
  {/if}
  {#if hint}
    <Field.Description>{hint}</Field.Description>
  {/if}
</Field.Field>

{#if !disabled}
  <BedPickerDialog bind:open={pickerOpen} bedId={value} onPick={chooseBed} />
{/if}
