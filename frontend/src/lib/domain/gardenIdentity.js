/** Garden name and place. The plan size stays on the garden save. */

export const NAME_LIMIT = 80;
export const SUBTITLE_LIMIT = 160;

/**
 * @param {{ name?: unknown, subtitle?: unknown, latitude?: unknown, longitude?: unknown, timezone?: unknown } | null | undefined} garden
 */
export function identityFields(garden) {
  const source = garden || {};
  return {
    name: typeof source.name === 'string' ? source.name : '',
    subtitle: typeof source.subtitle === 'string' ? source.subtitle : '',
    latitude: coordinateText(source.latitude),
    longitude: coordinateText(source.longitude),
    timezone: typeof source.timezone === 'string' ? source.timezone : '',
  };
}

/**
 * @param {unknown} value
 */
function coordinateText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

/**
 * @param {string} name
 * @param {string} subtitle
 */
export function nameProblem(name, subtitle) {
  if (name.trim().length > NAME_LIMIT) {
    return `The garden name needs to be ${NAME_LIMIT} characters or fewer.`;
  }
  if (subtitle.trim().length > SUBTITLE_LIMIT) {
    return `The subtitle needs to be ${SUBTITLE_LIMIT} characters or fewer.`;
  }
  return '';
}

/**
 * @param {string} name
 * @param {string} subtitle
 */
export function nameFields(name, subtitle) {
  return { name: name.trim(), subtitle: subtitle.trim() };
}

/**
 * @param {string} text
 * @param {string} label
 * @param {number} low
 * @param {number} high
 * @returns {{ empty: true } | { error: string } | { value: number }}
 */
function coordinate(text, label, low, high) {
  const trimmed = text.trim();
  if (!trimmed) return { empty: true };
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return { error: `${label} needs to be a number.` };
  const value = Number(trimmed);
  if (value < low || value > high) {
    return { error: `${label} needs to be between ${low} and ${high}.` };
  }
  return { value };
}

/**
 * A blank place clears the stored one. A partial place is rejected.
 * The server chooses the timezone from the coordinates.
 * @param {string} latitude
 * @param {string} longitude
 * @returns {{ error: string, body?: undefined } | { error?: undefined, body: { latitude: number | null, longitude: number | null } }}
 */
export function placeBody(latitude, longitude) {
  const lat = coordinate(latitude, 'Latitude', -90, 90);
  const lon = coordinate(longitude, 'Longitude', -180, 180);
  if ('error' in lat) return { error: lat.error };
  if ('error' in lon) return { error: lon.error };
  const blank = 'empty' in lat && 'empty' in lon;
  if (blank) return { body: { latitude: null, longitude: null } };
  if ('empty' in lat || 'empty' in lon) {
    return { error: 'A place needs a latitude and a longitude.' };
  }
  return { body: { latitude: lat.value, longitude: lon.value } };
}
