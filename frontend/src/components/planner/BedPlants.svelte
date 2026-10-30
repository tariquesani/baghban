<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';
  import { listCrops } from '$lib/api/crops.js';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Command from '$lib/components/ui/command';
  import * as Field from '$lib/components/ui/field';
  import { control, hint, legend, section } from './inspector';
  import type { SelectionDetails } from './selection';

  type CropChoice = {
    id: number;
    name: string;
    emoji: string;
    aliases?: string[];
  };

  let { details }: { details: SelectionDetails } = $props();

  let crops = $state.raw<CropChoice[]>([]);
  let cropsError = $state('');

  function labelOf(crop: CropChoice) {
    return crop.emoji ? `${crop.emoji} ${crop.name}` : crop.name;
  }

  const available = $derived.by(() => {
    const planted = details.plants;
    return crops.filter((crop) => {
      const label = labelOf(crop);
      return !planted.some((plant) => plant === label || plant === crop.name);
    });
  });

  $effect(() => {
    let cancelled = false;
    cropsError = '';
    listCrops()
      .then((rows: CropChoice[]) => {
        if (!cancelled) crops = Array.isArray(rows) ? rows : [];
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        cropsError = err instanceof Error ? err.message : 'Could not load crops';
      });
    return () => {
      cancelled = true;
    };
  });

  function matchCrop(value: string, search: string, keywords: string[] = []) {
    const query = search.trim().toLowerCase();
    if (!query) return 1;
    const haystack = [value, ...keywords].join(' ').toLowerCase();
    return haystack.includes(query) ? 1 : 0;
  }

  function add(crop: CropChoice) {
    const addPlant = (globalThis as { addPlant?: (name: string) => void }).addPlant;
    addPlant?.(labelOf(crop));
  }

  function remove(name: string) {
    const removePlant = (globalThis as { removePlant?: (name: string) => void }).removePlant;
    removePlant?.(name);
  }
</script>

<Field.FieldSet class="{section} m-0 min-w-0 gap-1.5 border-x-0 border-t-0">
  <Field.FieldLegend class="{legend} mb-0">Plants</Field.FieldLegend>
  {#if details.plants.length}
    <div class="flex flex-wrap gap-1">
      {#each details.plants as name (name)}
        <Badge variant="secondary" class="h-auto gap-0.5 px-1.5 py-0.5 text-[10px]">
          {name}
          <Button type="button" variant="ghost" size="icon-xs" class="size-4" aria-label={`Remove ${name}`} onclick={() => remove(name)}>
            <XIcon />
          </Button>
        </Badge>
      {/each}
    </div>
  {/if}
  {#if cropsError}
    <Field.Error class={hint}>{cropsError}</Field.Error>
  {/if}
  {#if details.plantWarn}
    <Field.Error class={hint}>{details.plantWarn}</Field.Error>
  {/if}
  <Command.Root class="h-auto rounded-md border" filter={matchCrop}>
    <Command.Input class={control} placeholder="Search crops" />
    <Command.List class="max-h-40">
      <Command.Empty class="py-3 text-xs">
        {crops.length === 0 ? 'No crops yet.' : 'No crops match.'}
      </Command.Empty>
      <Command.Group>
        {#each available as crop (crop.id)}
          <Command.Item
            class="px-2 py-1 text-xs"
            value={crop.name}
            keywords={crop.aliases ?? []}
            onSelect={() => add(crop)}
          >
            {#if crop.emoji}<span aria-hidden="true">{crop.emoji}</span>{/if}
            {crop.name}
          </Command.Item>
        {/each}
      </Command.Group>
    </Command.List>
  </Command.Root>
</Field.FieldSet>
