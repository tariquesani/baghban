<script>
  import AreaList from './AreaList.svelte';

  let plantingAreas = $state.raw([]);
  let obstacles = $state.raw([]);
  let selectedId = $state(null);

  /** @param {{ id: string, name: string, color: string, plants?: string[] }} bed */
  function plantingRow(bed) {
    return {
      id: bed.id,
      name: bed.name,
      color: bed.color,
      size: globalThis.bedListSize(bed),
      plants: (bed.plants || []).join(', ') || '—',
    };
  }

  /** @param {{ id: string, name: string, color: string, w: number, h: number }} obstacle */
  function obstacleRow(obstacle) {
    return {
      id: obstacle.id,
      name: obstacle.name,
      color: obstacle.color,
      size: `${obstacle.w}×${obstacle.h} ft`,
    };
  }

  /**
   * New row objects each time. The canvas mutates the real records
   * outside Svelte, and a keyed row only redraws when its object changes.
   * @param {{ beds: Parameters<typeof plantingRow>[0][], obstacles: Parameters<typeof obstacleRow>[0][], selectedId: string | null }} detail
   */
  function showLists(detail) {
    plantingAreas = detail.beds.map(plantingRow);
    obstacles = detail.obstacles.map(obstacleRow);
    selectedId = detail.selectedId;
  }

  /** @param {CustomEvent} event */
  function noteLists(event) {
    showLists(event.detail);
  }

  if (typeof globalThis.currentLists === 'function') {
    showLists(globalThis.currentLists());
  }
</script>

<svelte:document onlistschange={noteLists} />

<AreaList
  areas={plantingAreas}
  {selectedId}
  hostId="bedList"
  emptyLabel="No planting areas yet"
  selectType="bed"
/>
<AreaList
  areas={obstacles}
  {selectedId}
  hostId="obstacleList"
  emptyLabel="No obstacles yet"
  selectType="obstacle"
/>
