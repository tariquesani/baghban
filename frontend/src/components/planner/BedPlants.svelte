<script lang="ts">
  import AddCropDialog from './AddCropDialog.svelte';
  import RecordDialog from '../calendar/RecordDialog.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Field from '$lib/components/ui/field';
  import { bedCropNames, localDate } from '$lib/domain/sowing.js';
  import { hint, legend, section } from './inspector';
  import type { SelectionDetails } from './selection';

  let { details }: { details: SelectionDetails } = $props();

  let addOpen = $state(false);
  let entryOpen = $state(false);
  let entryKind = $state<'care' | 'pest' | 'harvest' | 'uproot'>('care');
  let entrySession = $state(0);
  let entryDate = $state(localDate());
  let entryCrop = $state('');

  const cropNames = $derived(bedCropNames(details.plants));
  const onlyCrop = $derived(cropNames.length === 1 ? cropNames[0] : '');
  const bedNumber = $derived.by(() => {
    const id = typeof details.id === 'number' ? details.id : Number(details.id);
    return Number.isInteger(id) ? id : null;
  });

  function syncCanvasAfterUproot(name: string) {
    const removePlant = (globalThis as { removePlant?: (name: string) => void }).removePlant;
    removePlant?.(name);
  }

  function record(kind: 'care' | 'pest' | 'harvest' | 'uproot', crop = '') {
    entryKind = kind;
    entryCrop = crop || onlyCrop;
    entryDate = localDate();
    entrySession += 1;
    entryOpen = true;
  }

  function onEntrySaved(entry: { kind: string; crop: string }) {
    if (entry.kind === 'uproot' && entry.crop) syncCanvasAfterUproot(entry.crop);
  }
</script>

<Field.FieldSet class="{section} m-0 min-w-0 gap-1.5 border-x-0 border-t-0">
  <Field.FieldLegend class="{legend} mb-0">Crops</Field.FieldLegend>
  {#if details.plants.length}
    <div class="flex flex-wrap gap-1">
      {#each details.plants as name (name)}
        <Badge variant="secondary" class="h-auto px-1.5 py-0.5 text-[10px]">{name}</Badge>
      {/each}
    </div>
  {/if}
  {#if details.plantWarn}
    <Field.Error class={hint}>{details.plantWarn}</Field.Error>
  {/if}
  <div class="flex flex-col gap-1.5">
    <Button id="add-crop" type="button" size="sm" class="h-7 w-full text-xs" onclick={() => (addOpen = true)}>
      Add Crop
    </Button>
    {#if details.plants.length}
      <Button id="bed-care" type="button" variant="outline" size="sm" class="h-7 w-full text-xs" onclick={() => record('care')}>
        Care
      </Button>
      <Button id="bed-harvest" type="button" variant="outline" size="sm" class="h-7 w-full text-xs" onclick={() => record('harvest')}>
        Harvest
      </Button>
      <Button id="bed-pest" type="button" variant="outline" size="sm" class="h-7 w-full text-xs" onclick={() => record('pest')}>
        Pest Control
      </Button>
      <Button id="bed-uproot" type="button" variant="outline" size="sm" class="h-7 w-full text-xs" onclick={() => record('uproot')}>
        Uproot
      </Button>
    {/if}
  </div>
</Field.FieldSet>

<AddCropDialog bind:open={addOpen} bedId={details.id} bedName={details.name} plants={details.plants} />

<RecordDialog
  bind:open={entryOpen}
  kind={entryKind}
  addSession={entrySession}
  editSession={0}
  selectedDate={entryDate}
  selectedCrop={entryCrop || onlyCrop}
  lockedBedId={bedNumber}
  lockedBedName={details.name}
  {cropNames}
  onSaved={onEntrySaved}
/>
