<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';

  let {
    username = '',
    error = '',
    busy = false,
    onSave,
  }: {
    username?: string;
    error?: string;
    busy?: boolean;
    onSave: (payload: {
      currentPassword: string;
      username?: string;
      newPassword?: string;
    }) => void;
  } = $props();

  let nextUsername = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let localError = $state('');

  $effect(() => {
    nextUsername = username;
  });

  function saveAccount(event: SubmitEvent) {
    event.preventDefault();
    localError = '';
    if (!currentPassword) {
      localError = 'Current password is required.';
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      localError = 'New password and confirmation do not match.';
      return;
    }
    const payload: {
      currentPassword: string;
      username?: string;
      newPassword?: string;
    } = { currentPassword };
    const trimmed = nextUsername.trim();
    if (trimmed && trimmed !== username) payload.username = trimmed;
    if (newPassword) payload.newPassword = newPassword;
    if (!payload.username && !payload.newPassword) {
      localError = 'Change the username or set a new password.';
      return;
    }
    onSave(payload);
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Account</Card.Title>
    <Card.Description>Change the login username and password for this garden.</Card.Description>
  </Card.Header>
  <form class="flex flex-col gap-(--card-spacing)" onsubmit={saveAccount}>
    <Card.Content>
      <Field.Group>
        <Field.Field>
          <Field.Label for="account-username">Username</Field.Label>
          <Input
            id="account-username"
            bind:value={nextUsername}
            autocomplete="username"
            disabled={busy}
          />
        </Field.Field>
        <Field.Field data-invalid={error || localError ? true : undefined}>
          <Field.Label for="account-current-password">Current password</Field.Label>
          <Input
            id="account-current-password"
            type="password"
            bind:value={currentPassword}
            autocomplete="current-password"
            disabled={busy}
            aria-invalid={error || localError ? true : undefined}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="account-new-password">New password</Field.Label>
          <Input
            id="account-new-password"
            type="password"
            bind:value={newPassword}
            autocomplete="new-password"
            disabled={busy}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="account-confirm-password">Confirm new password</Field.Label>
          <Input
            id="account-confirm-password"
            type="password"
            bind:value={confirmPassword}
            autocomplete="new-password"
            disabled={busy}
          />
        </Field.Field>
        {#if localError || error}
          <Field.Error>{localError || error}</Field.Error>
        {/if}
      </Field.Group>
    </Card.Content>
    <Card.Footer>
      <Button type="submit" disabled={busy}>Save account</Button>
    </Card.Footer>
  </form>
</Card.Root>
