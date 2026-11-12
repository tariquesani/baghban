<script lang="ts">
  import SproutIcon from '@lucide/svelte/icons/sprout';
  import LoginForm from '../components/LoginForm.svelte';

  let {
    error = '',
    busy = false,
    onLogin,
  }: {
    error?: string;
    busy?: boolean;
    onLogin: (username: string, password: string) => void | Promise<void>;
  } = $props();
</script>

<main class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
  <div class="flex w-full max-w-sm flex-col gap-6">
    <div class="flex items-center gap-2 self-center font-medium">
      <div
        class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <SproutIcon class="size-4" />
      </div>
      Baghban
    </div>
    <LoginForm {error} {busy} {onLogin} />
  </div>
</main>
