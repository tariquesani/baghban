import { api } from './api.js';

/**
 * @param {string} username
 * @param {string} password
 */
export function login(username, password) {
  return api.post('/auth/login', { username, password });
}

export function logout() {
  return api.post('/auth/logout', {});
}

export function me() {
  return api.get('/auth/me');
}

/**
 * @param {{
 *   currentPassword: string,
 *   username?: string,
 *   newPassword?: string,
 * }} body
 */
export function updateCredentials(body) {
  return api.put('/auth/credentials', body);
}
