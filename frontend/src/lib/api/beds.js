import { api } from './api.js';

export function listBeds() {
  return api.get('/beds');
}

export function listAssignments() {
  return api.get('/beds/crops');
}
