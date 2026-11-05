import { listCrops } from '$lib/api/crops.js';
import { readGarden } from '$lib/api/garden.js';
import { plantCatalogFromCrops } from '$lib/domain/plant-catalog.js';
import { stampStandIn } from '$lib/domain/row-save.js';
import { isSelected } from '$lib/domain/selection.js';
import { gardenScene } from '$lib/domain/scene.js';
import editorHtml from './editor.html?raw';
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
  'gardenScene',
  'isSelected',
  'stampStandIn',
  'PLANT_CATALOG',
  'plannerRoot',
  'pickOnlyFlag',
  'occupancyFlag',
  'let visitOpen = true;\n'
  + 'let pickOnly = !!pickOnlyFlag;\n'
  + 'let showOccupancy = !!occupancyFlag;\n'
  + 'function finishVisit() { visitOpen = false; }\n'
  + 'function plannerElement(id) { return plannerRoot.querySelector("#" + id); }\n'
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

/**
 * @param {unknown[]} plantCatalog
 * @param {HTMLElement} root
 * @param {{ publish?: boolean, pick?: boolean, occupancy?: boolean }} options
 */
function openSession(plantCatalog, root, options) {
  const publish = options.publish !== false;
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
    const api = program(
      gardenScene,
      isSelected,
      stampStandIn,
      plantCatalog,
      root,
      options.pick === true,
      options.occupancy === true,
    );
    if (publish) {
      for (const name of publishedNames) globalThis[name] = api[name];
    }
    return {
      api,
      finish() {
        api.finishVisit();
        controller.abort();
        for (const observer of observers) observer.disconnect();
        if (!publish) return;
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
 * @param {HTMLElement} element
 * @param {{ publish: boolean, pick: boolean, occupancy?: boolean }} options
 */
function startPlanner(element, options) {
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
    let plantCatalog = [];
    try {
      plantCatalog = plantCatalogFromCrops(await listCrops());
    } catch (error) {
      console.error(error);
    }
    if (cancelled) return;
    session = openSession(plantCatalog, element, options);
    if (!options.pick || cancelled) return;
    let plan = null;
    try {
      plan = await readGarden();
    } catch (error) {
      console.error(error);
    }
    if (cancelled || !plan) return;
    try {
      session.api.applyPlan(plan);
    } catch (error) {
      console.error(error);
    }
  })();

  ready.catch((error) => {
    console.error(error);
  });

  return {
    ready,
    /**
     * Highlight a bed already chosen on the form. `none` clears the highlight.
     * @param {string} bedId
     */
    showBed(bedId) {
      const api = session?.api;
      if (!api) return;
      if (bedId === '' || bedId === 'none') {
        api.select(null);
        return;
      }
      const id = Number(bedId);
      if (!Number.isInteger(id)) return;
      api.select(id, 'bed', false);
    },
    /**
     * Zoom the pick view about the center of the canvas.
     * @param {number} factor
     */
    zoom(factor) {
      session?.api?.adjustZoom(factor);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelled = true;
      session?.finish();
      element.replaceChildren();
    },
  };
}

/**
 * Insert the planner into a host that is already in the document.
 * Each call runs the planner program again. `destroy` drops that visit.
 * `ready` resolves when the program has finished starting.
 * Occupancy paints a planting area that has a crop as planted and the rest as empty,
 * the same way the dashboard plan does.
 * @param {HTMLElement} element
 * @returns {{ destroy: () => void, ready: Promise<void> }}
 */
export function mountPlanner(element) {
  const visit = startPlanner(element, { publish: true, pick: false, occupancy: true });
  return {
    ready: visit.ready,
    destroy: () => visit.destroy(),
  };
}

/**
 * A private planner visit. It draws the saved garden and emits `bedpick`
 * on its canvas when a bed is clicked. It does not publish functions or save.
 * `occupancy` paints beds with a crop as planted and the rest as empty.
 * @param {HTMLElement} element
 * @param {{ occupancy?: boolean }} [options]
 */
export function mountBedPicker(element, options = {}) {
  return startPlanner(element, {
    publish: false,
    pick: true,
    occupancy: options.occupancy === true,
  });
}
