<script lang="ts">
  import GalleryViewer from './GalleryViewer.svelte';

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

  let { photos }: { photos: GalleryPhoto[] } = $props();

  const shown = $derived(photos.slice(0, 9));

  let open = $state(false);
  let selectedId = $state<string | null>(null);

  function openPhoto(id: string) {
    selectedId = id;
    open = true;
  }
</script>

<section class="card" aria-label="Gallery">
  <h2>Gallery</h2>
  {#if shown.length === 0}
    <p class="empty">No photos yet.</p>
  {:else}
    <ul>
      {#each shown as photo (photo.id)}
        <li>
          <button type="button" onclick={() => openPhoto(photo.id)}>
            <img src={photo.photoUrl} alt={photo.alt} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<GalleryViewer {photos} {selectedId} bind:open />

<style>
  .card {
    padding: 20px;
    border: 1px solid rgba(25, 29, 23, 0.12);
    border-radius: 16px;
    background: #fff;
  }

  h2 {
    margin: 0;
    color: #191d17;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .empty {
    margin: 14px 0 0;
    color: #5c6560;
    font-size: 0.9rem;
  }

  ul {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    background: #f4f7f4;
  }

  button {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid #386a20;
    outline-offset: -2px;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
