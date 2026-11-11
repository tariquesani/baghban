<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy';
  import SproutIcon from '@lucide/svelte/icons/sprout';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import { Button } from '$lib/components/ui/button';
  import * as Field from '$lib/components/ui/field';
  import { legend, section } from './inspector';

  let { showOrganizer = false }: { showOrganizer?: boolean } = $props();

  function duplicate() {
    const duplicateSelected = (globalThis as { duplicateSelected?: () => void }).duplicateSelected;
    duplicateSelected?.();
  }

  function remove() {
    const deleteSelected = (globalThis as { deleteSelected?: () => void }).deleteSelected;
    deleteSelected?.();
  }

  function openOrganizer() {
    const openReport = (globalThis as { openReport?: () => void }).openReport;
    openReport?.();
  }
</script>

<Field.FieldSet class="{section} m-0 min-w-0 gap-1.5 border-x-0 border-t-0">
  <Field.FieldLegend class="{legend} mb-0">Actions</Field.FieldLegend>
  <div class="flex gap-1.5">
    <Button type="button" variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={duplicate}>
      <CopyIcon data-icon="inline-start" />
      Duplicate
    </Button>
    <Button type="button" variant="destructive" size="sm" class="h-7 flex-1 text-xs" onclick={remove}>
      <Trash2Icon data-icon="inline-start" />
      Remove
    </Button>
  </div>
  {#if showOrganizer}
    <Button type="button" size="sm" class="h-7 w-full text-xs" onclick={openOrganizer}>
      <SproutIcon data-icon="inline-start" />
      Plant organizer
    </Button>
  {/if}
</Field.FieldSet>
