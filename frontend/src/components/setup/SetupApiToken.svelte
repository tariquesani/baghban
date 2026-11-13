<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import * as Card from '$lib/components/ui/card';
  import * as Field from '$lib/components/ui/field';
  import * as InputGroup from '$lib/components/ui/input-group';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';

  let {
    token = '',
    managedByEnv = false,
    error = '',
    busy = false,
    onRegenerate,
  }: {
    token?: string;
    managedByEnv?: boolean;
    error?: string;
    busy?: boolean;
    onRegenerate: () => void;
  } = $props();

  let confirming = $state(false);

  async function copyToken() {
    if (!token || busy) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.success('Copied API token');
    } catch {
      toast.error('Could not copy the token');
    }
  }

  function askRegenerate() {
    if (busy || managedByEnv) return;
    confirming = true;
  }

  function cancelRegenerate() {
    confirming = false;
  }

  function confirmRegenerate() {
    if (busy || managedByEnv) return;
    confirming = false;
    onRegenerate();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>API token</Card.Title>
    <Card.Description>
      Bearer token for scripts and tools. Send it as
      <code class="text-foreground">Authorization: Bearer …</code>.
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-(--card-spacing)">
    <Field.Group>
      <Field.Field data-invalid={error ? true : undefined}>
        <Field.Label for="account-api-token">Token</Field.Label>
        <InputGroup.Root>
          <InputGroup.Input
            id="account-api-token"
            class="font-mono text-xs"
            value={token}
            readonly
            aria-invalid={error ? true : undefined}
          />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button
              type="button"
              size="icon-xs"
              aria-label="Copy API token"
              disabled={busy || !token}
              onclick={copyToken}
            >
              <CopyIcon />
            </InputGroup.Button>
            <InputGroup.Button
              type="button"
              size="icon-xs"
              aria-label="Regenerate API token"
              disabled={busy || managedByEnv || !token}
              onclick={askRegenerate}
            >
              <RefreshCwIcon />
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
        {#if error}
          <Field.Error>{error}</Field.Error>
        {/if}
      </Field.Field>
    </Field.Group>
    {#if managedByEnv}
      <p class="text-sm text-muted-foreground">
        This token comes from <code class="text-foreground">BAGHBAN_API_TOKEN</code>.
        Unset that environment variable to regenerate a file token.
      </p>
    {:else if confirming}
      <p class="text-sm text-muted-foreground">
        Scripts using the old token will stop working. This cannot be undone.
      </p>
    {/if}
  </Card.Content>
  {#if confirming && !managedByEnv}
    <Card.Footer class="gap-2">
      <Button type="button" variant="destructive" disabled={busy} onclick={confirmRegenerate}>
        Yes, regenerate
      </Button>
      <Button type="button" variant="outline" disabled={busy} onclick={cancelRegenerate}>
        Cancel
      </Button>
    </Card.Footer>
  {/if}
</Card.Root>
