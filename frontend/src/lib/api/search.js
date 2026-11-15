import { api } from './api.js';

/**
 * @param {string} q
 * @param {{ limit?: number }} [options]
 */
export function searchGarden(q, options = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (options.limit != null) params.set('limit', String(options.limit));
  const query = params.toString();
  return api.get(`/search${query ? `?${query}` : ''}`);
}
