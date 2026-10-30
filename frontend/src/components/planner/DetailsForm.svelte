<script lang="ts">
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { control, field, fields, hint, label, notes, pair, section } from './inspector';
  import type { SelectionDetails } from './selection';

  let { details }: { details: SelectionDetails } = $props();

  let nameField = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!details.focusName || !nameField) return;
    nameField.focus();
    nameField.select();
  });

  function change(field: string, value: string | number) {
    const updateProp = (globalThis as { updateProp?: (field: string, value: string | number) => void }).updateProp;
    updateProp?.(field, value);
  }
</script>

<Field.FieldGroup class="{section} {fields}">
  <Field.Field class={field}>
    <Field.FieldLabel class={label} for="propName">Name</Field.FieldLabel>
    <Input
      id="propName"
      class={control}
      bind:ref={nameField}
      value={details.name}
      oninput={(event) => change('name', event.currentTarget.value)}
    />
  </Field.Field>
  {#if details.showSize}
    <div class={pair}>
      <Field.Field class="{field} min-w-0 flex-1">
        <Field.FieldLabel class={label} for="propWidth">Width (ft)</Field.FieldLabel>
        <Input
          id="propWidth"
          class={control}
          type="number"
          min="1"
          max="40"
          step="0.5"
          value={details.width}
          oninput={(event) => change('w', +event.currentTarget.value)}
        />
      </Field.Field>
      <Field.Field class="{field} min-w-0 flex-1">
        <Field.FieldLabel class={label} for="propLength">Length (ft)</Field.FieldLabel>
        <Input
          id="propLength"
          class={control}
          type="number"
          min="1"
          max="40"
          step="0.5"
          value={details.length}
          oninput={(event) => change('h', +event.currentTarget.value)}
        />
      </Field.Field>
    </div>
    <Field.Description class={hint}>Keep beds 4 ft wide or less so you can reach the center without stepping in.</Field.Description>
  {/if}
  {#if details.showNotes}
    <Field.Field class={field}>
      <Field.FieldLabel class={label} for="propNotes">Notes</Field.FieldLabel>
      <Textarea
        id="propNotes"
        class={notes}
        placeholder="Needs a trellis, full sun, 18 in spacing…"
        value={details.notes}
        oninput={(event) => change('notes', event.currentTarget.value)}
      />
    </Field.Field>
  {/if}
</Field.FieldGroup>
