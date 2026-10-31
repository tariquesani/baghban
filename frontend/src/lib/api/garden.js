import { api } from './api.js';

export function readGarden() {
  return api.get('/garden');
}

/** @param {{ name: string, subtitle: string, latitude: number | null, longitude: number | null, timezone: string }} identity */
export function saveIdentity(identity) {
  return api.put('/garden/identity', identity);
}

/**
 * @param {{ width: number, height: number, widthText: string, heightText: string }} size
 * @param {Record<string, unknown> | null} plot
 */
export function saveGardenSize(size, plot) {
  return api.put('/garden', {
    garden: {
      width: size.width,
      height: size.height,
      scale: 'dimensions',
      widthText: size.widthText,
      heightText: size.heightText,
    },
    plot,
  });
}

export function resetGarden() {
  return api.post('/garden/reset');
}
