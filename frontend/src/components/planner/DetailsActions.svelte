<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import { Button } from '$lib/components/ui/button';
  import { section } from './inspector';

  function duplicate() {
    const duplicateSelected = (globalThis as { duplicateSelected?: () => void }).duplicateSelected;
    duplicateSelected?.();
  }

  function remove() {
    const deleteSelected = (globalThis as { deleteSelected?: () => void }).deleteSelected;
    deleteSelected?.();
  }
</script>

<div class="{section} flex gap-1.5">
  <Button type="button" variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={duplicate}>
    <CopyIcon data-icon="inline-start" />
    Duplicate
  </Button>
  <Button type="button" variant="destructive" size="sm" class="h-7 flex-1 text-xs" onclick={remove}>
    <Trash2Icon data-icon="inline-start" />
    Remove
  </Button>
</div>
