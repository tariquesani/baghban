<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';

  let {
    name = $bindable(''),
    subtitle = $bindable(''),
    error = '',
    busy = false,
    onSave,
  }: {
    name?: string;
    subtitle?: string;
    error?: string;
    busy?: boolean;
    onSave: () => void;
  } = $props();

  function saveName(event: SubmitEvent) {
    event.preventDefault();
    onSave();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Name</Card.Title>
    <Card.Description>The name and subtitle shown for this garden.</Card.Description>
  </Card.Header>
  <form class="flex flex-col gap-(--card-spacing)" onsubmit={saveName}>
    <Card.Content>
      <Field.Group>
        <Field.Field data-invalid={error ? true : undefined}>
          <Field.Label for="garden-name">Garden name</Field.Label>
          <Input
            id="garden-name"
            bind:value={name}
            autocomplete="off"
            maxlength={80}
            aria-invalid={error ? true : undefined}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="garden-subtitle">Subtitle</Field.Label>
          <Input id="garden-subtitle" bind:value={subtitle} autocomplete="off" maxlength={160} />
        </Field.Field>
        {#if error}<Field.Error>{error}</Field.Error>{/if}
      </Field.Group>
    </Card.Content>
    <Card.Footer>
      <Button type="submit" disabled={busy}>Save name</Button>
    </Card.Footer>
  </form>
</Card.Root>
