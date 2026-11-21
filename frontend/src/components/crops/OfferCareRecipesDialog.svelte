<script lang="ts">
  import { createCareRule } from '$lib/api/careRules.js';
  import {
    careRecipeTiming,
    careRecipeTitle,
    instantiateCareRecipes,
  } from '$lib/domain/careRecipe.js';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Field from '$lib/components/ui/field';
  import { ScrollArea } from '$lib/components/ui/scroll-area';

  type Recipe = {
    id?: number | null;
    localKey?: string;
    label?: string;
    action: string;
    product?: string;
    note?: string;
    freq?: string;
    offsetDays?: number;
    endsOffsetDays?: number | null;
    active?: boolean;
  };

  let {
    open = $bindable(false),
    cropName,
    recipes = [],
    plantDate,
    bedId,
    cropId,
  }: {
    open?: boolean;
    cropName: string;
    recipes: Recipe[];
    plantDate: string;
    bedId: number;
    cropId: number;
  } = $props();

  let selected = $state<Record<string, boolean>>({});
  let busy = $state(false);
  let error = $state('');

  function recipeKey(recipe: Recipe, index: number) {
    if (typeof recipe.id === 'number') return String(recipe.id);
    if (recipe.localKey) return recipe.localKey;
    return `idx-${index}`;
  }

  $effect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    recipes.forEach((recipe, index) => {
      next[recipeKey(recipe, index)] = true;
    });
    selected = next;
    error = '';
    busy = false;
  });

  const chosenCount = $derived(Object.values(selected).filter(Boolean).length);

  function close() {
    open = false;
    error = '';
    busy = false;
  }

  async function addSelected() {
    if (busy) return;
    const keys = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([key]) => key);
    if (keys.length === 0) {
      close();
      return;
    }
    busy = true;
    error = '';
    try {
      const bodies = instantiateCareRecipes(recipes, {
        plantDate,
        bedId,
        cropId,
        selectedIds: keys,
      });
      for (const body of bodies) {
        await createCareRule(body);
      }
      close();
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Could not add care schedules.';
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(next) => {
    if (!next) {
      error = '';
      busy = false;
    }
  }}
>
  <Dialog.Content class="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
    <Dialog.Header class="shrink-0 pr-8">
      <Dialog.Title>Add recommended care?</Dialog.Title>
      <Dialog.Description>
        Schedules for {cropName || 'this crop'}, dated from {plantDate}.
      </Dialog.Description>
    </Dialog.Header>

    <div class="recipe-list min-h-0 flex-auto">
      <ScrollArea class="h-full w-full">
        <Field.FieldGroup class="gap-3 pr-3">
          {#each recipes as recipe, index (recipeKey(recipe, index))}
            {@const key = recipeKey(recipe, index)}
            <Field.Field orientation="horizontal" class="items-start gap-3">
              <Checkbox
                id={`care-recipe-${key}`}
                checked={selected[key] === true}
                disabled={busy}
                onCheckedChange={(checked) => {
                  selected = { ...selected, [key]: checked === true };
                }}
              />
              <div class="min-w-0 flex-1">
                <Field.Label for={`care-recipe-${key}`} class="font-normal">
                  {careRecipeTitle(recipe)}
                </Field.Label>
                <p class="text-muted-foreground text-sm">{careRecipeTiming(recipe)}</p>
                {#if recipe.product || recipe.note}
                  <p class="text-muted-foreground text-sm">
                    {[recipe.product, recipe.note].filter(Boolean).join(' · ')}
                  </p>
                {/if}
              </div>
            </Field.Field>
          {/each}
          {#if error}<Field.Error>{error}</Field.Error>{/if}
        </Field.FieldGroup>
      </ScrollArea>
    </div>

    <Dialog.Footer class="shrink-0">
      <Button type="button" variant="outline" disabled={busy} onclick={close}>Skip</Button>
      <Button type="button" disabled={busy || chosenCount === 0} onclick={addSelected}>
        {busy ? 'Adding…' : `Add selected (${chosenCount})`}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .recipe-list :global([data-slot='scroll-area-viewport']) {
    height: auto;
    max-height: calc(85vh - 12rem);
  }
</style>
