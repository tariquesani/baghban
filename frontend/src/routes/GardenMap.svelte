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
</script>

<svelte:document ontoolchange={noteTool} onselectiondetails={noteDetails} />

<div
  class="map-host"
  {@attach (element) => {
    const planner = mountPlanner(element);
    return () => planner.destroy();
  }}
></div>

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
