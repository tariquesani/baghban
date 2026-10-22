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

const scriptsToLoad = [
  { url: lucideUrl },
  { source: catalogSource },
  { source: plantLookupSource },
  { source: stateSource },
  { source: geometrySource },
  { source: plotSource },
  { source: canvasSource },
  { source: uiSource },
  { source: reportsSource },
  { source: mainSource },
];

function loadUrl(url, scripts) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    scripts.push(script);
    document.head.appendChild(script);
  });
}

function loadSource(source, scripts, objectUrls) {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  objectUrls.push(url);
  return loadUrl(url, scripts);
}

/**
 * Insert the frozen planner into a host that is already in the document.
 * @param {HTMLElement} element
 * @returns {{ destroy: () => void }}
 */
export function mountPlanner(element) {
  element.innerHTML = editorHtml;

  const scripts = [];
  const objectUrls = [];
  let cancelled = false;

  const loading = (async () => {
    for (const entry of scriptsToLoad) {
      if (cancelled) return;
      if (entry.url) await loadUrl(entry.url, scripts);
      else await loadSource(entry.source, scripts, objectUrls);
    }
  })();

  loading.catch((error) => {
    console.error(error);
  });

  return {
    destroy() {
      cancelled = true;
      for (const script of scripts) script.remove();
      for (const url of objectUrls) URL.revokeObjectURL(url);
      element.replaceChildren();
    },
  };
}
