<script>
  import { onDestroy } from 'svelte';
  import BedPlants from '../components/planner/BedPlants.svelte';
  import DetailsActions from '../components/planner/DetailsActions.svelte';
  import DetailsForm from '../components/planner/DetailsForm.svelte';
  import DetailsProperties from '../components/planner/DetailsProperties.svelte';
  import DetailsTip from '../components/planner/DetailsTip.svelte';
  import PlantOrganizer from '../components/planner/PlantOrganizer.svelte';
  import GardenSettings from '../components/planner/GardenSettings.svelte';
  import SetupChoice from '../components/planner/SetupChoice.svelte';
  import SetupDimensions from '../components/planner/SetupDimensions.svelte';
  import SetupPlan from '../components/planner/SetupPlan.svelte';
  import Toolbar from '../components/planner/Toolbar.svelte';
  import { api } from '$lib/api/api';
  import { createSaveQueue, sceneFromPlan } from '$lib/domain/row-save';
  import { gardenScene } from '$lib/domain/scene';
  import { gardenSizeLabel, inferScale } from '$lib/domain/scale';
  import { mountPlanner } from '$lib/planner/mount';
  import plannerStyles from '$lib/planner/styles.css?inline';

  let { search = '', panel = 'planner', onCanvas } = $props();

  let activeTool = $state('select');
  let details = $state(null);
  let plannerReady = $state(false);
  /** @type {null | 'choice' | 'dimensions' | 'plan'} */
  let setupMode = $state(null);
  /** @type {'upload' | 'draw' | 'length' | 'done'} */
  let planStep = $state('upload');
  let scale = $state(null);
  let sizeLabel = $state('');
  let dimensionWidth = $state('');
  let dimensionHeight = $state('');
  let lengthText = $state('');
  let lengthError = $state('');
  let photoReady = $state(false);
  let toolsReady = $state(false);
  let ignorePlanQuery = false;

  /** @param {CustomEvent<string>} event */
  function noteTool(event) {
    activeTool = event.detail;
  }

  /** @param {CustomEvent} event */
  function noteDetails(event) {
    details = event.detail;
  }

  /** @param {string} value */
  function rename(value) {
    globalThis.updateProp('name', value);
  }

  /** @param {string} value */
  function resizeWidth(value) {
    globalThis.updateProp('w', +value);
  }

  /** @param {string} value */
  function resizeLength(value) {
    globalThis.updateProp('h', +value);
  }

  /** @param {string} value */
  function reviseNotes(value) {
    globalThis.updateProp('notes', value);
  }

  /** @param {CustomEvent} event */
  function noteScale(event) {
    scale = event.detail.scale;
    sizeLabel = gardenSizeLabel(event.detail);
    dimensionWidth = event.detail.widthText || '';
    dimensionHeight = event.detail.heightText || '';
  }

  /** @param {CustomEvent} event */
  function noteCalibLine(event) {
    lengthText = event.detail.previous || '';
    lengthError = '';
    if (setupMode === 'plan') planStep = 'length';
  }

  function notePlotImage() {
    photoReady = true;
    if (setupMode !== 'plan') return;
    if (planStep === 'upload' || planStep === 'draw') {
      planStep = 'draw';
      globalThis.beginCalibration();
    }
  }

  function leaveSetup() {
    ignorePlanQuery = true;
    if (window.location.pathname === '/planner' && window.location.search) {
      history.replaceState(null, '', '/planner');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setupMode = null;
    toolsReady = true;
    globalThis.setTool('select');
  }

  /** @param {boolean} hasPhoto */
  function openPlanSetup(hasPhoto) {
    setupMode = 'plan';
    lengthError = '';
    planStep = hasPhoto ? 'draw' : 'upload';
    if (photoReady) globalThis.beginCalibration();
  }

  /** @param {boolean} wantsPlan */
  function settleScale(wantsPlan) {
    const snapshot = globalThis.currentPlan();
    const inferred = inferScale(snapshot.garden, snapshot.plot, snapshot.beds, snapshot.obstacles);
    if (!snapshot.garden.scale && inferred.scale) {
      globalThis.rememberScale(inferred.scale, inferred.widthText, inferred.heightText);
    }
    const garden = globalThis.currentPlan().garden;
    scale = garden.scale || null;
    sizeLabel = gardenSizeLabel(garden);
    dimensionWidth = garden.widthText || '';
    dimensionHeight = garden.heightText || '';
    photoReady = !!globalThis.currentPlotPhoto();
    const hasPhoto = photoReady || !!(snapshot.plot && (snapshot.plot.photoUrl || snapshot.plot.plotId));
    if (!scale) {
      setupMode = 'choice';
      return;
    }
    toolsReady = true;
    if (wantsPlan && scale === 'plan') openPlanSetup(hasPhoto);
    else setupMode = null;
  }

  /** @param {string} id */
  function visitPlanStep(id) {
    planStep = id;
    lengthError = '';
    if (id === 'draw') globalThis.beginCalibration();
    else globalThis.setTool('select');
    if (id === 'length' && !lengthText) {
      const calibration = globalThis.currentPlan().plot?.calibration;
      if (calibration?.lengthFt) lengthText = String(calibration.lengthFt);
    }
  }

  function uploadPlan() {
    planStep = 'upload';
    globalThis.uploadPlot();
  }

  function submitLength() {
    const saved = globalThis.submitCalibLength(lengthText);
    if (!saved) {
      lengthError = 'That length needs to be greater than 0 and keep the garden between 1 and 500 ft.';
      return;
    }
    lengthError = '';
    planStep = 'done';
  }

  function recalibrate() {
    lengthError = '';
    planStep = 'draw';
    globalThis.beginCalibration();
  }

  let settingsColumn = $derived(panel === 'settings' && setupMode === null);
  let settingsOpen = $derived(settingsColumn && !!scale);
  let canvasReady = $derived(toolsReady && setupMode === null && panel !== 'settings');

  const toolActions = {
    addBed() { globalThis.addBed(); },
    /** @param {string} tool */
    setTool(tool) { globalThis.setTool(tool); },
    addPot() { globalThis.addPot(); },
    addPlanter() { globalThis.addPlanter(); },
    addObstacle() { globalThis.addObstacle(); },
    printPlan() { globalThis.printPlan(); },
  };

  $effect(() => {
    onCanvas?.({
      ready: canvasReady,
      activeTool,
      actions: canvasReady ? toolActions : null,
    });
  });

  onDestroy(() => {
    onCanvas?.({ ready: false, activeTool: 'select', actions: null });
  });

  function resetFromSettings() {
    globalThis.confirmNewGarden();
    setupMode = 'choice';
    ignorePlanQuery = true;
    history.pushState(null, '', '/planner');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function recalibrateFromSettings() {
    const snapshot = globalThis.currentPlan();
    const hasPhoto = photoReady || !!(snapshot.plot && (snapshot.plot.photoUrl || snapshot.plot.plotId));
    openPlanSetup(hasPhoto);
  }

  $effect(() => {
    if (!plannerReady) return;
    const app = document.querySelector('.map-host .app');
    app?.classList.toggle('is-setup', setupMode !== null);
    app?.classList.toggle('is-settings', settingsColumn);
    if (panel !== 'settings' && scale) toolsReady = true;
    if (window.lucide) window.lucide.createIcons();
    const wantsPlan = !ignorePlanQuery && new URLSearchParams(search).get('setup') === 'plan';
    if (wantsPlan && scale === 'plan' && setupMode !== 'plan') {
      const snapshot = globalThis.currentPlan();
      const hasPhoto = photoReady || !!(snapshot.plot && (snapshot.plot.photoUrl || snapshot.plot.plotId));
      openPlanSetup(hasPhoto);
    }
  });

  /** @param {HTMLElement} element */
  function mountGarden(element) {
    const style = document.createElement('style');
    style.dataset.planner = '';
    style.textContent = plannerStyles;
    document.head.appendChild(style);

    const planner = mountPlanner(element);
    const saver = createSaveQueue();
    let saveTimer = 0;
    let stopped = false;
    let serverPhotoUrl = null;

    function photoIdFromUrl(url) {
      const name = (url || '').split('/').pop() || '';
      return name.replace(/\.(jpg|png|webp)$/i, '') || null;
    }

    function announceSaveFailure() {
      window.alert('Could not save this change.');
    }

    function armSaves(now) {
      window.clearTimeout(saveTimer);
      const delay = saver.nextDelay(now);
      if (delay == null) return;
      saveTimer = window.setTimeout(() => {
        saveTimer = 0;
        releaseSaves(Date.now());
      }, delay);
    }

    function submitSave(request) {
      const sent = request.method === 'DELETE'
        ? api.delete(request.path)
        : api.put(request.path, request.body);
      sent.then((row) => {
        const outcome = saver.succeeded(request, row, Date.now());
        if (outcome.alert) announceSaveFailure();
        if (outcome.stamp && !stopped) {
          globalThis.adoptRowId(outcome.stamp.type, outcome.stamp.from, outcome.stamp.to);
        }
        releaseSaves(Date.now());
      }).catch((error) => {
        console.error(error);
        if (saver.failed(request)) announceSaveFailure();
      });
    }

    function releaseSaves(now) {
      for (const request of saver.take(now)) submitSave(request);
      armSaves(now);
    }

    function onPlanChange() {
      if (stopped) return;
      saver.observe(sceneFromPlan(globalThis.currentPlan()), Date.now());
      releaseSaves(Date.now());
    }

    async function onPlotPhoto() {
      try {
        const source = globalThis.currentPlotPhoto();
        if (!source) {
          const photoId = photoIdFromUrl(serverPhotoUrl);
          if (photoId) await api.delete(`/photos/${photoId}`);
          serverPhotoUrl = null;
          globalThis.rememberPhotoUrl(null);
          return;
        }
        const photoId = globalThis.currentPlotId();
        if (!photoId) return;
        const blob = await fetch(source).then((response) => response.blob());
        const saved = await api.put(`/photos/${photoId}`, blob);
        if (!saved?.url) return;
        const previousId = photoIdFromUrl(serverPhotoUrl);
        if (previousId && previousId !== photoId) await api.delete(`/photos/${previousId}`);
        globalThis.rememberPhotoUrl(saved.url);
        serverPhotoUrl = saved.url;
        globalThis.notePlanChanged();
      } catch (error) {
        console.error(error);
      }
    }

    planner.ready.then(async () => {
      if (stopped) return;
      let plan = null;
      try {
        plan = await api.get('/garden');
        if (stopped) return;
        serverPhotoUrl = plan?.plot?.photoUrl || null;
      } catch (error) {
        console.error(error);
      }
      if (stopped) return;
      document.addEventListener('planchange', onPlanChange);
      document.addEventListener('plotphoto', onPlotPhoto);
      document.addEventListener('plotimage', notePlotImage);
      document.addEventListener('scalechange', noteScale);
      document.addEventListener('calibline', noteCalibLine);
      if (plan) globalThis.applyPlan(gardenScene(plan));
      saver.baseline(sceneFromPlan(globalThis.currentPlan()));
      settleScale(new URLSearchParams(window.location.search).get('setup') === 'plan');
      plannerReady = true;
    }).catch(() => {});

    return () => {
      stopped = true;
      saver.flush(Date.now());
      releaseSaves(Date.now());
      document.removeEventListener('planchange', onPlanChange);
      document.removeEventListener('plotphoto', onPlotPhoto);
      document.removeEventListener('plotimage', notePlotImage);
      document.removeEventListener('scalechange', noteScale);
      document.removeEventListener('calibline', noteCalibLine);
      planner.destroy();
      style.remove();
    };
  }
</script>

<svelte:document
  ontoolchange={noteTool}
  onselectiondetails={noteDetails}
/>

<div class="map-host" {@attach mountGarden}></div>

<Toolbar showMenu={setupMode === null && !settingsColumn} />
{#if toolsReady}
  <PlantOrganizer />
{/if}

{#if setupMode}
  <section class="setup-column">
    <div class="setup-body">
    {#if setupMode === 'choice'}
      <SetupChoice
        onDimensions={() => setupMode = 'dimensions'}
        onPlan={() => openPlanSetup(false)}
      />
    {:else if setupMode === 'dimensions'}
      <SetupDimensions onBack={() => setupMode = 'choice'} onDone={leaveSetup} />
    {:else}
      <SetupPlan
        step={planStep}
        {sizeLabel}
        bind:lengthText
        {lengthError}
        {photoReady}
        canCancel={scale === 'plan'}
        onStep={visitPlanStep}
        onUpload={uploadPlan}
        onLength={submitLength}
        onRecalibrate={recalibrate}
        onContinue={leaveSetup}
        onCancel={leaveSetup}
        onBack={() => { globalThis.setTool('select'); setupMode = 'choice'; }}
      />
    {/if}
    </div>
  </section>
{:else if settingsColumn}
  <section class="setup-column">
    {#if settingsOpen}
      <div class="setup-body">
        <GardenSettings
          {scale}
          {sizeLabel}
          widthText={dimensionWidth}
          heightText={dimensionHeight}
          onRecalibrate={recalibrateFromSettings}
          onReset={resetFromSettings}
        />
      </div>
    {/if}
  </section>
{/if}
<DetailsActions />
<DetailsForm
  {details}
  onName={rename}
  onWidth={resizeWidth}
  onLength={resizeLength}
  onNotes={reviseNotes}
/>
<DetailsProperties {details} />
<BedPlants {details} />
<DetailsTip />

<style>
  .setup-column {
    --md-primary: #386a20;
    --md-on-primary: #ffffff;
    --md-on-surface: #191d17;
    --md-on-surface-variant: #42493d;
    position: fixed;
    z-index: 40;
    top: var(--page-head, 0px);
    left: var(--rail-width, 0px);
    bottom: 0;
    width: 280px;
    box-sizing: border-box;
    overflow: auto;
    background: #fff;
    border-right: 1px solid #c2c9bb;
    font-family: Roboto, sans-serif;
    color: #191d17;
  }

  .setup-body { padding: 20px 20px 24px; }

  @media (max-width: 680px) {
    .setup-column {
      right: 0;
      bottom: auto;
      width: auto;
      height: 42vh;
      border-right: none;
      border-bottom: 1px solid #c2c9bb;
    }
  }
</style>
