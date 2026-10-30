<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import * as Item from '$lib/components/ui/item';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { CROP_CATEGORIES } from '$lib/domain/crop.js';
  import { cn } from '$lib/utils';

  let {
    crops,
    selectedId,
    query,
    category,
    showArchived,
    onQuery,
    onCategory,
    onShowArchived,
    onAdd,
    onSelect,
    ready,
  }: {
    crops: Array<{ id: number; name: string; category: string; emoji: string }>;
    selectedId: number | '';
    query: string;
    category: string;
    showArchived: boolean;
    onQuery: (value: string) => void;
    onCategory: (value: string) => void;
    onShowArchived: (value: boolean) => void;
    onAdd: () => void;
    onSelect: (crop: { id: number }) => void;
    ready: boolean;
  } = $props();

  const categoryChoice = $derived(category || 'all');
  const filterClass =
    'data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground data-[state=on]:hover:bg-primary/25 data-[state=on]:hover:text-foreground';

  function chooseCategory(value: string) {
    if (!value) return;
    onCategory(value === 'all' ? '' : value);
  }

  function searchValue(event: Event) {
    const target = event.currentTarget;
    return target instanceof HTMLInputElement ? target.value : '';
  }
</script>

<div class="list">
  <div class="flex flex-col gap-3">
    <Button class="w-fit" onclick={onAdd}>Add crop</Button>
    <Field.Field class="pr-3.5">
      <Field.Label for="crop-search">Search</Field.Label>
      <Input
        id="crop-search"
        type="search"
        value={query}
        placeholder="Name or alias"
        oninput={(event) => onQuery(searchValue(event))}
      />
    </Field.Field>
    <ToggleGroup.Root
      type="single"
      variant="outline"
      spacing={2}
      class="w-full flex-wrap"
      aria-label="Category"
      value={categoryChoice}
      onValueChange={chooseCategory}
    >
      <ToggleGroup.Item value="all" class={filterClass}>All</ToggleGroup.Item>
      {#each CROP_CATEGORIES as name (name)}
        <ToggleGroup.Item value={name} class={filterClass}>{name}</ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
    <Field.Field orientation="horizontal" class="w-fit">
      <Checkbox
        id="show-archived"
        checked={showArchived}
        onCheckedChange={(checked) => onShowArchived(checked === true)}
      />
      <Field.Label for="show-archived" class="font-normal">Show archived</Field.Label>
    </Field.Field>
  </div>

  {#if ready && crops.length === 0}
    <p class="empty">{showArchived ? 'No archived crops.' : 'No crops match.'}</p>
  {:else}
    <ScrollArea class="min-h-0 flex-1 overflow-hidden">
      <Item.Group class="pr-3.5">
        {#each crops as crop (crop.id)}
          <Item.Root size="sm">
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                class={cn(
                  props.class as string,
                  'cursor-pointer flex-nowrap text-left',
                  crop.id === selectedId
                    ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                    : 'hover:bg-muted',
                )}
                aria-current={crop.id === selectedId ? 'true' : undefined}
                onclick={() => onSelect(crop)}
              >
                {#if crop.emoji}
                  <Item.Media>
                    <span aria-hidden="true">{crop.emoji}</span>
                  </Item.Media>
                {/if}
                <Item.Content>
                  <Item.Title>{crop.name}</Item.Title>
                </Item.Content>
                <Item.Content class="items-end">
                  <Item.Description class={crop.id === selectedId ? 'text-primary-foreground' : undefined}>
                    {crop.category}
                  </Item.Description>
                </Item.Content>
              </button>
            {/snippet}
          </Item.Root>
        {/each}
      </Item.Group>
    </ScrollArea>
  {/if}
</div>

<style>
  .list {
    min-width: 0;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty {
    margin: 0;
    color: #42493d;
  }
</style>
