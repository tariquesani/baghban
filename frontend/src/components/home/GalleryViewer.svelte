<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import * as Carousel from '$lib/components/ui/carousel';
  import type { CarouselAPI } from '$lib/components/ui/carousel/context.js';
  import * as Dialog from '$lib/components/ui/dialog';

  type GalleryPhoto = {
    id: string;
    photoUrl: string;
    alt: string;
    date: string;
    crop: string;
    kind: string;
    status: string;
    bed: string;
    action: string;
    problem: string;
    product: string;
    detail: string;
    note: string;
  };

  let {
    photos,
    selectedId,
    open = $bindable(false),
  }: {
    photos: GalleryPhoto[];
    selectedId: string | null;
    open?: boolean;
  } = $props();

  let api = $state<CarouselAPI>();
  let index = $state(0);

  const startIndex = $derived.by(() => {
    const found = photos.findIndex((photo) => photo.id === selectedId);
    return found < 0 ? 0 : found;
  });
  const current = $derived(photos[index] ?? photos[startIndex]);
  const facts = $derived.by(() => {
    if (!current) return [];
    const rows = [
      ['Crop', current.crop],
      ['Bed', current.bed],
      ['Action', current.action],
      ['Problem', current.problem],
      ['Product', current.product],
      ['Amount', current.detail],
    ];
    return rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  });

  $effect.pre(() => {
    selectedId;
    index = startIndex;
  });

  function onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      api?.scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      api?.scrollNext();
    }
  }

  $effect(() => {
    if (!api) return;
    const mark = () => {
      index = api?.selectedScrollSnap() ?? 0;
    };
    mark();
    api.on('select', mark);
    return () => api?.off('select', mark);
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-4 sm:max-w-3xl" onkeydown={onKey}>
    {#if open}
      {#key selectedId}
        <Carousel.Root
          opts={{ loop: photos.length > 1, startIndex }}
          setApi={(next) => (api = next)}
          aria-label="Gallery photos"
        >
          <Carousel.Content class="ms-0">
            {#each photos as photo (photo.id)}
              <Carousel.Item class="flex items-center justify-center ps-0">
                <img src={photo.photoUrl} alt={photo.alt} class="max-h-[calc(100vh-16rem)] max-w-full object-contain" />
              </Carousel.Item>
            {/each}
          </Carousel.Content>
          <Carousel.Previous class="start-3" />
          <Carousel.Next class="end-3" />
        </Carousel.Root>
      {/key}
    {/if}
    <Dialog.Header class="gap-1">
      <Dialog.Title class="flex flex-wrap items-center gap-2">
        {#if current}
          <Badge>{current.date} · {current.kind}</Badge>
          <Badge variant="outline">{current.status}</Badge>
        {:else}
          Gallery
        {/if}
      </Dialog.Title>
      {#if current && (facts.length || current.note)}
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
          {#if current.note}
            <span class="text-foreground">{current.note}</span>
          {/if}
        </Dialog.Description>
      {/if}
    </Dialog.Header>
  </Dialog.Content>
</Dialog.Root>
