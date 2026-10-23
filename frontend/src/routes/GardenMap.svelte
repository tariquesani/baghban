<script>
  import BedPlants from '../components/BedPlants.svelte';
  import DetailsActions from '../components/DetailsActions.svelte';
  import DetailsForm from '../components/DetailsForm.svelte';
  import DetailsProperties from '../components/DetailsProperties.svelte';
  import DetailsTip from '../components/DetailsTip.svelte';
  import GardenSize from '../components/GardenSize.svelte';
  import GroundArea from '../components/GroundArea.svelte';
  import Help from '../components/Help.svelte';
  import Legend from '../components/Legend.svelte';
  import NewGarden from '../components/NewGarden.svelte';
  import PlantOrganizer from '../components/PlantOrganizer.svelte';
  import SidebarActions from '../components/SidebarActions.svelte';
  import SidebarBrand from '../components/SidebarBrand.svelte';
  import SidebarLists from '../components/SidebarLists.svelte';
  import Toolbar from '../components/Toolbar.svelte';
  import { api } from '$lib/api/api';
  import { mountPlanner } from '$lib/canvas/planner';

  let helpOpen = $state(false);
  let activeTool = $state('select');
  let details = $state(null);

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

  /** @param {HTMLElement} element */
  function mountGarden(element) {
    const planner = mountPlanner(element);
    let saveTimer = 0;
    let stopped = false;
    let serverPhotoUrl = null;

    function photoIdFromUrl(url) {
      const name = (url || '').split('/').pop() || '';
      return name.replace(/\.(jpg|png|webp)$/i, '') || null;
    }

    function onPlanChange() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        api.put('/garden', globalThis.currentPlan()).catch((error) => {
          console.error(error);
        });
      }, 800);
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
      if (plan) globalThis.applyPlan(plan);
    }).catch(() => {});

    return () => {
      stopped = true;
      window.clearTimeout(saveTimer);
      document.removeEventListener('planchange', onPlanChange);
      document.removeEventListener('plotphoto', onPlotPhoto);
      planner.destroy();
    };
  }
</script>

<svelte:document ontoolchange={noteTool} onselectiondetails={noteDetails} />

<div class="map-host" {@attach mountGarden}></div>

<Toolbar {activeTool} />
<SidebarBrand />
<NewGarden />
<GardenSize />
<GroundArea />
<Legend />
<PlantOrganizer />
<SidebarActions {activeTool} onHelp={() => helpOpen = true} />
<SidebarLists />
<Help open={helpOpen} onClose={() => helpOpen = false} />
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
