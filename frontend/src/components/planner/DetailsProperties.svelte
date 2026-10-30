<script lang="ts">
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { control, field, fields, hint, label, pair, section } from './inspector';
  import type { SelectionDetails } from './selection';

  let { details }: { details: SelectionDetails } = $props();

  const diameters = [
    { value: '1', label: '1 ft (12")' },
    { value: '1.5', label: '1.5 ft (18")' },
    { value: '2', label: '2 ft (24")' },
    { value: '2.5', label: '2.5 ft (30")' },
    { value: '3', label: '3 ft (36")' },
  ];

  const presets = [
    { length: 24, width: 8 },
    { length: 36, width: 12 },
    { length: 48, width: 16 },
  ];

  const preset = $derived.by(() => {
    const match = presets.find(
      (size) => size.length === details.planterLength && size.width === details.planterWidth,
    );
    return match ? `${match.length}x${match.width}` : '';
  });

  function setDiameter(value: string) {
    const updatePotDiam = (globalThis as { updatePotDiam?: (val: number) => void }).updatePotDiam;
    updatePotDiam?.(Number(value));
  }

  function setInches(axis: 'w' | 'h', value: string) {
    const updatePlanterInches = (globalThis as {
      updatePlanterInches?: (axis: 'w' | 'h', inches: string) => void;
    }).updatePlanterInches;
    updatePlanterInches?.(axis, value);
  }

  function applyPreset(value: string) {
    const match = presets.find((size) => `${size.length}x${size.width}` === value);
    if (!match) return;
    const applyPlanterPreset = (globalThis as {
      applyPlanterPreset?: (lengthIn: number, widthIn: number) => void;
    }).applyPlanterPreset;
    applyPlanterPreset?.(match.length, match.width);
  }

  function setRotation(value: string) {
    const updateRotation = (globalThis as { updateRotation?: (deg: string) => void }).updateRotation;
    updateRotation?.(value);
  }

  function setPosition(field: 'x' | 'y', value: string) {
    const updateProp = (globalThis as { updateProp?: (field: string, value: number) => void }).updateProp;
    updateProp?.(field, +value);
  }
</script>

{#if details.showPoly || details.showPot || details.showPlanter || details.showRotation || details.showPosition}
  <Field.FieldGroup class="{section} {fields}">
    {#if details.showPoly}
      <Field.Description class={hint}>{details.polyStats}</Field.Description>
      {#if details.neighborNote}
        <Field.Error class={hint}>{details.neighborNote}</Field.Error>
      {/if}
    {/if}

    {#if details.showPot}
      <Field.Field class={field}>
        <Field.FieldLabel class={label} for="propDiam">Diameter</Field.FieldLabel>
        <Select.Root type="single" value={String(details.diameter)} onValueChange={setDiameter}>
          <Select.Trigger id="propDiam" class="{control} w-full">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each diameters as size (size.value)}
                <Select.Item value={size.value} label={size.label}>{size.label}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Field.Field>
    {/if}

    {#if details.showPlanter}
      <Field.Field class={field}>
        <Field.FieldLabel class={label}>Size presets</Field.FieldLabel>
        <ToggleGroup.Root
          type="single"
          variant="outline"
          size="sm"
          class="w-full"
          value={preset}
          onValueChange={applyPreset}
        >
          {#each presets as size (`${size.length}x${size.width}`)}
            <ToggleGroup.Item class="h-7 flex-1 px-1 text-xs" value="{size.length}x{size.width}">
              {size.length}×{size.width}"
            </ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>
      </Field.Field>
      <div class={pair}>
        <Field.Field class="{field} min-w-0 flex-1">
          <Field.FieldLabel class={label} for="propPlanterL">Length (in)</Field.FieldLabel>
          <Input
            id="propPlanterL"
            class={control}
            type="number"
            min="4"
            max="240"
            step="1"
            value={details.planterLength}
            oninput={(event) => setInches('w', event.currentTarget.value)}
          />
        </Field.Field>
        <Field.Field class="{field} min-w-0 flex-1">
          <Field.FieldLabel class={label} for="propPlanterW">Width (in)</Field.FieldLabel>
          <Input
            id="propPlanterW"
            class={control}
            type="number"
            min="4"
            max="240"
            step="1"
            value={details.planterWidth}
            oninput={(event) => setInches('h', event.currentTarget.value)}
          />
        </Field.Field>
      </div>
    {/if}

    {#if details.showRotation}
      <Field.Field class={field}>
        <Field.FieldLabel class={label} for="propRot">Angle (°)</Field.FieldLabel>
        <Input
          id="propRot"
          class={control}
          type="number"
          min="0"
          max="359"
          step="1"
          value={details.rotation}
          oninput={(event) => setRotation(event.currentTarget.value)}
        />
        <Field.Description class={hint}>Drag the turn handle. Hold Shift to snap to 15°.</Field.Description>
      </Field.Field>
    {/if}

    {#if details.showPosition}
      <div class={pair}>
        <Field.Field class="{field} min-w-0 flex-1">
          <Field.FieldLabel class={label} for="propX">X from left (ft)</Field.FieldLabel>
          <Input
            id="propX"
            class={control}
            type="number"
            min="0"
            step="0.1"
            value={details.x}
            oninput={(event) => setPosition('x', event.currentTarget.value)}
          />
        </Field.Field>
        <Field.Field class="{field} min-w-0 flex-1">
          <Field.FieldLabel class={label} for="propY">Y from top (ft)</Field.FieldLabel>
          <Input
            id="propY"
            class={control}
            type="number"
            min="0"
            step="0.1"
            value={details.y}
            oninput={(event) => setPosition('y', event.currentTarget.value)}
          />
        </Field.Field>
      </div>
    {/if}
  </Field.FieldGroup>
{/if}
