<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { tick } from 'svelte';
  import { createCalendarEntry } from '$lib/api/calendar.js';
  import { listCrops } from '$lib/api/crops.js';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Command from '$lib/components/ui/command';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Field from '$lib/components/ui/field';
  import * as Popover from '$lib/components/ui/popover';
  import CropMark from '../crops/CropMark.svelte';
  import { cropsNotInBed, localDate, sowingRequest } from '$lib/domain/sowing.js';
  import { cn } from '$lib/utils.js';

  type CropChoice = {
    id: number;
    name: string;
    emoji: string;
    icon: string;
    aliases: string[];
  };

  let {
    open = $bindable(false),
    bedId,
    bedName,
    plants,
  }: {
    open?: boolean;
    bedId: number | string;
    bedName: string;
    plants: string[];
  } = $props();

  let catalogue = $state.raw<CropChoice[]>([]);
  let listError = $state('');
  let loading = $state(false);
  let cropOpen = $state(false);
  let query = $state('');
  let chosen = $state<CropChoice | null>(null);
  let sowing = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let busy = $state(false);
  let formError = $state('');
  let fieldError = $state('');

  const available = $derived(cropsNotInBed(catalogue, plants));
  const chosenLabel = $derived(chosen ? chosen.name : '');
  const place = $derived(bedName.trim() || 'this bed');

  $effect(() => {
    if (!open) return;
    let cancelled = false;
    loading = true;
    listError = '';
    listCrops()
      .then((rows: CropChoice[]) => {
        if (!cancelled) catalogue = Array.isArray(rows) ? rows : [];
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        listError = error instanceof Error ? error.message : 'Could not load crops.';
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  function matchCrop(value: string, search: string, keywords: string[] = []) {
    const text = search.trim().toLowerCase();
    if (!text) return 1;
    const haystack = [value, ...keywords].join(' ').toLowerCase();
    return haystack.includes(text) ? 1 : 0;
  }

  function choose(crop: CropChoice) {
    chosen = crop;
    fieldError = '';
    formError = '';
    cropOpen = false;
    query = '';
    tick().then(() => trigger?.focus());
  }

  function reset() {
    catalogue = [];
    listError = '';
    loading = false;
    cropOpen = false;
    query = '';
    chosen = null;
    sowing = false;
    busy = false;
    formError = '';
    fieldError = '';
  }

  function close() {
    open = false;
    reset();
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !chosen) return;
    const addPlant = (globalThis as { addPlant?: (name: string) => boolean }).addPlant;
    if (!addPlant) {
      formError = 'Could not add the crop.';
      return;
    }
    busy = true;
    const label = chosen.emoji ? `${chosen.emoji} ${chosen.name}` : chosen.name;
    const cropName = chosen.name;
    const recordSowing = sowing;
    try {
      if (!addPlant(label)) {
        close();
        return;
      }
      if (!recordSowing) {
        close();
        return;
      }
      const request = sowingRequest(
        {
          crop: cropName,
          cropId: chosen.id,
          date: localDate(),
          status: 'done',
          bedId: String(bedId),
          note: '',
        },
        [chosen],
      );
      if (!request.ok) {
        fieldError = request.field;
        formError = request.message;
        return;
      }
      fieldError = '';
      formError = '';
      await createCalendarEntry(request.body);
      close();
    } catch (error: unknown) {
      formError = error instanceof Error ? error.message : 'Could not save the sowing.';
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(next) => {
    if (!next) reset();
  }}
>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Add Crop</Dialog.Title>
      <Dialog.Description>Adds a crop to {place}.</Dialog.Description>
    </Dialog.Header>
    <form class="flex flex-col gap-4" onsubmit={save}>
      <Field.FieldGroup>
        <Field.Field data-invalid={fieldError === 'crop' || undefined}>
          <Field.Label for="add-crop-name">Crop</Field.Label>
          <Popover.Root
            bind:open={cropOpen}
            onOpenChange={(next) => {
              if (!next) query = '';
            }}
          >
            <Popover.Trigger bind:ref={trigger}>
              {#snippet child({ props })}
                <Button
                  {...props}
                  id="add-crop-name"
                  type="button"
                  variant="outline"
                  class="w-full justify-between font-normal"
                  role="combobox"
                  aria-expanded={cropOpen}
                  aria-invalid={fieldError === 'crop' || undefined}
                  disabled={loading}
                >
                  <span class={cn('flex min-w-0 flex-1 items-center gap-2 text-left', !chosenLabel && 'text-muted-foreground')}>
                    {#if chosen}<CropMark id={chosen.id} icon={chosen.icon} emoji={chosen.emoji} />{/if}
                    <span class="truncate">{chosenLabel || (loading ? 'Loading crops...' : 'Choose a crop')}</span>
                  </span>
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              {/snippet}
            </Popover.Trigger>
            <Popover.Content class="w-(--bits-popover-anchor-width) gap-0 p-0" align="start">
              <Command.Root filter={matchCrop}>
                <Command.Input placeholder="Search crops..." bind:value={query} />
                <Command.List>
                  <Command.Empty>{catalogue.length === 0 ? 'No crops yet.' : 'No crops match.'}</Command.Empty>
                  <Command.Group>
                    {#each available as crop (crop.id)}
                      <Command.Item
                        value={crop.name}
                        keywords={crop.aliases}
                        data-checked={chosen?.id === crop.id}
                        onSelect={() => choose(crop)}
                      >
                        <CropMark id={crop.id} icon={crop.icon} emoji={crop.emoji} />
                        {crop.name}
                      </Command.Item>
                    {/each}
                  </Command.Group>
                </Command.List>
              </Command.Root>
            </Popover.Content>
          </Popover.Root>
          {#if fieldError === 'crop'}<Field.Error>{formError}</Field.Error>{/if}
        </Field.Field>
        <Field.Field orientation="horizontal" class="w-fit">
          <Checkbox
            id="add-crop-sowing"
            checked={sowing}
            onCheckedChange={(checked) => {
              sowing = checked === true;
            }}
          />
          <Field.Label for="add-crop-sowing" class="font-normal">I am sowing this crop</Field.Label>
        </Field.Field>
      </Field.FieldGroup>
      {#if listError}<Field.Error>{listError}</Field.Error>{/if}
      {#if formError && fieldError !== 'crop'}<Field.Error>{formError}</Field.Error>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" disabled={busy} onclick={close}>Cancel</Button>
        <Button type="submit" disabled={busy || loading || !chosen}>{busy ? 'Adding…' : 'Add'}</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
