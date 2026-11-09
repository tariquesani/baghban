import { api } from './api.js';

/**
 * @param {{ q?: string, category?: string, archived?: boolean }} [filter]
 */
export function listCrops(filter = {}) {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.category) params.set('category', filter.category);
  if (filter.archived) params.set('archived', '1');
  const query = params.toString();
  return api.get(`/crops${query ? `?${query}` : ''}`);
}

/** @param {number} id */
export function getCrop(id) {
  return api.get(`/crops/${encodeURIComponent(id)}`);
}

/** @param {Record<string, unknown>} crop */
export function createCrop(crop) {
  return api.post('/crops', crop);
}

/** @param {Record<string, unknown> & { id: number }} crop */
export function saveCrop(crop) {
  return api.put(`/crops/${encodeURIComponent(String(crop.id))}`, crop);
}

/** @param {number} id */
export function archiveCrop(id) {
  return api.delete(`/crops/${encodeURIComponent(id)}`);
}

/**
 * @param {number} id
 * @param {number | string | null | undefined} [rev]
 */
export function cropIconUrl(id, rev) {
  const base = `/api/crops/${encodeURIComponent(id)}/icon`;
  if (rev == null || rev === '') return base;
  return `${base}?v=${encodeURIComponent(String(rev))}`;
}

/**
 * @param {number} id
 * @param {Blob} file
 */
export function storeCropIcon(id, file) {
  return api.put(`/crops/${encodeURIComponent(id)}/icon`, file);
}

/** @param {number} id */
export function removeCropIcon(id) {
  return api.delete(`/crops/${encodeURIComponent(id)}/icon`);
}
