<script lang="ts">
  import { mapTiles } from '$lib/domain/gardenMap.js';

  let { latitude, longitude }: { latitude: number; longitude: number } = $props();
  let tiles = $derived(mapTiles(latitude, longitude));
</script>

<div class="thumb">
  {#each tiles as tile (tile.key)}
    <img
      src={tile.url}
      alt=""
      style:left="{tile.left}px"
      style:top="{tile.top}px"
      draggable="false"
    />
  {/each}
  <svg class="pin" viewBox="0 0 24 36" aria-hidden="true">
    <path
      fill="#1a73e8"
      d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
    />
    <circle cx="12" cy="12" r="4.5" fill="#fff" />
  </svg>
  <span class="credit">© OpenStreetMap</span>
</div>

<style>
  .thumb {
    position: relative;
    display: block;
    width: 256px;
    height: 160px;
    flex: 0 0 auto;
    overflow: hidden;
    border-radius: 8px;
    background: #e7eee8;
  }

  img {
    position: absolute;
    width: 256px;
    height: 256px;
    max-width: none;
  }

  .pin {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 18px;
    height: 27px;
    transform: translate(-50%, -100%);
  }

  .credit {
    position: absolute;
    right: 4px;
    bottom: 4px;
    padding: 0 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.82);
    color: #3d4742;
    font-size: 9px;
    line-height: 14px;
  }
</style>
