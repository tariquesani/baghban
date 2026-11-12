<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';

  let {
    error = '',
    busy = false,
    onLogin,
  }: {
    error?: string;
    busy?: boolean;
    onLogin: (username: string, password: string) => void | Promise<void>;
  } = $props();

  let username = $state('');
  let password = $state('');

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void onLogin(username, password);
  }
</script>

<Card.Root class="w-full max-w-sm">
  <Card.Header>
    <Card.Title>Login to your account</Card.Title>
  </Card.Header>
  <form class="flex flex-col gap-(--card-spacing)" onsubmit={submit}>
    <Card.Content>
      <Field.Group>
        <Field.Field data-invalid={error ? true : undefined}>
          <Field.Label for="login-username">Username</Field.Label>
          <Input
            id="login-username"
            bind:value={username}
            autocomplete="username"
            required
            disabled={busy}
            aria-invalid={error ? true : undefined}
          />
        </Field.Field>
        <Field.Field data-invalid={error ? true : undefined}>
          <Field.Label for="login-password">Password</Field.Label>
          <Input
            id="login-password"
            type="password"
            bind:value={password}
            autocomplete="current-password"
            required
            disabled={busy}
            aria-invalid={error ? true : undefined}
          />
        </Field.Field>
        {#if error}<Field.Error>{error}</Field.Error>{/if}
      </Field.Group>
    </Card.Content>
    <Card.Footer>
      <Button type="submit" class="w-full" disabled={busy}>
        {busy ? 'Logging in…' : 'Login'}
      </Button>
    </Card.Footer>
  </form>
</Card.Root>
