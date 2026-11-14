<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    cloneInventoryItem,
    emptyInventoryItem,
    inventoryPayload,
    tagsFromText,
    tagsToText,
  } from '$lib/domain/inventory.js';

  type InventoryRow = {
    id: number;
    name: string;
    description: string;
    quantity: number;
    manufacturer: string;
    modelNumber: string;
    purchaseFrom: string;
    purchasePrice: number | null;
    purchaseDate: string;
    locationPath: string;
    tags: string[];
    archived: boolean;
    notes: string;
  };

  let {
    open = $bindable(false),
    item = null,
    creating = false,
    busy = false,
    error = '',
    onSave,
    onDelete,
  }: {
    open?: boolean;
    item?: InventoryRow | null;
    creating?: boolean;
    busy?: boolean;
    error?: string;
    onSave: (payload: Record<string, unknown>, id: number | null) => void;
    onDelete?: (id: number) => void;
  } = $props();

  // Initialized once per mount; parent remounts via {#key} when opening.
  const initial = creating || !item ? emptyInventoryItem() : cloneInventoryItem(item);
  let draft = $state(initial);
  let tagText = $state(tagsToText(initial.tags));
  let priceText = $state(
    initial.purchasePrice === null || initial.purchasePrice === undefined
      ? ''
      : String(initial.purchasePrice),
  );

  let title = $derived(creating ? 'Add item' : 'Edit item');

  function parsePrice(raw: string): number | null {
    const text = raw.trim();
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value)) return null;
    return value;
  }

  function submit(event: Event) {
    event.preventDefault();
    if (busy) return;
    const next = cloneInventoryItem(draft);
    next.tags = tagsFromText(tagText);
    next.purchasePrice = parsePrice(priceText);
    next.quantity = Number(draft.quantity);
    if (!Number.isFinite(next.quantity) || next.quantity < 0) next.quantity = 0;
    const payload = inventoryPayload(next);
    onSave(payload, creating ? null : draft.id);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>
        {creating ? 'Add a supply to this garden inventory.' : 'Update this inventory item.'}
      </Dialog.Description>
    </Dialog.Header>
    <form class="flex flex-col gap-4" onsubmit={submit}>
      <Field.FieldGroup class="gap-3">
        <Field.Field>
          <Field.Label for="inventory-name">Name</Field.Label>
          <Input id="inventory-name" bind:value={draft.name} required autocomplete="off" />
        </Field.Field>
        <Field.Field>
          <Field.Label for="inventory-location">Location</Field.Label>
          <Input
            id="inventory-location"
            bind:value={draft.locationPath}
            placeholder="Outhouse / Almirah"
            autocomplete="off"
          />
        </Field.Field>
        <div class="grid grid-cols-2 gap-3">
          <Field.Field>
            <Field.Label for="inventory-quantity">Quantity</Field.Label>
            <Input
              id="inventory-quantity"
              type="number"
              min="0"
              step="any"
              bind:value={draft.quantity}
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="inventory-tags">Tags</Field.Label>
            <Input
              id="inventory-tags"
              bind:value={tagText}
              placeholder="Fertilizer, Seeds"
              autocomplete="off"
            />
            <Field.Description>Comma-separated</Field.Description>
          </Field.Field>
        </div>
        <Field.Field>
          <Field.Label for="inventory-description">Description</Field.Label>
          <Textarea id="inventory-description" bind:value={draft.description} rows={3} />
        </Field.Field>
        <div class="grid grid-cols-2 gap-3">
          <Field.Field>
            <Field.Label for="inventory-manufacturer">Manufacturer</Field.Label>
            <Input id="inventory-manufacturer" bind:value={draft.manufacturer} autocomplete="off" />
          </Field.Field>
          <Field.Field>
            <Field.Label for="inventory-model">Model</Field.Label>
            <Input id="inventory-model" bind:value={draft.modelNumber} autocomplete="off" />
          </Field.Field>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <Field.Field>
            <Field.Label for="inventory-from">Purchased from</Field.Label>
            <Input id="inventory-from" bind:value={draft.purchaseFrom} autocomplete="off" />
          </Field.Field>
          <Field.Field>
            <Field.Label for="inventory-price">Price</Field.Label>
            <Input id="inventory-price" bind:value={priceText} inputmode="decimal" autocomplete="off" />
          </Field.Field>
        </div>
        <Field.Field>
          <Field.Label for="inventory-date">Purchase date</Field.Label>
          <Input id="inventory-date" type="date" bind:value={draft.purchaseDate} />
        </Field.Field>
        <Field.Field>
          <Field.Label for="inventory-notes">Notes</Field.Label>
          <Textarea id="inventory-notes" bind:value={draft.notes} rows={2} />
        </Field.Field>
        <Field.Field orientation="horizontal" class="w-fit">
          <Checkbox
            id="inventory-archived"
            checked={draft.archived}
            onCheckedChange={(checked) => {
              draft.archived = checked === true;
            }}
          />
          <Field.Label for="inventory-archived" class="font-normal">Archived</Field.Label>
        </Field.Field>
      </Field.FieldGroup>
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}
      <Dialog.Footer class="gap-2 sm:justify-between">
        <div>
          {#if !creating && onDelete && draft.id}
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onclick={() => onDelete(draft.id)}
            >
              Delete
            </Button>
          {/if}
        </div>
        <div class="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onclick={() => (open = false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
