<script>
  /**
   * @param {{
   *   label: string,
   *   icon: string,
   *   onPress: () => void,
   *   tool?: string,
   *   variant?: 'tool' | 'action' | 'menu',
   *   active?: boolean,
   *   pressed?: boolean | null,
   *   id?: string
   * }} props
   */
  let { label, icon, onPress, tool = undefined, variant = 'tool', active = false, pressed = null, id = undefined } = $props();

  const variantClass = {
    tool: 'tool-btn',
    action: 'toolbar-icon-btn',
    menu: 'menu-btn',
  };
</script>

<button
  {id}
  type="button"
  class={[variantClass[variant], active && 'active']}
  data-tool={tool}
  title={label}
  aria-label={label}
  aria-pressed={pressed === null ? undefined : pressed}
  onclick={onPress}
>
  {#key icon}
    <i data-lucide={icon}></i>
  {/key}
</button>
