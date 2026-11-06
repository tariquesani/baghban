import { api } from './api.js';

/**
 * @param {{ through?: string }} [options] `through` is YYYY-MM-DD — extend care
 *   schedule materialization through that date (e.g. end of the visible year).
 */
export function listCalendarEntries(options = {}) {
  const params = new URLSearchParams();
  if (options.through) params.set('through', options.through);
  const query = params.toString();
  return api.get(query ? `/calendar?${query}` : '/calendar');
}

/** @param {Record<string, unknown>} entry */
export function createCalendarEntry(entry) {
  return api.post('/calendar', entry);
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} entry
 */
export function updateCalendarEntry(id, entry) {
  return api.put(`/calendar/${id}`, entry);
}

/** @param {number} id */
export function deleteCalendarEntry(id) {
  return api.delete(`/calendar/${id}`);
}

/**
 * @param {string} photoId
 * @param {Blob} file
 */
export function storePhoto(photoId, file) {
  return api.put(`/photos/${encodeURIComponent(photoId)}`, file);
}

/** @param {string} photoId */
export function removePhoto(photoId) {
  return api.delete(`/photos/${encodeURIComponent(photoId)}`);
}
