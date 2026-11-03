/** Photo ids for calendar uploads. randomUUID is missing on plain HTTP. */

const KINDS = new Set(['sowing', 'care', 'pest', 'harvest', 'diary']);

/**
 * @param {string} kind
 * @param {Crypto} [source]
 */
export function calendarPhotoId(kind, source = globalThis.crypto) {
  const prefix = KINDS.has(kind) ? kind : 'photo';
  return `${prefix}-${uuid(source)}`;
}

/** @param {Crypto} source */
function uuid(source) {
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
