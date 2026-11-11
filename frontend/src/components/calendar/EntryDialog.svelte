<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { deleteCalendarEntry } from '$lib/api/calendar.js';
  import { deactivateCareRule } from '$lib/api/careRules.js';
  import { cropLabel, formatDay, markTitle, storedEntryId, type CalendarEntry } from '$lib/domain/calendar.js';
  import { actionLabel, entryDetail } from '$lib/domain/entryForm.js';

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
  const statusLabel = $derived(entry?.status === 'planned' ? 'Planned' : 'Done');
  const facts = $derived.by(() => {
    if (!entry) return [];
    const rows: [string, string][] = [
      ['Crop', cropLabel(entry.crop)],
      ['Bed', (entry.bed || '').trim()],
      ['Action', actionLabel(entry.action || '')],
      ['Problem', (entry.problem || '').trim()],
      ['Product', (entry.product || '').trim()],
      ['Amount', entryDetail(entry)],
    ];
    return rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  });
  const hasBody = $derived(
    facts.length > 0 ||
      Boolean(entry?.note?.trim()) ||
      scheduleLive ||
      scheduleStopped,
  );

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
  <Dialog.Content class={['gap-4', entry?.photoUrl ? 'sm:max-w-3xl' : 'sm:max-w-lg']}>
    {#if entry}
      {#if entry.photoUrl}
        <div class="flex items-center justify-center">
          <img
            src={entry.photoUrl}
            alt={cropLabel(entry.crop) || markTitle(entry.kind)}
            class="max-h-[calc(100vh-16rem)] max-w-full object-contain"
          />
        </div>
      {/if}
      <Dialog.Header class="gap-1">
        <Dialog.Title class="flex flex-wrap items-center gap-2">
          <Badge>{formatDay(entry.date)} · {markTitle(entry.kind)}</Badge>
          <Badge variant="outline">{statusLabel}</Badge>
        </Dialog.Title>
        {#if hasBody}
          <Dialog.Description class="flex flex-col gap-1">
            {#if facts.length}
              <span class="flex flex-wrap items-baseline gap-x-8 gap-y-0.5">
                {#each facts as fact (fact.label)}
                  <span>
                    <span class="me-1 text-xs">{fact.label}</span>
                    <span class="text-foreground">{fact.value}</span>
                  </span>
                {/each}
              </span>
            {/if}
            {#if entry.note?.trim()}
              <span class="text-foreground">{entry.note.trim()}</span>
            {/if}
            {#if scheduleLive}
              <span class="text-muted-foreground">Part of a repeating care schedule</span>
            {/if}
            {#if scheduleStopped}
              <span class="text-muted-foreground">Schedule stopped</span>
            {/if}
          </Dialog.Description>
        {/if}
      </Dialog.Header>
      {#if error}
        <p class="text-destructive m-0 text-sm">{error}</p>
      {/if}
      {#if stored}
        <Dialog.Footer>
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
