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
