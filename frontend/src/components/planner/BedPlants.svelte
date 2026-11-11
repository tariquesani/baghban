<script lang="ts">
  import AddCropDialog from './AddCropDialog.svelte';
  import RecordDialog from '../calendar/RecordDialog.svelte';
  import CropMark from '../crops/CropMark.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Field from '$lib/components/ui/field';
  import { listCrops } from '$lib/api/crops.js';
  import { plantCatalogFromCrops } from '$lib/domain/plant-catalog.js';
  import { plantDetailRows, plantingAlerts } from '$lib/domain/planting.js';
  import { bedCropNames, localDate, plantCropName } from '$lib/domain/sowing.js';
  import { hint, legend, section } from './inspector';
  import type { SelectionDetails } from './selection';

  let { details }: { details: SelectionDetails } = $props();

  let addOpen = $state(false);
  let entryOpen = $state(false);
  let entryKind = $state<'care' | 'pest' | 'harvest' | 'uproot'>('care');
  let entrySession = $state(0);
  let entryDate = $state(localDate());
  let entryCrop = $state('');
  let catalogue = $state.raw<ReturnType<typeof plantCatalogFromCrops>>([]);

  const cropNames = $derived(bedCropNames(details.plants));
  const onlyCrop = $derived(cropNames.length === 1 ? cropNames[0] : '');
  const bedNumber = $derived.by(() => {
    const id = typeof details.id === 'number' ? details.id : Number(details.id);
    return Number.isInteger(id) ? id : null;
  });
  const showSoilDepth = $derived(!details.showPot && !details.showTree && !details.showPlanter);
  const alerts = $derived(plantingAlerts(details.plants, catalogue));
  const rows = $derived(
    plantDetailRows(details.plants, catalogue, details.areaSqFt, { showSoilDepth }),
  );

  $effect(() => {
    if (!details.showPlants || details.plants.length === 0) {
      catalogue = [];
      return;
    }
    let cancelled = false;
    listCrops()
      .then((crops: unknown) => {
        if (!cancelled) catalogue = plantCatalogFromCrops(crops);
      })
      .catch(() => {
        if (!cancelled) catalogue = [];
      });
    return () => {
      cancelled = true;
    };
  });

  function syncCanvasAfterUproot(name: string) {
    const removePlant = (globalThis as { removePlant?: (name: string) => void }).removePlant;
    const wanted = name.trim().toLowerCase();
    const label =
      details.plants.find((plant) => plantCropName(plant).toLowerCase() === wanted) || name;
    removePlant?.(label);
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
  {#if alerts.conflicts.length}
    <Field.Error class={hint}>Conflicts: {alerts.conflicts.join(' · ')}</Field.Error>
  {/if}
  {#if alerts.companions.length}
    <p class="{hint} text-muted-foreground">Good companions: {alerts.companions.join(' · ')}</p>
  {/if}
  {#if rows.length}
    <ul class="flex flex-col gap-2">
      {#each rows as row (row.key)}
        <li class="min-w-0 rounded-md border border-border/70 px-2 py-1.5">
          <div class="flex min-w-0 items-center gap-1.5">
            {#if row.icon || row.emoji}
              <CropMark id={row.id} icon={row.icon} emoji={row.emoji} />
            {/if}
            <span class="truncate text-xs font-medium">{row.name}</span>
          </div>
          {#if row.pills.length}
            <div class="mt-1 flex flex-wrap gap-1">
              {#each row.pills as pill (pill)}
                <Badge variant="secondary" class="h-auto px-1.5 py-0 text-[10px] font-normal">{pill}</Badge>
              {/each}
            </div>
          {/if}
          {#if row.companions.length || row.conflicts.length}
            <div class="mt-1 flex flex-wrap gap-1">
              {#each row.companions as name (name)}
                <Badge variant="outline" class="h-auto px-1.5 py-0 text-[10px] font-normal">With {name}</Badge>
              {/each}
              {#each row.conflicts as name (name)}
                <Badge variant="destructive" class="h-auto px-1.5 py-0 text-[10px] font-normal">Avoid {name}</Badge>
              {/each}
            </div>
          {/if}
          {#if row.countLabel || row.notes}
            <p class="{hint} mt-1 text-muted-foreground">
              {#if row.countLabel}{row.countLabel}{#if row.notes}. {/if}{/if}{row.notes}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
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
