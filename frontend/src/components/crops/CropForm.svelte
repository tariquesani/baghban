<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';
  import { tick } from 'svelte';
  import { cropIconUrl } from '$lib/api/crops.js';
  import { CROP_CATEGORIES, SUNS, WATERS, optionalNumber } from '$lib/domain/crop.js';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import * as InputGroup from '$lib/components/ui/input-group';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import CropChoiceField from './CropChoiceField.svelte';

  type CropDraft = {
    id: number | '';
    name: string;
    category: string;
    emoji: string;
    icon: string;
    sqft: number | null;
    spacing: number | null;
    depthIn: number | null;
    sowingDepthMm: number | null;
    daysToMaturity: number | null;
    sun: string;
    water: string;
    trellis: boolean;
    notes: string;
    archived: boolean;
    aliases: string[];
    companions: number[];
    avoid: number[];
  };

  type NumberKey = 'sqft' | 'spacing' | 'depthIn' | 'sowingDepthMm' | 'daysToMaturity';

  let {
    draft = $bindable(),
    creating,
    choices,
    busy,
    error,
    narrow,
    aliasText = $bindable(''),
    companionQuery = $bindable(''),
    avoidQuery = $bindable(''),
    onSave,
    onArchive,
    onRestore,
    onBack,
    onIcon,
    onClearIcon,
    iconVersion,
  }: {
    draft: CropDraft;
    creating: boolean;
    choices: Array<{ id: number; name: string; emoji: string; icon: string; aliases: string[] }>;
    busy: boolean;
    error: string;
    narrow: boolean;
    aliasText: string;
    companionQuery: string;
    avoidQuery: string;
    onSave: () => void;
    onArchive: () => void;
    onRestore: () => void;
    onBack: () => void;
    onIcon: (file: File) => void;
    onClearIcon: () => void;
    iconVersion: number;
  } = $props();

  let aliasError = $state('');
  let nameField = $state<HTMLDivElement | null>(null);
  let nameInput = $state<HTMLInputElement | null>(null);
  let categoryField = $state<HTMLDivElement | null>(null);
  let categoryTrigger = $state<HTMLElement | null>(null);
  let formAlert = $state<HTMLParagraphElement | null>(null);

  function scrollFormTo(target: HTMLElement) {
    const scroller = target.closest('form');
    if (!(scroller instanceof HTMLElement)) return;
    const fieldRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const padding = 16;
    if (fieldRect.top < scrollerRect.top + padding) {
      scroller.scrollTop -= scrollerRect.top + padding - fieldRect.top;
    } else if (fieldRect.bottom > scrollerRect.bottom - padding) {
      scroller.scrollTop += fieldRect.bottom - (scrollerRect.bottom - padding);
    }
  }

  function revealError() {
    if (nameMissing && nameField && nameInput) {
      scrollFormTo(nameField);
      nameInput.focus({ preventScroll: true });
      return;
    }
    if (categoryMissing && categoryField && categoryTrigger) {
      scrollFormTo(categoryField);
      categoryTrigger.focus({ preventScroll: true });
      return;
    }
    if (formError && formAlert) scrollFormTo(formAlert);
  }

  const categoryItems = CROP_CATEGORIES.map((name: string) => ({ value: name, label: name }));
  const nameMissing = $derived(error === 'A crop needs a name');
  const categoryMissing = $derived(error === 'A crop needs a category');
  const formError = $derived(error && !nameMissing && !categoryMissing ? error : '');

  function addAlias() {
    const alias = aliasText.trim();
    if (!alias) return;
    const folded = alias.toLowerCase();
    if (folded === draft.name.trim().toLowerCase()) {
      aliasError = 'An alias cannot match the crop name';
      return;
    }
    if (draft.aliases.some((item) => item.toLowerCase() === folded)) {
      aliasError = 'That alias is already on this crop';
      return;
    }
    draft.aliases = [...draft.aliases, alias];
    aliasText = '';
    aliasError = '';
  }

  function removeAlias(alias: string) {
    draft.aliases = draft.aliases.filter((item) => item !== alias);
  }

  function setNumber(key: NumberKey, text: string) {
    draft[key] = optionalNumber(text);
  }

  function addCompanion(id: number) {
    draft.companions = [...draft.companions, id];
    companionQuery = '';
  }

  function removeCompanion(id: number) {
    draft.companions = draft.companions.filter((item) => item !== id);
  }

  function addAvoid(id: number) {
    draft.avoid = [...draft.avoid, id];
    avoidQuery = '';
  }

  function removeAvoid(id: number) {
    draft.avoid = draft.avoid.filter((item) => item !== id);
  }

  function chooseIcon(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const file = input.files[0];
    input.value = '';
    onIcon(file);
  }

  function typedValue(event: Event) {
    const target = event.currentTarget;
    return target instanceof HTMLInputElement ? target.value : '';
  }
</script>

{#snippet numberField(id: string, label: string, name: string, key: NumberKey, step: string)}
  <Field.Field>
    <Field.Label for={id}>{label}</Field.Label>
    <Input
      {id}
      {name}
      type="number"
      min="0"
      {step}
      value={draft[key] ?? ''}
      oninput={(event) => setNumber(key, typedValue(event))}
    />
  </Field.Field>
{/snippet}

<Card.Root class="h-full min-h-0 min-w-0">
<form
  class="flex min-h-0 flex-1 flex-col gap-(--card-spacing) overflow-auto"
  aria-busy={busy}
  onsubmit={async (event) => {
    event.preventDefault();
    const pending = onSave();
    await tick();
    revealError();
    await pending;
    await tick();
    revealError();
  }}
>
  <Card.Header>
    {#if narrow}
      <Button type="button" variant="link" class="w-fit px-0" onclick={onBack}>Back</Button>
    {/if}
    <Card.Title>{creating ? 'New crop' : draft.name || 'Crop'}</Card.Title>
  </Card.Header>

  <Card.Content>
  <Field.Group class="gap-4">
    <Field.Field bind:ref={nameField} data-invalid={nameMissing || undefined}>
      <Field.Label for="crop-name">Display name</Field.Label>
      <Input
        id="crop-name"
        name="name"
        bind:ref={nameInput}
        bind:value={draft.name}
        aria-invalid={nameMissing || undefined}
      />
      {#if nameMissing}<Field.Error>{error}</Field.Error>{/if}
    </Field.Field>

    <Field.Field bind:ref={categoryField} data-invalid={categoryMissing || undefined}>
      <Field.Label for="crop-category">Category</Field.Label>
      <Select.Root type="single" name="category" items={categoryItems} bind:value={draft.category}>
        <Select.Trigger
          id="crop-category"
          class="w-full"
          bind:ref={categoryTrigger}
          aria-invalid={categoryMissing || undefined}
        >
          <Select.Value placeholder="Choose a category" />
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each categoryItems as item (item.value)}
              <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
      {#if categoryMissing}<Field.Error>{error}</Field.Error>{/if}
    </Field.Field>

    <Field.Field>
      <Field.Label for="crop-emoji">Emoji</Field.Label>
      <Input id="crop-emoji" name="emoji" bind:value={draft.emoji} />
    </Field.Field>

    <Field.Field>
      <Field.Label for="crop-icon">Icon</Field.Label>
      {#if creating}
        <Field.Description>Save the crop, then add a PNG icon.</Field.Description>
      {:else}
        <div class="flex items-center gap-3">
          {#if draft.icon && typeof draft.id === 'number'}
            <img
              alt=""
              class="size-10 shrink-0 object-contain"
              src="{cropIconUrl(draft.id)}?v={iconVersion}"
            />
          {/if}
          <Input
            id="crop-icon"
            type="file"
            accept="image/png"
            disabled={busy}
            onchange={chooseIcon}
          />
        </div>
        {#if draft.icon}
          <Button type="button" variant="outline" size="sm" class="w-fit" disabled={busy} onclick={onClearIcon}>
            Remove icon
          </Button>
        {/if}
      {/if}
    </Field.Field>

    <Field.Set class="gap-3">
      <Field.Legend variant="label">Aliases</Field.Legend>
      <Field.Description>Extra names used only when searching.</Field.Description>
      {#if draft.aliases.length}
        <div class="flex flex-wrap gap-2">
          {#each draft.aliases as alias (alias)}
            <Badge variant="secondary">
              {alias}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${alias}`}
                onclick={() => removeAlias(alias)}
              >
                <XIcon />
              </Button>
            </Badge>
          {/each}
        </div>
      {/if}
      <Field.Field data-invalid={aliasError ? true : undefined}>
        <Field.Label for="crop-alias" class="sr-only">New alias</Field.Label>
        <InputGroup.Root>
          <InputGroup.Input
            id="crop-alias"
            name="alias"
            placeholder="Dhaniya"
            bind:value={aliasText}
            aria-invalid={aliasError ? true : undefined}
            oninput={() => {
              aliasError = '';
            }}
            onkeydown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addAlias();
            }}
          />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button type="button" onclick={addAlias}>Add alias</InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
        {#if aliasError}<Field.Error>{aliasError}</Field.Error>{/if}
      </Field.Field>
    </Field.Set>

    <div class="grid grid-cols-2 gap-3">
      {@render numberField('crop-sqft', 'Square feet', 'sqft', 'sqft', 'any')}
      {@render numberField('crop-spacing', 'Spacing (inches)', 'spacing', 'spacing', 'any')}
      {@render numberField('crop-depth', 'Soil depth (inches)', 'depth', 'depthIn', 'any')}
    </div>

    <div class="grid grid-cols-2 gap-3">
      <Field.Field>
        <Field.Label for="crop-sun">Sun</Field.Label>
        <Select.Root type="single" name="sun" items={SUNS} bind:value={draft.sun}>
          <Select.Trigger id="crop-sun" class="w-full">
            <Select.Value placeholder="Not set" />
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each SUNS as choice (choice.value)}
                <Select.Item value={choice.value} label={choice.label}>{choice.label}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="crop-water">Water</Field.Label>
        <Select.Root type="single" name="water" items={WATERS} bind:value={draft.water}>
          <Select.Trigger id="crop-water" class="w-full">
            <Select.Value placeholder="Not set" />
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each WATERS as choice (choice.value)}
                <Select.Item value={choice.value} label={choice.label}>{choice.label}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Field.Field>
    </div>

    <Field.Field orientation="horizontal" class="w-fit">
      <Checkbox
        id="crop-trellis"
        checked={draft.trellis}
        onCheckedChange={(checked) => {
          draft.trellis = checked === true;
        }}
      />
      <Field.Label for="crop-trellis" class="font-normal">Needs a trellis</Field.Label>
    </Field.Field>

    <div class="grid grid-cols-2 gap-3">
      {@render numberField('crop-sowing', 'Sowing depth (mm)', 'sowing-depth', 'sowingDepthMm', 'any')}
      {@render numberField('crop-days', 'Days to maturity', 'days', 'daysToMaturity', '1')}
    </div>

    <Field.Field>
      <Field.Label for="crop-notes">Notes</Field.Label>
      <Textarea id="crop-notes" name="notes" rows={4} bind:value={draft.notes} />
    </Field.Field>

    <CropChoiceField
      label="Companions"
      {choices}
      selfId={draft.id}
      selected={draft.companions}
      blocked={draft.avoid}
      onAdd={addCompanion}
      onRemove={removeCompanion}
    />

    <CropChoiceField
      label="Plants to avoid"
      {choices}
      selfId={draft.id}
      selected={draft.avoid}
      blocked={draft.companions}
      onAdd={addAvoid}
      onRemove={removeAvoid}
    />

    {#if formError}<p bind:this={formAlert} class="text-sm text-destructive" role="alert">{formError}</p>{/if}
  </Field.Group>
  </Card.Content>

  <Card.Footer class="justify-between gap-3">
    {#if !creating && draft.archived}
      <Button type="button" variant="outline" disabled={busy} onclick={onRestore}>Restore</Button>
    {:else if !creating}
      <Button type="button" variant="destructive" disabled={busy} onclick={onArchive}>Archive</Button>
    {:else}
      <span></span>
    {/if}
    <Button type="submit" disabled={busy}>Save</Button>
  </Card.Footer>
</form>
</Card.Root>
