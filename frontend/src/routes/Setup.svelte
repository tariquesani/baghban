<script lang="ts">
  import SetupAccount from '../components/setup/SetupAccount.svelte';
  import SetupApiToken from '../components/setup/SetupApiToken.svelte';
  import SetupName from '../components/setup/SetupName.svelte';
  import SetupOrphans from '../components/setup/SetupOrphans.svelte';
  import SetupPlace from '../components/setup/SetupPlace.svelte';
  import SetupReset from '../components/setup/SetupReset.svelte';
  import SetupSize from '../components/setup/SetupSize.svelte';
  import SetupUproot from '../components/setup/SetupUproot.svelte';
  import * as Tabs from '$lib/components/ui/tabs';
  import { readApiToken, regenerateApiToken, updateCredentials } from '$lib/api/auth.js';
  import { listOrphanBeds, purgeOrphanBed } from '$lib/api/beds.js';
  import { readGarden, resetGarden, saveGardenSize, saveIdentity, uprootAllPlants } from '$lib/api/garden.js';
  import { toast } from 'svelte-sonner';
  import {
    identityFields,
    nameFields,
    nameProblem,
    placeBody,
  } from '$lib/domain/gardenIdentity.js';
  import { gardenSizeLabel, itemsOutside, parseDimension } from '$lib/domain/scale.js';

  type GardenPayload = {
    garden: {
      scale?: string | null;
      widthText?: string;
      heightText?: string;
      width?: number | null;
      height?: number | null;
      name?: string;
      subtitle?: string;
      latitude?: number | null;
      longitude?: number | null;
      timezone?: string;
    };
    plot: Record<string, unknown> | null;
    beds: Record<string, unknown>[];
    obstacles: Record<string, unknown>[];
  };

  let {
    username = '',
    onUsername,
  }: {
    username?: string;
    onUsername?: (username: string) => void;
  } = $props();

  let ready = $state(false);
  let loadError = $state('');
  let busy = $state('');
  let name = $state('');
  let subtitle = $state('');
  let latitude = $state('');
  let longitude = $state('');
  let saved = $state(identityFields(null));
  let scale = $state<string | null>(null);
  let sizeLabel = $state('');
  let widthText = $state('');
  let heightText = $state('');
  let plot = $state<Record<string, unknown> | null>(null);
  let beds = $state<Record<string, unknown>[]>([]);
  let obstacles = $state<Record<string, unknown>[]>([]);
  let outside = $state<{ id: string; name: string }[]>([]);
  let nameError = $state('');
  let placeError = $state('');
  let sizeError = $state('');
  let orphanError = $state('');
  let accountError = $state('');
  let apiToken = $state('');
  let apiTokenManagedByEnv = $state(false);
  let apiTokenError = $state('');
  let orphans = $state<{ id: number; name: string; kind: string }[]>([]);

  let placed = $derived(saved.latitude !== '' || saved.longitude !== '');

  function applyIdentity(garden: GardenPayload['garden'] | undefined) {
    saved = identityFields(garden);
  }

  function applyPlan(payload: GardenPayload | null) {
    const garden = payload?.garden;
    scale = garden?.scale || null;
    sizeLabel = gardenSizeLabel(garden);
    widthText = garden?.widthText || '';
    heightText = garden?.heightText || '';
    plot = payload?.plot ?? null;
    beds = payload?.beds ?? [];
    obstacles = payload?.obstacles ?? [];
  }

  function fillIdentity() {
    name = saved.name;
    subtitle = saved.subtitle;
    latitude = saved.latitude;
    longitude = saved.longitude;
  }

  function failure(err: unknown, fallback: string) {
    return err instanceof Error && err.message ? err.message : fallback;
  }

  async function loadOrphans() {
    try {
      const rows = await listOrphanBeds();
      orphans = Array.isArray(rows)
        ? rows.flatMap((row) => {
            if (!row || typeof row !== 'object') return [];
            if (typeof row.id !== 'number' || typeof row.kind !== 'string') return [];
            return [{
              id: row.id,
              name: typeof row.name === 'string' ? row.name : '',
              kind: row.kind,
            }];
          })
        : [];
      orphanError = '';
    } catch (err) {
      orphanError = failure(err, 'Could not load orphan beds');
    }
  }

  async function loadApiToken() {
    try {
      const payload = await readApiToken() as {
        token?: string;
        managedByEnv?: boolean;
      };
      apiToken = typeof payload?.token === 'string' ? payload.token : '';
      apiTokenManagedByEnv = payload?.managedByEnv === true;
      apiTokenError = '';
    } catch (err) {
      apiToken = '';
      apiTokenManagedByEnv = false;
      apiTokenError = failure(err, 'Could not load the API token');
    }
  }

  async function load() {
    try {
      const payload = await readGarden() as GardenPayload | null;
      applyIdentity(payload?.garden);
      applyPlan(payload);
      fillIdentity();
      outside = [];
      loadError = '';
      ready = true;
      void loadOrphans();
      void loadApiToken();
    } catch (err) {
      loadError = failure(err, 'Could not load setup');
    }
  }

  async function purgeOrphan(id: number) {
    if (busy) return;
    busy = 'orphan';
    orphanError = '';
    try {
      await purgeOrphanBed(id);
      orphans = orphans.filter((bed) => bed.id !== id);
      toast.success('Purged orphan bed');
    } catch (err) {
      orphanError = failure(err, 'Could not purge this bed');
      void loadOrphans();
    } finally {
      busy = '';
    }
  }

  async function saveName() {
    if (busy) return;
    const problem = nameProblem(name, subtitle);
    if (problem) {
      nameError = problem;
      return;
    }
    const place = placeBody(saved.latitude, saved.longitude);
    if (!place.body) {
      nameError = place.error ?? 'A place needs a latitude and a longitude.';
      return;
    }
    nameError = '';
    busy = 'name';
    try {
      const payload = await saveIdentity({ ...nameFields(name, subtitle), ...place.body }) as GardenPayload;
      applyIdentity(payload.garden);
      name = saved.name;
      subtitle = saved.subtitle;
      toast.success(saved.name ? `Saved ${saved.name}` : 'Saved');
    } catch (err) {
      nameError = failure(err, 'Could not save the name');
    } finally {
      busy = '';
    }
  }

  async function savePlace() {
    if (busy) return;
    const place = placeBody(latitude, longitude);
    if (!place.body) {
      placeError = place.error ?? 'A place needs a latitude and a longitude.';
      return;
    }
    const problem = nameProblem(saved.name, saved.subtitle);
    if (problem) {
      placeError = problem;
      return;
    }
    placeError = '';
    busy = 'place';
    try {
      const payload = await saveIdentity({ ...nameFields(saved.name, saved.subtitle), ...place.body }) as GardenPayload;
      applyIdentity(payload.garden);
      latitude = saved.latitude;
      longitude = saved.longitude;
      toast.success(
        place.body.latitude == null
          ? 'Place cleared'
          : saved.timezone ? `Saved ${saved.timezone}` : 'Saved',
      );
    } catch (err) {
      placeError = failure(err, 'Could not save the place');
    } finally {
      busy = '';
    }
  }

  function clearPlace() {
    latitude = '';
    longitude = '';
    void savePlace();
  }

  async function saveSize() {
    if (busy) return;
    const width = parseDimension(widthText);
    const length = parseDimension(heightText);
    if (!width || !length) {
      sizeError = 'Enter a width and length in feet, from 1 to 500.';
      outside = [];
      return;
    }
    sizeError = '';
    busy = 'size';
    try {
      const payload = await saveGardenSize(
        { width: width.value, height: height.value, widthText: width.text, heightText: length.text },
        plot,
      ) as GardenPayload;
      applyPlan(payload);
      outside = itemsOutside(payload.beds, payload.obstacles, width.value, length.value);
      toast.success(sizeLabel ? `Saved ${sizeLabel}` : 'Saved');
    } catch (err) {
      sizeError = failure(err, 'Could not save the dimensions');
    } finally {
      busy = '';
    }
  }

  async function clearAllPlants() {
    if (busy) return;
    busy = 'uproot';
    try {
      const payload = await uprootAllPlants() as GardenPayload | null;
      applyIdentity(payload?.garden);
      applyPlan(payload);
      loadError = '';
      toast.success('Uprooted all plants');
    } catch (err) {
      loadError = failure(err, 'Could not uproot the plants');
    } finally {
      busy = '';
    }
  }

  async function startAgain() {
    if (busy) return;
    busy = 'reset';
    try {
      const payload = await resetGarden() as GardenPayload | null;
      applyIdentity(payload?.garden);
      applyPlan(payload);
      outside = [];
      sizeError = '';
      loadError = '';
      toast.success('Started again');
      void loadOrphans();
    } catch (err) {
      loadError = failure(err, 'Could not reset the garden');
    } finally {
      busy = '';
    }
  }

  async function saveAccount(payload: {
    currentPassword: string;
    username?: string;
    newPassword?: string;
  }) {
    if (busy) return;
    busy = 'account';
    accountError = '';
    try {
      const result = await updateCredentials(payload) as { username?: string };
      const next = typeof result?.username === 'string' ? result.username : username;
      onUsername?.(next);
      toast.success('Saved account');
    } catch (err) {
      accountError = failure(err, 'Could not update account');
    } finally {
      busy = '';
    }
  }

  async function regenerateToken() {
    if (busy || apiTokenManagedByEnv) return;
    busy = 'token';
    apiTokenError = '';
    try {
      const payload = await regenerateApiToken() as {
        token?: string;
        managedByEnv?: boolean;
      };
      apiToken = typeof payload?.token === 'string' ? payload.token : '';
      apiTokenManagedByEnv = payload?.managedByEnv === true;
      toast.success('Regenerated API token');
    } catch (err) {
      apiTokenError = failure(err, 'Could not regenerate the API token');
      void loadApiToken();
    } finally {
      busy = '';
    }
  }

  void load();
</script>

<main class="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 pt-2 pb-8">
  {#if loadError}<p class="text-sm text-destructive" role="alert">{loadError}</p>{/if}
  {#if ready}
    <Tabs.Root value="name" class="gap-4">
      <Tabs.List class="grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tabs.Trigger value="name">Name</Tabs.Trigger>
        <Tabs.Trigger value="place">Place</Tabs.Trigger>
        <Tabs.Trigger value="size">Size</Tabs.Trigger>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="orphans">Orphans</Tabs.Trigger>
        <Tabs.Trigger value="again">Start again</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="name">
        <SetupName
          bind:name
          bind:subtitle
          error={nameError}
          busy={busy !== ''}
          onSave={saveName}
        />
      </Tabs.Content>
      <Tabs.Content value="place">
        <SetupPlace
          bind:latitude
          bind:longitude
          timezone={saved.timezone}
          {placed}
          error={placeError}
          busy={busy !== ''}
          onSave={savePlace}
          onClear={clearPlace}
        />
      </Tabs.Content>
      <Tabs.Content value="size">
        <SetupSize
          {scale}
          {sizeLabel}
          bind:widthText
          bind:heightText
          error={sizeError}
          {outside}
          busy={busy !== ''}
          onSave={saveSize}
        />
      </Tabs.Content>
      <Tabs.Content value="account" class="flex flex-col gap-4">
        <SetupAccount
          {username}
          error={accountError}
          busy={busy !== ''}
          onSave={saveAccount}
        />
        <SetupApiToken
          token={apiToken}
          managedByEnv={apiTokenManagedByEnv}
          error={apiTokenError}
          busy={busy !== ''}
          onRegenerate={regenerateToken}
        />
      </Tabs.Content>
      <Tabs.Content value="orphans">
        <SetupOrphans
          beds={orphans}
          busy={busy !== ''}
          error={orphanError}
          onPurge={purgeOrphan}
        />
      </Tabs.Content>
      <Tabs.Content value="again" class="flex flex-col gap-4">
        <SetupUproot busy={busy !== ''} onUproot={clearAllPlants} />
        <SetupReset busy={busy !== ''} onReset={startAgain} />
      </Tabs.Content>
    </Tabs.Root>
  {:else if !loadError}
    <p class="text-sm text-muted-foreground">Loading setup…</p>
  {/if}
</main>
