/** Header facts for the home card. The sky request supplies the live rows. */

export const LOCATION_PROMPT =
  'Set the garden location to see weather, sunrise, and the map.';

/**
 * @typedef {{ name: string, illumination: number, icon: string }} MoonFact
 * @typedef {{ temperature: number, phrase: string, icon: string }} WeatherFact
 * @typedef {{ speed: number, icon: string }} WindFact
 * @typedef {{
 *   located?: boolean,
 *   weatherUnavailable?: boolean,
 *   weather?: WeatherFact | null,
 *   wind?: WindFact | null,
 *   sunrise?: string | null,
 *   sunset?: string | null,
 *   moon?: MoonFact | null,
 * }} SkyReading
 * @typedef {{
 *   name?: string,
 *   subtitle?: string,
 *   latitude?: number | null,
 *   longitude?: number | null,
 *   timezone?: string,
 * }} GardenIdentity
 * @typedef {{ id: string, text: string, aside?: string, strong?: boolean, kind?: 'icon' | 'sunrise' | 'sunset', icon?: string }} MetaItem
 * @typedef {{
 *   name: string,
 *   subtitle: string,
 *   located: boolean,
 *   latitude: number | null,
 *   longitude: number | null,
 *   prompt: string,
 *   items: MetaItem[],
 * }} HeaderView
 */

/**
 * @param {Date} instant
 * @param {string} timeZone
 */
export function gardenClock(instant, timeZone) {
  const zone = timeZone || 'UTC';
  let formatted;
  try {
    formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(instant);
  } catch {
    formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(instant);
  }
  const [hour = '00', minute = '00'] = formatted.split(':');
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * @param {unknown} value
 */
function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {unknown} value
 */
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {number} speed
 */
function windText(speed) {
  return `${Number(speed).toFixed(1)} m/s`;
}

/**
 * @param {{
 *   time: string,
 *   timeZone: string,
 *   located: boolean,
 *   weather: WeatherFact | null,
 *   wind: WindFact | null,
 *   unavailable: boolean,
 *   sunrise: string,
 *   sunset: string,
 *   moon: MoonFact | null,
 * }} facts
 * @returns {MetaItem[]}
 */
function metaItems(facts) {
  /** @type {MetaItem[]} */
  const items = [
    { id: 'time', text: facts.time, strong: true },
    { id: 'zone', text: facts.timeZone },
  ];
  if (facts.located && facts.unavailable) {
    items.push({ id: 'weather', text: 'Weather unavailable' });
  } else if (facts.located && facts.weather) {
    items.push({
      id: 'weather',
      text: `${Math.round(facts.weather.temperature)}°C`,
      aside: facts.weather.phrase,
      strong: true,
      kind: 'icon',
      icon: facts.weather.icon,
    });
    if (facts.wind && Number.isFinite(facts.wind.speed)) {
      items.push({
        id: 'wind',
        text: windText(facts.wind.speed),
        kind: 'icon',
        icon: facts.wind.icon || 'wind',
      });
    }
  }
  if (facts.located && facts.sunrise) {
    items.push({ id: 'sunrise', text: facts.sunrise, kind: 'sunrise' });
  }
  if (facts.located && facts.sunset) {
    items.push({ id: 'sunset', text: facts.sunset, kind: 'sunset' });
  }
  if (facts.moon) {
    items.push({
      id: 'moon',
      text: `${facts.moon.name} ${facts.moon.illumination}%`,
      kind: 'icon',
      icon: facts.moon.icon,
    });
  }
  return items;
}

/**
 * @param {{
 *   garden: GardenIdentity | null,
 *   sky: SkyReading | null,
 *   now: Date,
 *   browserZone: string,
 * }} input
 * @returns {HeaderView}
 */
export function headerView(input) {
  const source = input.garden || {};
  const zone = trimmed(source.timezone) || input.browserZone || browserTimeZone();
  const located = finite(source.latitude) && finite(source.longitude);
  const reading = input.sky || {};
  const weather = located && reading.weather ? reading.weather : null;
  const wind = located && reading.wind ? reading.wind : null;
  return {
    name: trimmed(source.name) || 'My garden',
    subtitle: trimmed(source.subtitle),
    located,
    latitude: located ? /** @type {number} */ (source.latitude) : null,
    longitude: located ? /** @type {number} */ (source.longitude) : null,
    prompt: located ? '' : LOCATION_PROMPT,
    items: metaItems({
      time: gardenClock(input.now, zone),
      timeZone: zone,
      located,
      weather,
      wind,
      unavailable: located && !weather && reading.weatherUnavailable === true,
      sunrise: located && reading.sunrise ? reading.sunrise : '',
      sunset: located && reading.sunset ? reading.sunset : '',
      moon: reading.moon || null,
    }),
  };
}
