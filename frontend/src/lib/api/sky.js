import { api } from './api.js';

/** @param {string} timezone */
export function readSky(timezone) {
  const zone = encodeURIComponent(timezone || '');
  return api.get(`/sky?timezone=${zone}`);
}
