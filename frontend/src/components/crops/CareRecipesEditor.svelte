<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';
  import { CARE_ACTIONS } from '$lib/domain/catalogue.js';
  import { WEEKDAYS } from '$lib/domain/careRule.js';
  import {
    RECIPE_FREQS,
    careRecipeTiming,
    careRecipeTitle,
    emptyCareRecipe,
  } from '$lib/domain/careRecipe.js';
  import { optionalNumber } from '$lib/domain/crop.js';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';

  type Recipe = ReturnType<typeof emptyCareRecipe> & { id?: number | null };

  let {
    recipes = $bindable([] as Recipe[]),
  }: {
    recipes: Recipe[];
  } = $props();

  let expandedKey = $state('');

  function rowKey(recipe: Recipe, index: number) {
    return recipe.localKey || (typeof recipe.id === 'number' ? `id-${recipe.id}` : `idx-${index}`);
  }

  function addRecipe() {
    const next = emptyCareRecipe();
    next.sort = recipes.length;
    recipes = [...recipes, next];
    expandedKey = next.localKey;
  }

  function removeRecipe(index: number) {
    const key = rowKey(recipes[index], index);
    recipes = recipes.filter((_, i) => i !== index);
    if (expandedKey === key) expandedKey = '';
  }

  function toggleWeekday(recipe: Recipe, day: number, on: boolean) {
    const set = new Set(recipe.weekdays || []);
    if (on) set.add(day);
    else set.delete(day);
    recipe.weekdays = [...set].sort((a, b) => a - b);
    recipes = [...recipes];
  }

  function setOffset(recipe: Recipe, text: string) {
    const value = optionalNumber(text);
    recipe.offsetDays = value == null ? 0 : Math.max(0, Math.trunc(value));
    recipes = [...recipes];
  }

  function setEndsOffset(recipe: Recipe, text: string) {
    const value = optionalNumber(text);
    recipe.endsOffsetDays = value == null ? null : Math.max(0, Math.trunc(value));
    recipes = [...recipes];
  }

  function setInterval(recipe: Recipe, text: string) {
    const value = optionalNumber(text);
    recipe.interval = value == null ? 1 : Math.max(1, Math.trunc(value));
    recipes = [...recipes];
  }
</script>

<Field.Set class="gap-3">
  <Field.Legend variant="label">Recommended care</Field.Legend>
  <Field.Description>
    Offered when this crop is added to a bed. Put dose rates in the note (for example 500 g per sq ft).
  </Field.Description>

  {#if recipes.length === 0}
    <p class="text-muted-foreground text-sm">No care recipes yet.</p>
  {/if}

  <div class="flex flex-col gap-3">
    {#each recipes as recipe, index (rowKey(recipe, index))}
      {@const key = rowKey(recipe, index)}
      {@const open = expandedKey === key}
      <div class="rounded-md border p-3">
        <div class="flex items-start gap-2">
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            onclick={() => {
              expandedKey = open ? '' : key;
            }}
          >
            <div class="font-medium">{careRecipeTitle(recipe) || 'Untitled care'}</div>
            <div class="text-muted-foreground text-sm">
              {recipe.action ? careRecipeTiming(recipe) : 'Choose an action'}
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove care recipe"
            onclick={() => removeRecipe(index)}
          >
            <TrashIcon />
          </Button>
        </div>

        {#if open}
          <div class="mt-3 grid gap-3">
            <Field.Field>
              <Field.Label for={`recipe-label-${key}`}>Label</Field.Label>
              <Input id={`recipe-label-${key}`} bind:value={recipe.label} placeholder="First compost" />
            </Field.Field>

            <Field.Field>
              <Field.Label for={`recipe-action-${key}`}>Action</Field.Label>
              <Select.Root type="single" bind:value={recipe.action}>
                <Select.Trigger id={`recipe-action-${key}`} class="w-full">
                  <Select.Value placeholder="Choose action" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each CARE_ACTIONS as choice (choice.value)}
                      <Select.Item value={choice.value} label={choice.label}>{choice.label}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Field.Field>

            <div class="grid grid-cols-2 gap-3">
              <Field.Field>
                <Field.Label for={`recipe-freq-${key}`}>Repeat</Field.Label>
                <Select.Root
                  type="single"
                  value={recipe.freq}
                  onValueChange={(value) => {
                    if (typeof value !== 'string') return;
                    recipe.freq = value;
                    if (value !== 'weekly') recipe.weekdays = [];
                    if (value === 'once' || value === 'yearly') recipe.interval = 1;
                    recipes = [...recipes];
                  }}
                >
                  <Select.Trigger id={`recipe-freq-${key}`} class="w-full">
                    <Select.Value placeholder="Once" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Group>
                      {#each RECIPE_FREQS as choice (choice.value)}
                        <Select.Item value={choice.value} label={choice.label}>{choice.label}</Select.Item>
                      {/each}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Field.Field>
              <Field.Field>
                <Field.Label for={`recipe-offset-${key}`}>Start (days after plant)</Field.Label>
                <Input
                  id={`recipe-offset-${key}`}
                  type="number"
                  min="0"
                  step="1"
                  value={recipe.offsetDays ?? 0}
                  oninput={(event) => setOffset(recipe, (event.currentTarget as HTMLInputElement).value)}
                />
              </Field.Field>
            </div>

            {#if recipe.freq === 'daily'}
              <Field.Field>
                <Field.Label for={`recipe-interval-${key}`}>Every N days</Field.Label>
                <Input
                  id={`recipe-interval-${key}`}
                  type="number"
                  min="1"
                  step="1"
                  value={recipe.interval ?? 1}
                  oninput={(event) => setInterval(recipe, (event.currentTarget as HTMLInputElement).value)}
                />
              </Field.Field>
            {/if}

            {#if recipe.freq === 'weekly'}
              <Field.Field>
                <Field.Label for={`recipe-weekly-interval-${key}`}>Week interval</Field.Label>
                <Select.Root
                  type="single"
                  value={String(recipe.interval || 1)}
                  onValueChange={(value) => {
                    if (typeof value !== 'string') return;
                    recipe.interval = Number(value) || 1;
                    recipes = [...recipes];
                  }}
                >
                  <Select.Trigger id={`recipe-weekly-interval-${key}`} class="w-full">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Group>
                      <Select.Item value="1" label="Every week">Every week</Select.Item>
                      <Select.Item value="2" label="Every 2nd week">Every 2nd week</Select.Item>
                      <Select.Item value="3" label="Every 3rd week">Every 3rd week</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Field.Field>
              <Field.Field>
                <Field.Label>Weekdays</Field.Label>
                <div class="flex flex-wrap gap-3">
                  {#each WEEKDAYS as day (day.value)}
                    <Field.Field orientation="horizontal" class="w-fit">
                      <Checkbox
                        id={`recipe-day-${key}-${day.value}`}
                        checked={(recipe.weekdays || []).includes(day.value)}
                        onCheckedChange={(checked) => toggleWeekday(recipe, day.value, checked === true)}
                      />
                      <Field.Label for={`recipe-day-${key}-${day.value}`} class="font-normal">
                        {day.label}
                      </Field.Label>
                    </Field.Field>
                  {/each}
                </div>
              </Field.Field>
            {/if}

            {#if recipe.freq !== 'once'}
              <Field.Field>
                <Field.Label for={`recipe-ends-${key}`}>End (days after plant)</Field.Label>
                <Input
                  id={`recipe-ends-${key}`}
                  type="number"
                  min="0"
                  step="1"
                  value={recipe.endsOffsetDays ?? ''}
                  placeholder="Leave blank for open-ended"
                  oninput={(event) => setEndsOffset(recipe, (event.currentTarget as HTMLInputElement).value)}
                />
              </Field.Field>
            {/if}

            <Field.Field>
              <Field.Label for={`recipe-product-${key}`}>Product</Field.Label>
              <Input id={`recipe-product-${key}`} bind:value={recipe.product} placeholder="Compost" />
            </Field.Field>

            <Field.Field>
              <Field.Label for={`recipe-note-${key}`}>Note</Field.Label>
              <Textarea
                id={`recipe-note-${key}`}
                rows={2}
                bind:value={recipe.note}
                placeholder="500 g per sq ft around plants"
              />
            </Field.Field>

            <Field.Field orientation="horizontal" class="w-fit">
              <Checkbox
                id={`recipe-active-${key}`}
                checked={recipe.active !== false}
                onCheckedChange={(checked) => {
                  recipe.active = checked === true;
                  recipes = [...recipes];
                }}
              />
              <Field.Label for={`recipe-active-${key}`} class="font-normal">Offer when planting</Field.Label>
            </Field.Field>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <Button type="button" variant="outline" class="w-fit" onclick={addRecipe}>
    <PlusIcon />
    Add care recipe
  </Button>
</Field.Set>
