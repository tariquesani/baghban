<script lang="ts">
  import InventoryItemCard from '../components/inventory/InventoryItemCard.svelte';
  import InventoryItemDialog from '../components/inventory/InventoryItemDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import {
    createInventoryItem,
    deleteInventoryItem,
    listInventory,
    saveInventoryItem,
  } from '$lib/api/inventory.js';
  import { filterItems, filterTagNames } from '$lib/domain/inventory.js';
  import { cn } from '$lib/utils';
  import { toast } from 'svelte-sonner';

  type InventoryRow = {
    id: number;
    name: string;
    description: string;
    quantity: number;
    manufacturer: string;
    modelNumber: string;
    purchaseFrom: string;
    purchasePrice: number | null;
    purchaseDate: string | null;
    locationPath: string;
    tags: string[];
    archived: boolean;
    notes: string;
  };

  let items = $state.raw([] as InventoryRow[]);
  let selectedTags = $state([] as string[]);
  let ready = $state(false);
  let listError = $state('');
  let formOpen = $state(false);
  let formSession = $state(0);
  let creating = $state(false);
  let selected = $state.raw(null as InventoryRow | null);
  let busy = $state(false);
  let formError = $state('');
  let listTicket = 0;

  let tagChoices = $derived(filterTagNames(items));
  let visible = $derived(filterItems(items, selectedTags));

  const filterClass =
    'data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground data-[state=on]:hover:bg-primary/25 data-[state=on]:hover:text-foreground';

  function chooseTags(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      selectedTags = value;
      return;
    }
    selectedTags = value ? [value] : [];
  }

  async function loadList() {
    const ticket = ++listTicket;
    try {
      const rows = await listInventory();
      if (ticket !== listTicket) return;
      items = Array.isArray(rows) ? (rows as InventoryRow[]) : [];
      listError = '';
      ready = true;
    } catch (err) {
      if (ticket !== listTicket) return;
      listError = err instanceof Error ? err.message : 'Could not load inventory';
      ready = true;
    }
  }

  function startCreate() {
    creating = true;
    selected = null;
    formError = '';
    formSession += 1;
    formOpen = true;
  }

  function openItem(item: InventoryRow) {
    creating = false;
    selected = item;
    formError = '';
    formSession += 1;
    formOpen = true;
  }

  async function saveItem(payload: Record<string, unknown>, id: number | null) {
    if (busy) return;
    busy = true;
    formError = '';
    try {
      if (id === null) {
        await createInventoryItem(payload);
        toast.success('Item added');
      } else {
        await saveInventoryItem({ ...payload, id });
        toast.success('Item saved');
      }
      formOpen = false;
      await loadList();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Could not save item';
    } finally {
      busy = false;
    }
  }

  async function removeItem(id: number) {
    if (busy) return;
    const name = selected?.name?.trim() || 'this item';
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    busy = true;
    formError = '';
    try {
      await deleteInventoryItem(id);
      toast.success('Item deleted');
      formOpen = false;
      selected = null;
      await loadList();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Could not delete item';
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    let ignore = false;
    (async () => {
      try {
        const rows = await listInventory();
        if (ignore) return;
        items = Array.isArray(rows) ? (rows as InventoryRow[]) : [];
        listError = '';
      } catch (err) {
        if (ignore) return;
        listError = err instanceof Error ? err.message : 'Could not load inventory';
      } finally {
        if (!ignore) ready = true;
      }
    })();
    return () => {
      ignore = true;
    };
  });
</script>

<div class="inventory">
  <div class="toolbar">
    <Button onclick={startCreate}>Add item</Button>
  </div>

  {#if listError}
    <p class="error">{listError}</p>
  {/if}

  {#if ready && tagChoices.length > 0}
    <ToggleGroup.Root
      type="multiple"
      variant="outline"
      spacing={2}
      class="w-full flex-wrap"
      aria-label="Filter by tag"
      value={selectedTags}
      onValueChange={chooseTags}
    >
      {#each tagChoices as tag (tag)}
        <ToggleGroup.Item value={tag} class={cn(filterClass)}>{tag}</ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  {/if}

  {#if !ready}
    <p class="status">Loading inventory…</p>
  {:else if visible.length === 0}
    <p class="status">
      {items.length === 0 ? 'No inventory items yet.' : 'No items match the selected tags.'}
    </p>
  {:else}
    <div class="grid">
      {#each visible as item (item.id)}
        <InventoryItemCard {item} onclick={() => openItem(item)} />
      {/each}
    </div>
  {/if}
</div>

{#key formSession}
  <InventoryItemDialog
    bind:open={formOpen}
    item={selected}
    {creating}
    {busy}
    error={formError}
    onSave={saveItem}
    onDelete={removeItem}
  />
{/key}

<style>
  .inventory {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 24px 24px;
    color: #191d17;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  .status {
    margin: 0;
    color: #42493d;
  }

  .error {
    margin: 0;
    color: #8a1f11;
  }

  @media (max-width: 800px) {
    .inventory {
      padding: 8px 16px 24px;
    }
  }
</style>
