<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';

  let {
    latitude = $bindable(''),
    longitude = $bindable(''),
    timezone = '',
    placed = false,
    error = '',
    busy = false,
    onSave,
    onClear,
  }: {
    latitude?: string;
    longitude?: string;
    timezone?: string;
    placed?: boolean;
    error?: string;
    busy?: boolean;
    onSave: () => void;
    onClear: () => void;
  } = $props();

  let invalid = $derived(error ? true : undefined);

  function savePlace(event: SubmitEvent) {
    event.preventDefault();
    onSave();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Place</Card.Title>
    <Card.Description>Latitude and longitude. The timezone comes from this place.</Card.Description>
  </Card.Header>
  <form class="flex flex-col gap-(--card-spacing)" onsubmit={savePlace}>
    <Card.Content>
      <Field.Group>
        <Field.Field data-invalid={invalid}>
          <Field.Label for="garden-latitude">Latitude</Field.Label>
          <Input
            id="garden-latitude"
            bind:value={latitude}
            inputmode="decimal"
            autocomplete="off"
            aria-invalid={invalid}
          />
        </Field.Field>
        <Field.Field data-invalid={invalid}>
          <Field.Label for="garden-longitude">Longitude</Field.Label>
          <Input
            id="garden-longitude"
            bind:value={longitude}
            inputmode="decimal"
            autocomplete="off"
            aria-invalid={invalid}
          />
        </Field.Field>
        {#if timezone}
          <Field.Field>
            <Field.Label>Timezone</Field.Label>
            <p class="text-sm">{timezone}</p>
          </Field.Field>
        {/if}
        {#if error}<Field.Error>{error}</Field.Error>{/if}
      </Field.Group>
    </Card.Content>
    <Card.Footer class="gap-2">
      <Button type="submit" disabled={busy}>Save place</Button>
      {#if placed}
        <Button type="button" variant="outline" disabled={busy} onclick={onClear}>Clear place</Button>
      {/if}
    </Card.Footer>
  </form>
</Card.Root>
