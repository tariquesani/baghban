<script lang="ts">
  import clearDay from '@bybas/weather-icons/production/fill/all/clear-day.svg?raw';
  import partlyCloudyDay from '@bybas/weather-icons/production/fill/all/partly-cloudy-day.svg?raw';
  import overcastDay from '@bybas/weather-icons/production/fill/all/overcast-day.svg?raw';
  import partlyCloudyDayRain from '@bybas/weather-icons/production/fill/all/partly-cloudy-day-rain.svg?raw';
  import thunderstormsDayRain from '@bybas/weather-icons/production/fill/all/thunderstorms-day-rain.svg?raw';
  import fogDay from '@bybas/weather-icons/production/fill/all/fog-day.svg?raw';
  import clearNight from '@bybas/weather-icons/production/fill/all/clear-night.svg?raw';
  import partlyCloudyNight from '@bybas/weather-icons/production/fill/all/partly-cloudy-night.svg?raw';
  import overcastNight from '@bybas/weather-icons/production/fill/all/overcast-night.svg?raw';
  import partlyCloudyNightRain from '@bybas/weather-icons/production/fill/all/partly-cloudy-night-rain.svg?raw';
  import thunderstormsNightRain from '@bybas/weather-icons/production/fill/all/thunderstorms-night-rain.svg?raw';
  import fogNight from '@bybas/weather-icons/production/fill/all/fog-night.svg?raw';
  import rainIcon from '@bybas/weather-icons/production/fill/all/rain.svg?raw';
  import sleetIcon from '@bybas/weather-icons/production/fill/all/sleet.svg?raw';
  import snowIcon from '@bybas/weather-icons/production/fill/all/snow.svg?raw';
  import moonNew from '@bybas/weather-icons/production/fill/all/moon-new.svg?raw';
  import moonWaxingCrescent from '@bybas/weather-icons/production/fill/all/moon-waxing-crescent.svg?raw';
  import moonFirstQuarter from '@bybas/weather-icons/production/fill/all/moon-first-quarter.svg?raw';
  import moonWaxingGibbous from '@bybas/weather-icons/production/fill/all/moon-waxing-gibbous.svg?raw';
  import moonFull from '@bybas/weather-icons/production/fill/all/moon-full.svg?raw';
  import moonWaningGibbous from '@bybas/weather-icons/production/fill/all/moon-waning-gibbous.svg?raw';
  import moonLastQuarter from '@bybas/weather-icons/production/fill/all/moon-last-quarter.svg?raw';
  import moonWaningCrescent from '@bybas/weather-icons/production/fill/all/moon-waning-crescent.svg?raw';
  import wind from '@bybas/weather-icons/production/fill/all/wind.svg?raw';
  import notAvailable from '@bybas/weather-icons/production/fill/all/not-available.svg?raw';

  const icons: Record<string, string> = {
    'clear-day': clearDay,
    'partly-cloudy-day': partlyCloudyDay,
    'overcast-day': overcastDay,
    'partly-cloudy-day-rain': partlyCloudyDayRain,
    'thunderstorms-day-rain': thunderstormsDayRain,
    'fog-day': fogDay,
    'clear-night': clearNight,
    'partly-cloudy-night': partlyCloudyNight,
    'overcast-night': overcastNight,
    'partly-cloudy-night-rain': partlyCloudyNightRain,
    'thunderstorms-night-rain': thunderstormsNightRain,
    'fog-night': fogNight,
    rain: rainIcon,
    sleet: sleetIcon,
    snow: snowIcon,
    'moon-new': moonNew,
    'moon-waxing-crescent': moonWaxingCrescent,
    'moon-first-quarter': moonFirstQuarter,
    'moon-waxing-gibbous': moonWaxingGibbous,
    'moon-full': moonFull,
    'moon-waning-gibbous': moonWaningGibbous,
    'moon-last-quarter': moonLastQuarter,
    'moon-waning-crescent': moonWaningCrescent,
    wind,
    'not-available': notAvailable,
  };

  let { icon, size }: { icon: string; size: number } = $props();
  let svg = $derived(icons[icon] ?? icons['not-available']);
</script>

<span class="glyph" style:width="{size}px" style:height="{size}px" aria-hidden="true">
  {@html svg}
</span>

<style>
  .glyph {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .glyph :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
