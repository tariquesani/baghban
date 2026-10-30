<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';

  let {
    open = $bindable(false),
    name,
    busy = false,
    onConfirm,
  }: {
    open?: boolean;
    name: string;
    busy?: boolean;
    onConfirm: () => void;
  } = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content size="sm">
    <AlertDialog.Header>
      <AlertDialog.Title>Archive {name}?</AlertDialog.Title>
      <AlertDialog.Description>
        It leaves the list and stays on file.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action disabled={busy} onclick={onConfirm}>Archive</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
