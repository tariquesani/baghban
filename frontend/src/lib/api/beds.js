import { api } from './api.js';

export function listBeds() {
  return api.get('/beds');
}
