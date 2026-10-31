<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Field from '$lib/components/ui/field';
  import * as InputGroup from '$lib/components/ui/input-group';

  let {
    scale,
    sizeLabel,
    widthText = $bindable(''),
    heightText = $bindable(''),
    error = '',
    outside,
    busy = false,
    onSave,
  }: {
    scale: string | null;
    sizeLabel: string;
    widthText?: string;
    heightText?: string;
    error?: string;
    outside: { id: string; name: string }[];
    busy?: boolean;
    onSave: () => void;
  } = $props();

  let invalid = $derived(error ? true : undefined);

  function saveSize(event: SubmitEvent) {
    event.preventDefault();
    onSave();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Size</Card.Title>
    <Card.Description>
      {#if scale === 'plan'}
        {sizeLabel}
      {:else if scale === 'dimensions'}
        Width and length of the plot, in feet.
      {:else}
        The garden still needs a scale.
      {/if}
    </Card.Description>
  </Card.Header>
  {#if scale === 'dimensions'}
    <form class="flex flex-col gap-(--card-spacing)" onsubmit={saveSize}>
      <Card.Content>
        <Field.Group>
          <Field.Field data-invalid={invalid}>
            <Field.Label for="garden-width">Width</Field.Label>
            <InputGroup.Root>
              <InputGroup.Input
                id="garden-width"
                bind:value={widthText}
                inputmode="decimal"
                autocomplete="off"
                aria-invalid={invalid}
              />
              <InputGroup.Addon align="inline-end">ft</InputGroup.Addon>
            </InputGroup.Root>
          </Field.Field>
          <Field.Field data-invalid={invalid}>
            <Field.Label for="garden-length">Length</Field.Label>
            <InputGroup.Root>
              <InputGroup.Input
                id="garden-length"
                bind:value={heightText}
                inputmode="decimal"
                autocomplete="off"
                aria-invalid={invalid}
              />
              <InputGroup.Addon align="inline-end">ft</InputGroup.Addon>
            </InputGroup.Root>
          </Field.Field>
          {#if error}<Field.Error>{error}</Field.Error>{/if}
          {#if outside.length}
            <Field.Description>These no longer fit in the plot.</Field.Description>
            <ul class="flex flex-col gap-1 text-sm text-muted-foreground">
              {#each outside as item (item.id)}
                <li>{item.name}</li>
              {/each}
            </ul>
          {/if}
        </Field.Group>
      </Card.Content>
      <Card.Footer>
        <Button type="submit" disabled={busy}>Save dimensions</Button>
      </Card.Footer>
    </form>
  {:else}
    <Card.Footer>
      {#if scale === 'plan'}
        <Button href="/planner?setup=plan">Recalibrate</Button>
      {:else}
        <Button href="/planner">Set the scale on the planner</Button>
      {/if}
    </Card.Footer>
  {/if}
</Card.Root>
