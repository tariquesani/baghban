import editorHtml from './editor.html?raw';
import catalogSource from './js/catalog.js?raw';
import plantLookupSource from './js/plant_lookup.js?raw';
import stateSource from './js/state.js?raw';
import geometrySource from './js/geometry.js?raw';
import plotSource from './js/plot.js?raw';
import canvasSource from './js/canvas.js?raw';
import uiSource from './js/ui.js?raw';
import reportsSource from './js/reports.js?raw';
import mainSource from './js/main.js?raw';

const lucideUrl = 'https://unpkg.com/lucide@1.59.0/dist/umd/lucide.min.js';

const programSource = [
  catalogSource,
  plantLookupSource,
  stateSource,
  geometrySource,
  plotSource,
  canvasSource,
  uiSource,
  reportsSource,
  mainSource,
].join('\n');

const publishedNames = [...programSource.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map((match) => match[1]);

// Each call gets a fresh scope, so a later visit can declare the same
// bindings. visitOpen lets a destroyed visit ignore photo loads still in flight.
const program = new Function(
  'let visitOpen = true;\n'
  + 'function finishVisit() { visitOpen = false; }\n'
  + programSource
  + '\nreturn { finishVisit, '
  + publishedNames.join(', ')
  + ' };'
);

let lucideReady;

export function loadLucide() {
  if (window.lucide) return Promise.resolve();
  if (!lucideReady) {
    lucideReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = lucideUrl;
      script.onload = () => resolve();
      script.onerror = () => {
        lucideReady = null;
        reject(new Error(`Could not load ${lucideUrl}`));
      };
      document.head.appendChild(script);
    });
  }
  return lucideReady;
}

/**
 * @param {boolean | AddEventListenerOptions | undefined} options
 * @param {AbortSignal} signal
 */
function optionsWithSignal(options, signal) {
  if (typeof options === 'boolean') return { capture: options, signal };
  if (options && typeof options === 'object') {
    if (options.signal) return options;
    return { ...options, signal };
  }
  return { signal };
}

function openSession() {
  const controller = new AbortController();
  /** @type {ResizeObserver[]} */
  const observers = [];
  const OriginalResizeObserver = window.ResizeObserver;
  const originalAdd = EventTarget.prototype.addEventListener;

  window.ResizeObserver = function (callback) {
    const observer = new OriginalResizeObserver(callback);
    observers.push(observer);
    return observer;
  };

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    return originalAdd.call(this, type, listener, optionsWithSignal(options, controller.signal));
  };

  try {
    const api = program();
    for (const name of publishedNames) globalThis[name] = api[name];
    return {
      finish() {
        api.finishVisit();
        controller.abort();
        for (const observer of observers) observer.disconnect();
        for (const name of publishedNames) {
          if (globalThis[name] === api[name]) delete globalThis[name];
        }
      },
    };
  } catch (error) {
    controller.abort();
    for (const observer of observers) observer.disconnect();
    throw error;
  } finally {
    EventTarget.prototype.addEventListener = originalAdd;
    window.ResizeObserver = OriginalResizeObserver;
  }
}

/**
 * Insert the planner into a host that is already in the document.
 * Each call runs the planner program again. `destroy` drops that visit.
 * `ready` resolves when the program has finished starting.
 * @param {HTMLElement} element
 * @returns {{ destroy: () => void, ready: Promise<void> }}
 */
export function mountPlanner(element) {
  element.innerHTML = editorHtml;

  let cancelled = false;
  let destroyed = false;
  /** @type {ReturnType<typeof openSession> | null} */
  let session = null;

  const ready = (async () => {
    await Promise.resolve();
    if (cancelled) return;
    await loadLucide();
    if (cancelled) return;
    session = openSession();
  })();

  ready.catch((error) => {
    console.error(error);
  });

  return {
    ready,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelled = true;
      session?.finish();
      element.replaceChildren();
    },
  };
}
