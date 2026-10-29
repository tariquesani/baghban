/**
 * Talk to FastAPI. `path` is the resource under `/api`, such as `/garden`.
 * A 204 or an empty body comes back as null.
 * @param {string} path
 * @param {RequestInit} [options]
 */
async function send(path, options) {
  const response = await fetch(`/api${path}`, options);
  if (response.status === 204) return null;
  if (!response.ok) {
    let detail = '';
    const text = await response.text();
    if (text) {
      try {
        const body = JSON.parse(text);
        if (typeof body.detail === 'string') detail = body.detail;
      } catch {
        detail = '';
      }
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }
  const type = response.headers.get('content-type') || '';
  if (type.startsWith('image/')) return response.blob();
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

export const api = {
  /** @param {string} path */
  get(path) {
    return send(path);
  },

  /**
   * @param {string} path
   * @param {unknown} body
   */
  post(path, body) {
    return send(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  /**
   * @param {string} path
   * @param {unknown} body
   */
  put(path, body) {
    if (body instanceof Blob) {
      return send(path, {
        method: 'PUT',
        headers: body.type ? { 'Content-Type': body.type } : {},
        body,
      });
    }
    return send(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  /** @param {string} path */
  delete(path) {
    return send(path, { method: 'DELETE' });
  },
};
