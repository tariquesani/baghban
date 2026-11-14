import { api } from './api.js';

/**
 * @param {{ tag?: string, archived?: boolean }} [filter]
 */
export function listInventory(filter = {}) {
  const params = new URLSearchParams();
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.archived) params.set('archived', '1');
  const query = params.toString();
  return api.get(`/inventory${query ? `?${query}` : ''}`);
}

/** @param {number} id */
export function getInventoryItem(id) {
  return api.get(`/inventory/${encodeURIComponent(id)}`);
}

/** @param {Record<string, unknown>} item */
export function createInventoryItem(item) {
  return api.post('/inventory', item);
}

/** @param {Record<string, unknown> & { id: number }} item */
export function saveInventoryItem(item) {
  return api.put(`/inventory/${encodeURIComponent(String(item.id))}`, item);
}

/** @param {number} id */
export function deleteInventoryItem(id) {
  return api.delete(`/inventory/${encodeURIComponent(id)}`);
}
