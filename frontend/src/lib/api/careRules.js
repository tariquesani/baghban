import { api } from './api.js';

export function listCareRules() {
  return api.get('/care-rules');
}

/** @param {Record<string, unknown>} rule */
export function createCareRule(rule) {
  return api.post('/care-rules', rule);
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} rule
 */
export function updateCareRule(id, rule) {
  return api.put(`/care-rules/${id}`, rule);
}

/** @param {number} id */
export function deactivateCareRule(id) {
  return api.post(`/care-rules/${id}/deactivate`);
}
