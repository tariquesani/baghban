<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { deleteCalendarEntry } from '$lib/api/calendar.js';
  import { deactivateCareRule } from '$lib/api/careRules.js';
  import { cropLabel, markTitle, storedEntryId, type CalendarEntry } from '$lib/domain/calendar.js';
  import { actionLabel } from '$lib/domain/entryForm.js';
  import { formatSowingDate } from '$lib/domain/sowing.js';

  let {
    entry = $bindable(null),
    onEdit,
    onDeleted,
    onScheduleStopped = () => {},
  }: {
    entry?: CalendarEntry | null;
    onEdit: (entry: CalendarEntry) => void;
    onDeleted: (id: string) => void;
    onScheduleStopped?: () => void;
  } = $props();

  let confirmOpen = $state(false);
  let busy = $state(false);
  let error = $state('');

  const stored = $derived(entry ? storedEntryId(entry.id) !== null : false);
  const editable = $derived(stored);
  const scheduleId = $derived(entry && typeof entry.ruleId === 'number' ? entry.ruleId : null);
  // Only an explicit false means stopped; null means the client has not learned yet.
  const scheduleStopped = $derived(scheduleId !== null && entry?.ruleActive === false);
  const scheduleLive = $derived(scheduleId !== null && !scheduleStopped);
  const heading = $derived(entry ? `${formatSowingDate(entry.date)} · ${cropLabel(entry.crop)}` : '');

  function closeEntry() {
    confirmOpen = false;
    error = '';
    entry = null;
  }

  function edit() {
    if (!entry) return;
    const current = entry;
    closeEntry();
    onEdit(current);
  }

  async function stopSchedule() {
    if (!entry || scheduleId === null || busy) return;
    busy = true;
    error = '';
    try {
      await deactivateCareRule(scheduleId);
      closeEntry();
      onScheduleStopped();
    } catch (cause: unknown) {
      error = cause instanceof Error ? cause.message : 'Could not stop the schedule.';
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!entry || busy) return;
    const id = storedEntryId(entry.id);
    if (id === null) return;
    const removedId = entry.id;
    busy = true;
    error = '';
    try {
      await deleteCalendarEntry(id);
      confirmOpen = false;
      entry = null;
      onDeleted(removedId);
    } catch (cause: unknown) {
      error = cause instanceof Error ? cause.message : 'Could not delete the entry.';
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root
  open={entry !== null}
  onOpenChange={(next) => {
    if (!next) closeEntry();
  }}
>
  <Dialog.Content class="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
    {#if entry}
      <Dialog.Header class="shrink-0 pr-8">
        <Dialog.Title>{markTitle(entry.kind)}</Dialog.Title>
        <Dialog.Description>
          {heading} · {entry.status === 'done' ? 'Done' : 'Planned'}
        </Dialog.Description>
      </Dialog.Header>
      <div class="fields min-h-0 flex-auto">
      <ScrollArea class="h-full w-full">
      <div class="flex flex-col gap-3">
        {#if entry.bed}<p>{entry.bed}</p>{/if}
        {#if entry.action}<p>{actionLabel(entry.action)}</p>{/if}
        {#if entry.problem}<p>{entry.problem}</p>{/if}
        {#if entry.product}<p>{entry.product}</p>{/if}
        {#if entry.detail}<p>{entry.detail}</p>{/if}
        {#if entry.note}<p>{entry.note}</p>{/if}
        {#if scheduleLive}<p class="schedule">Part of a repeating care schedule</p>{/if}
        {#if scheduleStopped}<p class="schedule">Schedule stopped</p>{/if}
        {#if entry.photoUrl}<img class="photo" src={entry.photoUrl} alt={cropLabel(entry.crop)} />{/if}
        {#if error}<p class="error">{error}</p>{/if}
      </div>
      </ScrollArea>
      </div>
      {#if stored}
        <Dialog.Footer class="shrink-0">
          {#if scheduleLive}
            <Button type="button" variant="outline" disabled={busy} onclick={stopSchedule}>
              Stop schedule
            </Button>
          {/if}
          {#if editable}
            <Button type="button" variant="outline" onclick={edit}>Edit</Button>
          {/if}
          <Button type="button" variant="destructive" onclick={() => (confirmOpen = true)}>Delete</Button>
        </Dialog.Footer>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={confirmOpen}>
  <AlertDialog.Content size="sm">
    <AlertDialog.Header>
      <AlertDialog.Title>Delete this {entry ? markTitle(entry.kind).toLowerCase() : 'entry'}?</AlertDialog.Title>
      <AlertDialog.Description>This removes it from the calendar.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action disabled={busy} onclick={remove}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<style>
  p {
    margin: 0;
  }

  .schedule {
    color: #5c6658;
    font-size: 0.9rem;
  }

  .photo {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 240px;
    align-self: center;
    object-fit: contain;
    border-radius: 8px;
  }

  .error {
    color: #b42318;
  }

  .fields :global([data-slot='scroll-area-viewport']) {
    height: auto;
    max-height: calc(85vh - 14rem);
  }
</style>
