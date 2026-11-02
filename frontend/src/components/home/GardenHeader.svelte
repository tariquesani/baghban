<script lang="ts">
  import SunriseIcon from '@lucide/svelte/icons/sunrise';
  import SunsetIcon from '@lucide/svelte/icons/sunset';
  import GardenMap from './GardenMap.svelte';
  import WeatherIcon from './WeatherIcon.svelte';

  type MetaItem = {
    id: string;
    text: string;
    aside?: string;
    strong?: boolean;
    kind?: 'icon' | 'sunrise' | 'sunset';
    icon?: string;
  };

  let {
    name,
    subtitle,
    items,
    prompt,
    latitude,
    longitude,
  }: {
    name: string;
    subtitle: string;
    items: MetaItem[];
    prompt: string;
    latitude: number | null;
    longitude: number | null;
  } = $props();
</script>

<section class="card">
  <div class="copy">
    <h2>{name}</h2>
    {#if subtitle}
      <p class="subtitle">{subtitle}</p>
    {/if}
    <div class="meta">
      {#each items as item, index (item.id)}
        {#if index > 0 && item.id !== 'zone'}
          <span class="rule" aria-hidden="true"></span>
        {/if}
        <span class="item" class:zone={item.id === 'zone'}>
          {#if item.kind === 'sunrise'}
            <span class="sun" aria-hidden="true"><SunriseIcon size={16} /></span>
          {:else if item.kind === 'sunset'}
            <span class="sun" aria-hidden="true"><SunsetIcon size={16} /></span>
          {:else if item.icon}
            <WeatherIcon icon={item.icon} size={item.id === 'wind' ? 28 : item.id === 'moon' ? 24 : 36} />
          {/if}
          <span class="words">
            <span class:strong={item.strong}>{item.text}</span>
            {#if item.aside}<span>{item.aside}</span>{/if}
          </span>
        </span>
      {/each}
    </div>
    {#if prompt}
      <p class="prompt">{prompt}</p>
    {/if}
  </div>
  <div class="place">
    {#if latitude !== null && longitude !== null}
      <GardenMap {latitude} {longitude} />
    {:else}
      <div class="empty" aria-hidden="true"></div>
    {/if}
  </div>
</section>

<style>
  .card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    box-sizing: border-box;
    padding: 24px;
    border: 1px solid rgba(25, 29, 23, 0.12);
    border-radius: 16px;
    background: #fff;
  }

  .copy {
    min-width: 0;
    flex: 1;
  }

  h2 {
    margin: 0 0 8px;
    overflow: hidden;
    color: #191d17;
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    margin: 0;
    overflow: hidden;
    color: #5c6560;
    font-size: 0.9rem;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 12px;
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #3d4742;
    font-size: 0.85rem;
    line-height: 1.3;
  }

  .words {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35em;
  }

  .zone {
    margin-left: 8px;
  }

  .strong {
    font-weight: 700;
  }

  .rule {
    width: 1px;
    height: 14px;
    margin: 0 10px;
    background: #c5cdc8;
  }

  .sun {
    display: inline-flex;
    color: #386a20;
  }

  .prompt {
    margin: 10px 0 0;
    color: #5c6560;
    font-size: 0.85rem;
  }

  .place {
    flex: 0 0 auto;
  }

  .empty {
    width: 256px;
    height: 160px;
    border-radius: 8px;
    background: #e7eee8;
  }

  @media (max-width: 800px) {
    .card {
      flex-direction: column;
      align-items: stretch;
    }

    .place {
      align-self: flex-start;
    }
  }
</style>
