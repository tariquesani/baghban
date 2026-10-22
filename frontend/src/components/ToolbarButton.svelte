<script>
  /**
   * @param {{
   *   label: string,
   *   icon: string,
   *   onPress: () => void,
   *   tool?: string,
   *   variant?: 'tool' | 'action' | 'menu',
   *   active?: boolean
   * }} props
   */
  let { label, icon, onPress, tool = undefined, variant = 'tool', active = false } = $props();

  const variantClass = {
    tool: 'tool-btn',
    action: 'toolbar-icon-btn',
    menu: 'menu-btn',
  };
</script>

<button
  type="button"
  class={[variantClass[variant], active && 'active']}
  data-tool={tool}
  title={label}
  aria-label={label}
  onclick={onPress}
>
  <i data-lucide={icon}></i>
</button>
