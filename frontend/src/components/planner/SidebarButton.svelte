<script>
  /**
   * @param {{
   *   label: string,
   *   icon: string,
   *   onPress: () => void,
   *   active?: boolean,
   *   id?: string,
   *   tool?: string
   * }} props
   */
  let { label, icon, onPress, active = false, id = undefined, tool = undefined } = $props();
</script>

<button
  {id}
  type="button"
  class={['nav-btn', active && 'active']}
  data-tool={tool}
  title={label}
  onclick={onPress}
>
  <i data-lucide={icon}></i>
  <span class="label-large">{label}</span>
</button>
