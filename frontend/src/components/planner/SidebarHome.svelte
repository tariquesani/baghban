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

<a
  class="nav-btn"
  href="/"
  title="Home"
  {@attach (element) => place(element, 'homeHost')}
>
  <i data-lucide="house"></i>
  <span class="label-large">Home</span>
</a>
