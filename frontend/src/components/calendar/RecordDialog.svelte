<script lang="ts">
  import { parseDate, type DateValue } from '@internationalized/date';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { tick } from 'svelte';
  import { listBeds } from '$lib/api/beds.js';
  import { createCalendarEntry, removePhoto, storePhoto, updateCalendarEntry } from '$lib/api/calendar.js';
  import { createCareRule } from '$lib/api/careRules.js';
  import { listCrops } from '$lib/api/crops.js';
  import { readGarden } from '$lib/api/garden.js';
  import BedField from '../beds/BedField.svelte';
  import CropMark from '../crops/CropMark.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Calendar } from '$lib/components/ui/calendar';
  import * as Command from '$lib/components/ui/command';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    careRuleRequest,
    REPEAT_CHOICES,
    WEEKDAYS,
    WEEKLY_INTERVALS,
  } from '$lib/domain/careRule.js';
  import { storedEntryId, type CalendarEntry } from '$lib/domain/calendar.js';
  import { calendarPhotoId } from '$lib/domain/photoId.js';
  import {
    CARE_ACTIONS,
    calendarRecord,
    entryCopy,
    entryDraft,
    entryRequest,
    formFields,
    isEntryKind,
  } from '$lib/domain/entryForm.js';
  import { cn } from '$lib/utils.js';
  import {
    formatSowingDate,
    localDate,
    bedsHoldingCrop,
    bedsWithCrops,
    cropsForNames,
    matchingCropName,
    photoProblem,
    sowingBedChoices,
    sowingCropChoices,
    statusForSowingDate,
  } from '$lib/domain/sowing.js';

  type EntryKind = 'sowing' | 'care' | 'pest' | 'harvest' | 'diary';

  let {
    open = $bindable(false),
    kind = 'sowing',
    addSession,
    editSession,
    entry = null,
    selectedDate,
    selectedCrop,
    lockedBedId = null,
    lockedBedName = '',
    cropNames = null,
    onSaved,
    onScheduleSaved = () => {},
  }: {
    open?: boolean;
    kind?: string;
    addSession: number;
    editSession: number;
    entry?: CalendarEntry | null;
    selectedDate: string;
    selectedCrop: string;
    lockedBedId?: number | null;
    lockedBedName?: string;
    cropNames?: string[] | null;
    onSaved: (entry: CalendarEntry) => void;
    onScheduleSaved?: () => void;
  } = $props();

  const statusItems = [
    { value: 'done', label: 'Done' },
    { value: 'planned', label: 'Planned' },
  ];

  let recording = $state<EntryKind>('sowing');
  let date = $state('');
  let dateValue = $state<DateValue | undefined>();
  let pickerMonth = $state<DateValue | undefined>();
  let pickerOpen = $state(false);
  let cropOpen = $state(false);
  let cropQuery = $state('');
  let cropTrigger = $state<HTMLButtonElement | null>(null);
  let crop = $state('');
  let status = $state<'planned' | 'done'>('done');
  let bedId = $state('none');
  let note = $state('');
  let action = $state('');
  let problem = $state('');
  let product = $state('');
  let amount = $state('');
  let unit = $state('');
  let quantity = $state('');
  let weightGrams = $state('');
  let todayStamp = $state(localDate());
  let statusChosen = $state(false);
  let cropEdited = $state(false);
  let cropChoices = $state<{ id: number; name: string; emoji: string; icon: string; iconRev: number | null }[]>([]);
  let bedRows = $state<{ id: number; name: string; plants: string[] }[]>([]);
  let bedsLoaded = $state(false);
  let loading = $state(false);
  let busy = $state(false);
  let listError = $state('');
  let formError = $state('');
  let fieldError = $state('');
  let photoError = $state('');
  let photoFile = $state<File | null>(null);
  let previewUrl = $state('');
  let photoInput = $state<HTMLInputElement | null>(null);
  let keptPhotoUrl = $state('');
  let photoCleared = $state(false);
  let editingId = $state('');
  let editingRuleId = $state<number | null>(null);
  let repeat = $state('none');
  let repeatInterval = $state('3');
  let weeklyInterval = $state('1');
  let weekdays = $state<number[]>([]);
  let endsOn = $state('');
  let endsValue = $state<DateValue | undefined>();
  let endsPickerOpen = $state(false);
  let seenAdd = 0;
  let seenEdit = 0;

  const scheduling = $derived(recording === 'care' && editingRuleId === null);
  const repeating = $derived(scheduling && repeat !== 'none');

  const copy = $derived(entryCopy(recording));
  const offeredCrops = $derived(cropsForNames(cropChoices, cropNames));
  const cropItems = $derived(
    offeredCrops.map((choice) => ({
      value: choice.name,
      id: choice.id,
      icon: choice.icon,
      iconRev: choice.iconRev,
      emoji: choice.emoji,
    })),
  );
  const chosenCrop = $derived(cropItems.find((item) => item.value === crop));
  const bedChoices = $derived(sowingBedChoices(bedRows));
  const cropBeds = $derived(recording === 'care' || recording === 'pest' || recording === 'harvest');
  const offeredBeds = $derived(cropBeds ? bedsHoldingCrop(bedRows, crop) : bedChoices);
  const bedItems = $derived(
    lockedBedId != null
      ? [{ value: String(lockedBedId), label: lockedBedName || 'This bed' }]
      : cropBeds
        ? offeredBeds.map((choice) => ({ value: String(choice.id), label: choice.name }))
        : [
            { value: 'none', label: 'Not in a bed' },
            ...bedChoices.map((choice) => ({ value: String(choice.id), label: choice.name })),
          ],
  );
  const bedLocked = $derived(lockedBedId != null || (cropBeds && offeredBeds.length <= 1));

  function asKind(value: string): EntryKind {
    return isEntryKind(value) ? value : 'sowing';
  }

  function clearField(name: string) {
    if (fieldError !== name) return;
    fieldError = '';
    formError = '';
  }

  function chooseCrop(name: string) {
    crop = name;
    cropEdited = true;
    clearField('crop');
    cropOpen = false;
    cropQuery = '';
    tick().then(() => cropTrigger?.focus());
  }

  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    photoFile = null;
    photoError = '';
    if (photoInput) photoInput.value = '';
  }

  function dropPhoto() {
    if (photoFile) {
      clearPhoto();
      return;
    }
    photoCleared = true;
  }

  function choosePhoto(file: File | null) {
    clearPhoto();
    if (!file) return;
    const problemText = photoProblem(file);
    if (problemText) {
      photoError = problemText;
      return;
    }
    photoFile = file;
    previewUrl = URL.createObjectURL(file);
  }

  function changeDate(value: string) {
    date = value;
    if (!statusChosen) status = statusForSowingDate(value, todayStamp);
  }

  function pickDate(value: DateValue | undefined) {
    if (!value) return;
    changeDate(value.toString());
    pickerOpen = false;
    clearField('date');
  }

  function pickEndsOn(value: DateValue | undefined) {
    if (!value) return;
    endsOn = value.toString();
    endsValue = value;
    endsPickerOpen = false;
    clearField('endsOn');
  }

  function toggleWeekday(day: number) {
    weekdays = weekdays.includes(day)
      ? weekdays.filter((value) => value !== day)
      : [...weekdays, day].sort((a, b) => a - b);
    clearField('weekdays');
  }

  function resetRepeat() {
    repeat = 'none';
    repeatInterval = '3';
    weeklyInterval = '1';
    weekdays = [];
    endsOn = '';
    endsValue = undefined;
    endsPickerOpen = false;
  }

  function applyMeasures(fields: {
    action: string;
    problem: string;
    product: string;
    amount: string;
    unit: string;
    quantity: string;
    weightGrams: string;
  }) {
    action = fields.action;
    problem = fields.problem;
    product = fields.product;
    amount = fields.amount;
    unit = fields.unit;
    quantity = fields.quantity;
    weightGrams = fields.weightGrams;
  }

  function applyAdd(nextKind: string) {
    const today = localDate();
    recording = asKind(nextKind);
    const draft = entryDraft(recording, { date: selectedDate, crop: '', today, crops: [] });
    editingId = '';
    editingRuleId = null;
    date = draft.date;
    dateValue = parseDate(draft.date);
    pickerMonth = dateValue;
    pickerOpen = false;
    cropOpen = false;
    cropQuery = '';
    crop = '';
    cropEdited = false;
    status = draft.status;
    statusChosen = recording === 'diary';
    bedId = lockedBedId != null ? String(lockedBedId) : draft.bedId;
    note = '';
    applyMeasures(draft);
    todayStamp = today;
    keptPhotoUrl = '';
    photoCleared = false;
    formError = '';
    fieldError = '';
    listError = '';
    resetRepeat();
    clearPhoto();
  }

  function applyEdit() {
    const source = entry;
    if (!source || !isEntryKind(source.kind) || storedEntryId(source.id) === null) {
      applyAdd(kind);
      return;
    }
    const today = localDate();
    recording = source.kind;
    editingId = source.id;
    editingRuleId = typeof source.ruleId === 'number' ? source.ruleId : null;
    date = source.date;
    dateValue = parseDate(source.date);
    pickerMonth = dateValue;
    pickerOpen = false;
    cropOpen = false;
    cropQuery = '';
    crop = source.crop;
    cropEdited = true;
    status = recording === 'diary' ? 'done' : source.status;
    statusChosen = true;
    bedId = typeof source.bedId === 'number' ? String(source.bedId) : 'none';
    note = source.note ?? '';
    applyMeasures(formFields(source));
    todayStamp = today;
    keptPhotoUrl = source.photoUrl ?? '';
    photoCleared = false;
    formError = '';
    fieldError = '';
    listError = '';
    resetRepeat();
    clearPhoto();
  }

  $effect.pre(() => {
    const add = addSession;
    const edit = editSession;
    const nextKind = kind;
    if (add === seenAdd && edit === seenEdit) return;
    const fromAdd = add !== seenAdd;
    seenAdd = add;
    seenEdit = edit;
    if (add === 0 && edit === 0) return;
    if (fromAdd) applyAdd(nextKind);
    else applyEdit();
  });

  $effect(() => {
    const match = matchingCropName(offeredCrops, selectedCrop);
    if (!open || cropEdited || crop || !match) return;
    crop = match;
  });

  $effect(() => {
    if (lockedBedId != null) {
      const next = String(lockedBedId);
      if (next !== bedId) bedId = next;
      return;
    }
    if (!bedsLoaded || !cropBeds) return;
    const next = offeredBeds.length === 1
      ? String(offeredBeds[0].id)
      : offeredBeds.some((bed) => String(bed.id) === bedId)
        ? bedId
        : offeredBeds.length === 0
          ? 'none'
          : '';
    if (next !== bedId) bedId = next;
  });

  $effect(() => {
    if (!open) return;
    let cancel = false;
    loading = true;
    bedsLoaded = false;
    listError = '';
    Promise.all([listCrops(), listBeds(), readGarden().catch(() => null)])
      .then(([cropRows, listed, plan]) => {
        if (cancel) return;
        cropChoices = sowingCropChoices(cropRows);
        const planted = plan && typeof plan === 'object' && Array.isArray(plan.beds) ? plan.beds : [];
        bedRows = bedsWithCrops(listed, planted);
        bedsLoaded = true;
        loading = false;
      })
      .catch((error: unknown) => {
        if (cancel) return;
        listError = error instanceof Error ? error.message : 'Could not load crops and beds.';
        loading = false;
      });
    return () => {
      cancel = true;
    };
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (repeating) {
      const attachedId = storedEntryId(editingId);
      const schedule = careRuleRequest(
        {
          repeat,
          interval: repeat === 'weekly' ? weeklyInterval : repeatInterval,
          weekdays,
          endsOn,
          crop,
          date,
          bedId,
          note,
          action,
          product,
          amount,
          unit,
          entryId: attachedId,
        },
        offeredCrops,
        entryRequest,
      );
      if (!schedule.ok) {
        fieldError = schedule.field;
        formError = schedule.message;
        return;
      }
      fieldError = '';
      formError = '';
      busy = true;
      try {
        await createCareRule(schedule.body);
        onScheduleSaved();
        open = false;
      } catch (error: unknown) {
        formError = error instanceof Error ? error.message : 'Could not save the schedule.';
      } finally {
        busy = false;
      }
      return;
    }
    const request = entryRequest(
      recording,
      {
        crop,
        date,
        status,
        bedId,
        note,
        action,
        problem,
        product,
        amount,
        unit,
        quantity,
        weightGrams,
      },
      offeredCrops,
    );
    if (!request.ok) {
      fieldError = request.field;
      formError = request.message;
      return;
    }
    fieldError = '';
    formError = '';
    busy = true;
    let photoId = '';
    try {
      let photoUrl = photoCleared ? '' : keptPhotoUrl;
      if (photoFile) {
        photoId = calendarPhotoId(recording);
        const stored = await storePhoto(photoId, photoFile);
        photoUrl = stored && typeof stored.url === 'string' ? stored.url : '';
        if (!photoUrl) throw new Error('Could not store the photo.');
      }
      const saved = editingId
        ? await updateCalendarEntry(Number(editingId), {
            ...request.body,
            id: Number(editingId),
            photoUrl,
          })
        : await createCalendarEntry({ ...request.body, photoUrl });
      const bedName = bedChoices.find((choice) => String(choice.id) === bedId)?.name ?? '';
      onSaved(calendarRecord(saved, bedName));
      open = false;
    } catch (error: unknown) {
      if (photoId) {
        try {
          await removePhoto(photoId);
        } catch {
          // The entry was not stored, so the photo should not remain.
        }
      }
      formError = error instanceof Error ? error.message : copy.saveError;
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
    <Dialog.Header class="shrink-0 pr-8">
      <Dialog.Title>{editingId ? copy.editTitle : copy.addTitle}</Dialog.Title>
      <Dialog.Description>{copy.description}</Dialog.Description>
    </Dialog.Header>

    <form class="flex min-h-0 flex-auto flex-col gap-4" onsubmit={save}>
      <div class="fields min-h-0 flex-auto">
      <ScrollArea class="h-full w-full">
      <div class="grid gap-4">
      <Field.Field data-invalid={fieldError === 'crop' || undefined}>
        <Field.Label for="{recording}-crop">Crop</Field.Label>
        <Popover.Root
          bind:open={cropOpen}
          onOpenChange={(next) => {
            if (!next) cropQuery = '';
          }}
        >
          <Popover.Trigger bind:ref={cropTrigger}>
            {#snippet child({ props })}
              <Button
                {...props}
                id="{recording}-crop"
                type="button"
                variant="outline"
                class="w-full justify-between font-normal"
                role="combobox"
                aria-expanded={cropOpen}
                aria-invalid={fieldError === 'crop' || undefined}
              >
                <span class={cn('flex min-w-0 flex-1 items-center gap-2 text-left', !crop && 'text-muted-foreground')}>
                  {#if chosenCrop}
                    <CropMark id={chosenCrop.id} icon={chosenCrop.icon} iconRev={chosenCrop.iconRev} emoji={chosenCrop.emoji} />
                  {/if}
                  <span class="truncate">{crop || 'Choose a crop'}</span>
                </span>
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content class="w-(--bits-popover-anchor-width) gap-0 p-0" align="start">
            <Command.Root>
              <Command.Input placeholder="Search crops..." bind:value={cropQuery} />
              <Command.List>
                <Command.Empty>No crops found.</Command.Empty>
                <Command.Group>
                  {#each cropItems as item (item.value)}
                    <Command.Item
                      value={item.value}
                      data-checked={crop === item.value}
                      onSelect={() => chooseCrop(item.value)}
                    >
                      <CropMark id={item.id} icon={item.icon} iconRev={item.iconRev} emoji={item.emoji} />
                      {item.value}
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.List>
            </Command.Root>
          </Popover.Content>
        </Popover.Root>
        {#if fieldError === 'crop'}<Field.Error>{formError}</Field.Error>{/if}
      </Field.Field>

      <Field.Field data-invalid={fieldError === 'date' || undefined}>
        <Field.Label for="{recording}-date">Date</Field.Label>
        <Popover.Root bind:open={pickerOpen}>
          <Popover.Trigger id="{recording}-date">
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="outline"
                class="w-full justify-start font-normal"
                data-empty={!date}
                aria-invalid={fieldError === 'date' || undefined}
              >
                <CalendarIcon data-icon="inline-start" />
                {formatSowingDate(date) || 'Pick a date'}
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content class="w-auto p-0" align="start">
            <Calendar
              type="single"
              bind:value={dateValue}
              bind:placeholder={pickerMonth}
              captionLayout="dropdown"
              onValueChange={pickDate}
            />
          </Popover.Content>
        </Popover.Root>
        {#if fieldError === 'date'}<Field.Error>{formError}</Field.Error>{/if}
      </Field.Field>

      {#if recording !== 'diary' && !repeating}
        <Field.Field>
          <Field.Label for="{recording}-status">Status</Field.Label>
          <Select.Root
            type="single"
            name="status"
            items={statusItems}
            value={status}
            onValueChange={(value) => {
              if (value !== 'planned' && value !== 'done') return;
              status = value;
              statusChosen = true;
            }}
          >
            <Select.Trigger id="{recording}-status" class="w-full">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each statusItems as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Field.Field>
      {/if}

      <BedField
        id="{recording}-bed"
        items={bedItems}
        bind:value={bedId}
        disabled={bedLocked}
        emptyLabel={crop.trim() ? 'Not in a bed' : 'Choose a crop first'}
        hint={cropBeds ? '' : copy.bedHint}
      />

      {#if recording === 'care'}
        <Field.Field data-invalid={fieldError === 'action' || undefined}>
          <Field.Label for="{recording}-action">Action</Field.Label>
          <Select.Root
            type="single"
            name="action"
            items={CARE_ACTIONS}
            value={action}
            onValueChange={(value) => {
              action = value;
              clearField('action');
            }}
          >
            <Select.Trigger id="{recording}-action" class="w-full" aria-invalid={fieldError === 'action' || undefined}>
              <Select.Value placeholder="Choose an action" />
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each CARE_ACTIONS as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
          {#if fieldError === 'action'}<Field.Error>{formError}</Field.Error>{/if}
        </Field.Field>
        <Field.Field>
          <Field.Label for="{recording}-product">Product</Field.Label>
          <Input id="{recording}-product" class="w-full" bind:value={product} />
        </Field.Field>
        <Field.Field data-invalid={fieldError === 'amount' || undefined}>
          <Field.Label for="{recording}-amount">Amount</Field.Label>
          <Input id="{recording}-amount" class="w-full" inputmode="decimal" bind:value={amount} aria-invalid={fieldError === 'amount' || undefined} />
          {#if fieldError === 'amount'}<Field.Error>{formError}</Field.Error>{/if}
        </Field.Field>
        <Field.Field>
          <Field.Label for="{recording}-unit">Unit</Field.Label>
          <Input id="{recording}-unit" class="w-full" bind:value={unit} />
        </Field.Field>
        {#if scheduling}
          <Field.Field data-invalid={fieldError === 'repeat' || undefined}>
            <Field.Label for="{recording}-repeat">Repeat</Field.Label>
            <Select.Root
              type="single"
              name="repeat"
              items={REPEAT_CHOICES}
              value={repeat}
              onValueChange={(value) => {
                if (!value) return;
                repeat = value;
                clearField('repeat');
              }}
            >
              <Select.Trigger id="{recording}-repeat" class="w-full" aria-invalid={fieldError === 'repeat' || undefined}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each REPEAT_CHOICES as item (item.value)}
                    <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
            {#if fieldError === 'repeat'}<Field.Error>{formError}</Field.Error>{/if}
          </Field.Field>
          {#if repeat === 'daily'}
            <Field.Field data-invalid={fieldError === 'interval' || undefined}>
              <Field.Label for="{recording}-interval">Every N days</Field.Label>
              <Input
                id="{recording}-interval"
                class="w-full"
                inputmode="numeric"
                bind:value={repeatInterval}
                aria-invalid={fieldError === 'interval' || undefined}
              />
              {#if fieldError === 'interval'}<Field.Error>{formError}</Field.Error>{/if}
            </Field.Field>
          {/if}
          {#if repeat === 'weekly'}
            <Field.Field data-invalid={fieldError === 'interval' || undefined}>
              <Field.Label for="{recording}-weekly-interval">How often</Field.Label>
              <Select.Root
                type="single"
                name="weekly-interval"
                items={WEEKLY_INTERVALS}
                value={weeklyInterval}
                onValueChange={(value) => {
                  if (!value) return;
                  weeklyInterval = value;
                  clearField('interval');
                }}
              >
                <Select.Trigger id="{recording}-weekly-interval" class="w-full" aria-invalid={fieldError === 'interval' || undefined}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each WEEKLY_INTERVALS as item (item.value)}
                      <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              {#if fieldError === 'interval'}<Field.Error>{formError}</Field.Error>{/if}
            </Field.Field>
            <Field.Field data-invalid={fieldError === 'weekdays' || undefined}>
              <Field.Label>Weekdays</Field.Label>
              <div class="weekdays">
                {#each WEEKDAYS as day (day.value)}
                  <Button
                    type="button"
                    size="sm"
                    variant={weekdays.includes(day.value) ? 'default' : 'outline'}
                    aria-pressed={weekdays.includes(day.value)}
                    onclick={() => toggleWeekday(day.value)}
                  >
                    {day.label}
                  </Button>
                {/each}
              </div>
              {#if fieldError === 'weekdays'}<Field.Error>{formError}</Field.Error>{/if}
            </Field.Field>
          {/if}
          {#if repeating}
            <Field.Field data-invalid={fieldError === 'endsOn' || undefined}>
              <Field.Label for="{recording}-ends">Ends on (optional)</Field.Label>
              <Popover.Root bind:open={endsPickerOpen}>
                <Popover.Trigger id="{recording}-ends">
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      type="button"
                      variant="outline"
                      class="w-full justify-start font-normal"
                      data-empty={!endsOn}
                      aria-invalid={fieldError === 'endsOn' || undefined}
                    >
                      <CalendarIcon data-icon="inline-start" />
                      {formatSowingDate(endsOn) || 'No end date'}
                    </Button>
                  {/snippet}
                </Popover.Trigger>
                <Popover.Content class="w-auto p-0" align="start">
                  <Calendar
                    type="single"
                    bind:value={endsValue}
                    captionLayout="dropdown"
                    onValueChange={pickEndsOn}
                  />
                </Popover.Content>
              </Popover.Root>
              {#if endsOn}
                <Button type="button" variant="ghost" size="sm" onclick={() => { endsOn = ''; endsValue = undefined; }}>
                  Clear end date
                </Button>
              {/if}
              {#if fieldError === 'endsOn'}<Field.Error>{formError}</Field.Error>{/if}
            </Field.Field>
          {/if}
        {/if}
      {/if}

      {#if recording === 'pest'}
        <Field.Field>
          <Field.Label for="{recording}-problem">Problem</Field.Label>
          <Input id="{recording}-problem" class="w-full" bind:value={problem} />
        </Field.Field>
        <Field.Field>
          <Field.Label for="{recording}-product">Product</Field.Label>
          <Input id="{recording}-product" class="w-full" bind:value={product} />
        </Field.Field>
        <Field.Field data-invalid={fieldError === 'amount' || undefined}>
          <Field.Label for="{recording}-amount">Amount</Field.Label>
          <Input id="{recording}-amount" class="w-full" inputmode="decimal" bind:value={amount} aria-invalid={fieldError === 'amount' || undefined} />
          {#if fieldError === 'amount'}<Field.Error>{formError}</Field.Error>{/if}
        </Field.Field>
        <Field.Field>
          <Field.Label for="{recording}-unit">Unit</Field.Label>
          <Input id="{recording}-unit" class="w-full" bind:value={unit} />
        </Field.Field>
      {/if}

      {#if recording === 'harvest'}
        <Field.Field data-invalid={fieldError === 'quantity' || undefined}>
          <Field.Label for="{recording}-quantity">Count</Field.Label>
          <Input id="{recording}-quantity" class="w-full" inputmode="decimal" bind:value={quantity} aria-invalid={fieldError === 'quantity' || undefined} />
          {#if fieldError === 'quantity'}<Field.Error>{formError}</Field.Error>{/if}
        </Field.Field>
        <Field.Field>
          <Field.Label for="{recording}-unit">Unit</Field.Label>
          <Input id="{recording}-unit" class="w-full" bind:value={unit} />
        </Field.Field>
        <Field.Field data-invalid={fieldError === 'weight' || undefined}>
          <Field.Label for="{recording}-weight">Weight (g)</Field.Label>
          <Input id="{recording}-weight" class="w-full" inputmode="numeric" bind:value={weightGrams} aria-invalid={fieldError === 'weight' || undefined} />
          {#if fieldError === 'weight'}<Field.Error>{formError}</Field.Error>{/if}
        </Field.Field>
      {/if}

      <Field.Field>
        <Field.Label for="{recording}-note">Note</Field.Label>
        <Textarea id="{recording}-note" name="note" rows={3} bind:value={note} />
      </Field.Field>

      <Field.Field data-invalid={photoError ? true : undefined}>
        <Field.Label for="{recording}-photo">Photo</Field.Label>
        <input
          id="{recording}-photo"
          bind:this={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onchange={(event) => choosePhoto(event.currentTarget.files?.[0] ?? null)}
        />
        {#if previewUrl}
          <img class="photo" src={previewUrl} alt="" />
          <Button type="button" variant="outline" onclick={dropPhoto}>Remove photo</Button>
        {:else if keptPhotoUrl && !photoCleared}
          <img class="photo" src={keptPhotoUrl} alt="" />
          <Button type="button" variant="outline" onclick={dropPhoto}>Remove photo</Button>
        {/if}
        {#if photoError}<Field.Error>{photoError}</Field.Error>{/if}
      </Field.Field>

      {#if listError}<p class="form-error">{listError}</p>{/if}
      {#if formError && !fieldError}<p class="form-error">{formError}</p>{/if}
      </div>
      </ScrollArea>
      </div>

      <Dialog.Footer class="shrink-0">
        <Button type="button" variant="outline" disabled={busy} onclick={() => (open = false)}>Cancel</Button>
        <Button type="submit" disabled={busy || loading}>{busy ? 'Saving…' : 'Save'}</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  input[type='file'] {
    font: inherit;
  }

  .photo {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 160px;
    margin-top: 8px;
    align-self: flex-start;
    object-fit: contain;
    border-radius: 8px;
  }

  .form-error {
    margin: 0;
    color: #b42318;
  }

  .weekdays {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .fields :global([data-slot='scroll-area-viewport']) {
    height: auto;
    max-height: calc(85vh - 14rem);
  }
</style>
