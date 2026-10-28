<script>
  import { archiveCrop, getCrop, listCrops, saveCrop } from '$lib/api/crops.js';
  import { cloneCrop, cropPayload, cropSlug, emptyCrop } from '$lib/domain/crop.js';
  import CropForm from '../components/crops/CropForm.svelte';
  import CropList from '../components/crops/CropList.svelte';

  const narrowQuery = window.matchMedia('(max-width: 800px)');

  let narrow = $state(narrowQuery.matches);
  let crops = $state.raw([]);
  let choices = $state.raw([]);
  let query = $state('');
  let category = $state('');
  let showArchived = $state(false);
  let selectedId = $state('');
  let creating = $state(false);
  let editing = $state(false);
  let formOpen = $state(false);
  let draft = $state(emptyCrop());
  let aliasText = $state('');
  let companionQuery = $state('');
  let avoidQuery = $state('');
  let busy = $state(false);
  let error = $state('');
  let listError = $state('');
  let ready = $state(false);
  let listTicket = 0;

  let showList = $derived(!narrow || !formOpen);
  let showForm = $derived(editing && (!narrow || formOpen));

  function noteViewport() {
    narrow = narrowQuery.matches;
  }

  function clearPicker() {
    aliasText = '';
    companionQuery = '';
    avoidQuery = '';
  }

  async function loadChoices() {
    choices = await listCrops();
  }

  async function loadList() {
    const ticket = ++listTicket;
    try {
      const rows = await listCrops({
        q: query,
        category,
        archived: showArchived,
      });
      if (ticket !== listTicket) return;
      crops = rows;
      listError = '';
      ready = true;
    } catch (err) {
      if (ticket !== listTicket) return;
      listError = err instanceof Error ? err.message : 'Could not load crops';
    }
  }

  function startCreating() {
    creating = true;
    editing = true;
    formOpen = true;
    selectedId = '';
    error = '';
    draft = emptyCrop();
    clearPicker();
  }

  /** @param {{ id: string }} crop */
  function openCrop(crop) {
    const found = crops.find((row) => row.id === crop.id);
    if (!found) return;
    creating = false;
    editing = true;
    formOpen = true;
    selectedId = found.id;
    error = '';
    draft = cloneCrop(found);
    clearPicker();
  }

  /**
   * @param {string} name
   */
  function cropIdFor(name) {
    return creating ? cropSlug(name) : draft.id;
  }

  async function saveDraft() {
    const name = draft.name.trim();
    if (!name) {
      error = 'A crop needs a name';
      return;
    }
    if (!draft.category) {
      error = 'A crop needs a category';
      return;
    }
    const id = cropIdFor(name);
    if (!id) {
      error = 'Use a name with letters or numbers';
      return;
    }
    busy = true;
    error = '';
    try {
      if (creating) {
        try {
          await getCrop(id);
          error = 'A crop with this name already exists';
          return;
        } catch (err) {
          if (!(err instanceof Error) || !err.message.includes('Crop not found')) throw err;
        }
      }
      const saved = await saveCrop(cropPayload(draft, id));
      creating = false;
      selectedId = saved.id;
      draft = cloneCrop(saved);
      if (!saved.archived) showArchived = false;
      await loadChoices();
      await loadList();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save this crop';
    } finally {
      busy = false;
    }
  }

  async function archiveOpen() {
    const name = draft.name.trim() || 'this crop';
    if (!confirm(`Archive ${name}? It leaves the list and stays on file.`)) return;
    busy = true;
    error = '';
    try {
      await archiveCrop(draft.id);
      editing = false;
      formOpen = false;
      creating = false;
      selectedId = '';
      draft = emptyCrop();
      await loadChoices();
      await loadList();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not archive this crop';
    } finally {
      busy = false;
    }
  }

  async function restoreOpen() {
    busy = true;
    error = '';
    try {
      const saved = await saveCrop(cropPayload({ ...draft, archived: false }, draft.id));
      creating = false;
      selectedId = saved.id;
      draft = cloneCrop(saved);
      showArchived = false;
      await loadChoices();
      await loadList();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not restore this crop';
    } finally {
      busy = false;
    }
  }

  function closeForm() {
    formOpen = false;
    editing = false;
    error = '';
  }

  loadChoices().catch((err) => {
    listError = err instanceof Error ? err.message : 'Could not load crops';
  });
  loadList();
</script>

<svelte:window onresize={noteViewport} />

<div class="crops">
  {#if listError}<p class="error" role="alert">{listError}</p>{/if}
  <div class="workspace">
    {#if showList}
      <CropList
        {crops}
        {selectedId}
        {query}
        {category}
        {showArchived}
        onQuery={(value) => { query = value; loadList(); }}
        onCategory={(value) => { category = value; loadList(); }}
        onShowArchived={(value) => { showArchived = value; loadList(); }}
        onAdd={startCreating}
        onSelect={openCrop}
        {ready}
      />
    {/if}
    {#if showForm}
      <CropForm
        {draft}
        {creating}
        {choices}
        {busy}
        {error}
        {narrow}
        bind:aliasText
        bind:companionQuery
        bind:avoidQuery
        onSave={saveDraft}
        onArchive={archiveOpen}
        onRestore={restoreOpen}
        onBack={closeForm}
      />
    {:else if !narrow}
      <p class="prompt">Select a crop, or add one.</p>
    {/if}
  </div>
</div>

<style>
  .crops {
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 24px 24px;
    font-family: Roboto, sans-serif;
    color: #191d17;
  }

  .workspace {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .workspace > :global(.list),
  .workspace > :global(form) {
    max-height: 100%;
    overflow: auto;
  }

  .prompt {
    margin: 0;
    padding: 16px;
    color: #42493d;
  }

  .error {
    margin: 0;
    color: #8a1f11;
  }

  @media (max-width: 800px) {
    .crops { padding: 8px 16px 24px; }
    .workspace { grid-template-columns: 1fr; }
  }
</style>
