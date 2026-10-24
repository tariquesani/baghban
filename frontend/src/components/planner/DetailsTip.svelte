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

<div class="tip" {@attach (element) => place(element, 'tipHost')}>
  💡 Keep beds <strong>4 ft wide max</strong> so you can reach the center from both sides without stepping in.
</div>
