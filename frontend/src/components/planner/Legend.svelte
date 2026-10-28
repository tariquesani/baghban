<script>
  /**
   * @param {HTMLElement} element
   * @param {string} hostId
   */
  function place(element, hostId) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.replaceWith(element);
    return () => element.remove();
  }
</script>

<div class="panel-block" {@attach (element) => place(element, 'legendHost')}>
  <div class="legend">
    <div class="legend-item">
      <div class="legend-swatch" style:background="#2d6a30"></div> Bed
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style:background="#9c6644"></div> Planter
    </div>
    <div class="legend-item">
      <div class="legend-swatch ground" style:background="#6aaa6b"></div> Obstacle
    </div>
    <div class="legend-item">
      <div class="legend-swatch open-garden"></div> Open Garden
    </div>
  </div>
</div>

<style>
  .ground {
    opacity: 0.65;
  }
  .open-garden {
    background: #e8f5e0;
    border: 1px solid #a0c8a0;
  }
</style>
