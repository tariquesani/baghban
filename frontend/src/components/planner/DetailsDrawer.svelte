<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import XIcon from '@lucide/svelte/icons/x';
  import SproutIcon from '@lucide/svelte/icons/sprout';
  import { Button } from '$lib/components/ui/button';
  import * as Drawer from '$lib/components/ui/drawer';
  import * as ScrollArea from '$lib/components/ui/scroll-area';
  import BedPlants from './BedPlants.svelte';
  import { section } from './inspector';
  import DetailsActions from './DetailsActions.svelte';
  import DetailsForm from './DetailsForm.svelte';
  import DetailsProperties from './DetailsProperties.svelte';
  import type { SelectionDetails } from './selection';

  let { details }: { details: SelectionDetails | null } = $props();

  const wide = new MediaQuery('(min-width: 681px)');
  const direction = $derived(wide.current ? 'right' : 'bottom');

  function closeDrawer(next: boolean) {
    if (next || details == null) return;
    const select = (globalThis as { select?: (id: null) => void }).select;
    select?.(null);
  }

  function close() {
    const select = (globalThis as { select?: (id: null) => void }).select;
    select?.(null);
  }

  function openOrganizer() {
    const openReport = (globalThis as { openReport?: () => void }).openReport;
    openReport?.();
  }
</script>

<Drawer.Root
  open={details != null}
  onOpenChange={closeDrawer}
  {direction}
  modal={false}
  shouldScaleBackground={false}
  autoFocus={false}
>
  <Drawer.Content
    class="overflow-hidden data-[vaul-drawer-direction=right]:h-dvh data-[vaul-drawer-direction=right]:w-80 data-[vaul-drawer-direction=right]:max-w-80 data-[vaul-drawer-direction=right]:sm:max-w-80 data-[vaul-drawer-direction=bottom]:max-h-[62vh]"
  >
    <Drawer.Header class="shrink-0 flex-row items-center justify-between gap-2 border-b px-3.5 py-3">
      <Drawer.Title class="min-w-0 flex-1 truncate text-[13px] font-bold">{details?.title ?? 'Details'}</Drawer.Title>
      <Drawer.Description class="sr-only">
        Size, plants, and notes for the selected bed, planter, pot, or obstacle.
      </Drawer.Description>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onclick={close}>
        <XIcon />
      </Button>
    </Drawer.Header>
    <ScrollArea.Root class="min-h-0 flex-1">
      {#if details}
        <DetailsActions />
        {#if details.showPlants}
          <div class={section}>
            <Button type="button" size="sm" class="h-7 w-full text-xs" onclick={openOrganizer}>
              <SproutIcon data-icon="inline-start" />
              Plant organizer
            </Button>
          </div>
        {/if}
        <DetailsForm {details} />
        <DetailsProperties {details} />
        {#if details.showPlants}
          {#key details.id}
            <BedPlants {details} />
          {/key}
        {/if}
      {/if}
    </ScrollArea.Root>
  </Drawer.Content>
</Drawer.Root>
