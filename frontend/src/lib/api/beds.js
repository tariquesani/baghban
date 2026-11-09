import { api } from './api.js';

export function listBeds() {
  return api.get('/beds');
}

export function listAssignments() {
  return api.get('/beds/crops');
}

export function listOrphanBeds() {
  return api.get('/beds/orphans');
}

export function purgeOrphanBed(id) {
  return api.delete(`/beds/orphans/${id}`);
}
