/** One row leaves the planner at a time. New map items use a negative stand-in id. */

export const SAVE_QUIET_MS = 800;

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * @param {unknown} value
 */
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} value
 */
function amount(value) {
  const number = finite(value);
  return number === null ? 0 : number;
}

/**
 * @param {unknown} value
 */
function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} id
 */
function serverId(id) {
  return Number.isInteger(id) && id > 0;
}

/**
 * @param {{ x?: unknown, y?: unknown, bulge?: unknown } | null | undefined} point
 */
function copyPoint(point) {
  const next = { x: amount(point?.x), y: amount(point?.y) };
  const bulge = finite(point?.bulge);
  if (bulge) next.bulge = bulge;
  return next;
}

/**
 * @param {Record<string, any>} bed
 */
function outlineFrom(bed) {
  const outline = bed.outline && typeof bed.outline === 'object' ? bed.outline : null;
  const source = Array.isArray(bed.points) ? bed.points : outline?.points;
  if (!Array.isArray(source) || source.length < 3) return null;
  /** @type {{ points: { x: number, y: number }[], pivot?: { x: number, y: number } }} */
  const cleaned = { points: source.map(copyPoint) };
  const pivot = bed.pivot || outline?.pivot;
  if (pivot && typeof pivot === 'object') cleaned.pivot = copyPoint(pivot);
  return cleaned;
}

/**
 * @param {Record<string, any>} bed
 */
function bedFrom(bed) {
  const kind = bed.type || bed.kind;
  const type = kind === 'pot' || kind === 'planter' ? kind : 'bed';
  /** @type {Record<string, any>} */
  const row = {
    id: bed.id,
    name: text(bed.name),
    type,
    x: amount(bed.x),
    y: amount(bed.y),
    w: amount(bed.w),
    h: amount(bed.h),
    rotation: amount(bed.rotation),
    color: text(bed.color),
    notes: text(bed.notes),
    plants: Array.isArray(bed.plants) ? bed.plants.filter((name) => typeof name === 'string' && name) : [],
    outline: outlineFrom(bed),
  };
  if (type === 'pot') row.diam = amount(bed.diam ?? bed.w);
  return row;
}

/**
 * @param {Record<string, any>} obstacle
 */
function obstacleFrom(obstacle) {
  return {
    id: obstacle.id,
    name: text(obstacle.name),
    x: amount(obstacle.x),
    y: amount(obstacle.y),
    w: amount(obstacle.w),
    h: amount(obstacle.h),
    rotation: amount(obstacle.rotation),
    color: text(obstacle.color),
  };
}

/**
 * @param {unknown} plot
 */
function plotFrom(plot) {
  if (!plot || typeof plot !== 'object') return null;
  const source = /** @type {Record<string, any>} */ (plot);
  if (!text(source.plotId)) return null;
  return {
    plotId: text(source.plotId),
    photoUrl: text(source.photoUrl) || null,
    widthPx: amount(source.widthPx),
    heightPx: amount(source.heightPx),
    feetPerPixel: amount(source.feetPerPixel),
    calibration: source.calibration && typeof source.calibration === 'object' ? clone(source.calibration) : null,
  };
}

/**
 * Copy the canvas plan into the shape the queue compares.
 * Bed and obstacle ids stay as they are, including a negative stand-in.
 * @param {Record<string, any> | null | undefined} plan
 */
export function sceneFromPlan(plan) {
  const source = plan && typeof plan === 'object' ? plan : {};
  const garden = source.garden && typeof source.garden === 'object' ? source.garden : {};
  const beds = Array.isArray(source.beds) ? source.beds : [];
  const obstacles = Array.isArray(source.obstacles) ? source.obstacles : [];
  return {
    garden: {
      width: finite(garden.width),
      height: finite(garden.height),
      scale: text(garden.scale) || null,
      widthText: text(garden.widthText),
      heightText: text(garden.heightText),
    },
    plot: plotFrom(source.plot),
    beds: beds.filter(Boolean).map(bedFrom),
    obstacles: obstacles.filter(Boolean).map(obstacleFrom),
  };
}

/**
 * @param {'bed' | 'obstacle'} type
 */
function resource(type) {
  return type === 'bed' ? 'beds' : 'obstacles';
}

/**
 * @param {Record<string, any>} bed
 * @param {boolean} includeId
 */
function bedBody(bed, includeId) {
  /** @type {Record<string, any>} */
  const body = {
    name: bed.name,
    kind: bed.type,
    x: bed.x,
    y: bed.y,
    w: bed.w,
    h: bed.h,
  };
  if (bed.type === 'pot') body.diam = bed.diam;
  body.rotation = bed.rotation;
  body.color = bed.color;
  body.notes = bed.notes;
  body.outline = bed.outline;
  if (includeId) body.id = bed.id;
  return body;
}

/**
 * @param {Record<string, any>} obstacle
 * @param {boolean} includeId
 */
function obstacleBody(obstacle, includeId) {
  /** @type {Record<string, any>} */
  const body = {
    name: obstacle.name,
    x: obstacle.x,
    y: obstacle.y,
    w: obstacle.w,
    h: obstacle.h,
    rotation: obstacle.rotation,
    color: obstacle.color,
  };
  if (includeId) body.id = obstacle.id;
  return body;
}

/**
 * @param {'bed' | 'obstacle'} type
 * @param {Record<string, any>} row
 * @param {boolean} includeId
 */
function rowBody(type, row, includeId) {
  return type === 'bed' ? bedBody(row, includeId) : obstacleBody(row, includeId);
}

/**
 * @param {Record<string, any> | null | undefined} body
 */
function withoutId(body) {
  if (!body) return {};
  const copy = { ...body };
  delete copy.id;
  return copy;
}

/**
 * @param {Record<string, any> | null | undefined} body
 */
function signatureOf(body) {
  return JSON.stringify(withoutId(body));
}

/**
 * @param {Record<string, any> | null | undefined} left
 * @param {Record<string, any> | null | undefined} right
 */
function sameBody(left, right) {
  return signatureOf(left) === signatureOf(right);
}

/**
 * @param {Record<string, any>} scene
 */
function settingsBody(scene) {
  return {
    garden: {
      width: scene.garden.width,
      height: scene.garden.height,
      scale: scene.garden.scale,
      widthText: scene.garden.widthText,
      heightText: scene.garden.heightText,
    },
    plot: scene.plot ? {
      plotId: scene.plot.plotId,
      photoUrl: scene.plot.photoUrl,
      widthPx: scene.plot.widthPx,
      heightPx: scene.plot.heightPx,
      feetPerPixel: scene.plot.feetPerPixel,
      calibration: clone(scene.plot.calibration),
    } : null,
  };
}

/**
 * @param {Record<string, any>[]} beds
 */
function plantsBody(beds) {
  /** @type {Record<string, string[]>} */
  const body = {};
  const rows = beds.filter((bed) => serverId(bed.id) && bed.plants.length > 0);
  rows.sort((left, right) => left.id - right.id);
  for (const bed of rows) body[String(bed.id)] = [...bed.plants];
  return body;
}


/**
 * Write a returned id onto the live row, the selection, and every undo
 * snapshot that still holds the stand-in. Bed 2 and obstacle 2 stay distinct.
 * @param {{ beds?: Record<string, any>[], obstacles?: Record<string, any>[], selectedObj?: { type?: string, id?: number | string } | null, undo?: { beds?: Record<string, any>[], obstacles?: Record<string, any>[] }[] }} holder
 * @param {'bed' | 'obstacle'} type
 * @param {number | string} from
 * @param {number} to
 */
export function stampStandIn(holder, type, from, to) {
  const list = type === 'obstacle' ? holder.obstacles : holder.beds;
  for (const item of list || []) {
    if (item && item.id === from) item.id = to;
  }
  if (holder.selectedObj && holder.selectedObj.type === type && holder.selectedObj.id === from) {
    holder.selectedObj = { type, id: to };
  }
  for (const snap of holder.undo || []) {
    const rows = type === 'obstacle' ? snap.obstacles : snap.beds;
    for (const item of rows || []) {
      if (item && item.id === from) item.id = to;
    }
  }
  return holder;
}

/**
 * Remember server rows and decide which single-row requests are ready.
 * Time is passed in so a test can move the quiet period without a clock.
 */
export function createSaveQueue() {
  let baselined = false;
  /** @type {ReturnType<typeof sceneFromPlan>} */
  let latest = sceneFromPlan(null);
  /** @type {Map<number, Record<string, any>>} */
  let savedBeds = new Map();
  /** @type {Map<number, Record<string, any>>} */
  let savedObstacles = new Map();
  /** @type {Record<string, string[]>} */
  let savedPlants = {};
  /** @type {ReturnType<typeof settingsBody>} */
  let savedSettings = settingsBody(latest);
  /** @type {Map<string, any>} */
  const pending = new Map();
  /** @type {Map<string, any>} */
  const inflight = new Map();
  let attemptSeq = 0;

  /**
   * @param {ReturnType<typeof sceneFromPlan>} scene
   */
  function remember(scene) {
    savedBeds = new Map();
    savedObstacles = new Map();
    for (const bed of scene.beds) {
      if (serverId(bed.id)) savedBeds.set(bed.id, bedBody(bed, true));
    }
    for (const obstacle of scene.obstacles) {
      if (serverId(obstacle.id)) savedObstacles.set(obstacle.id, obstacleBody(obstacle, true));
    }
    savedPlants = plantsBody(scene.beds);
    savedSettings = settingsBody(scene);
  }

  /**
   * @param {any} job
   * @param {number} now
   */
  function place(job, now) {
    const prev = pending.get(job.key);
    if (prev && prev.op === job.op && prev.signature === job.signature) {
      job.readyAt = prev.readyAt;
      job.paused = !!prev.paused;
    } else if (job.immediate) {
      job.readyAt = now;
      job.paused = false;
    } else {
      job.readyAt = now + SAVE_QUIET_MS;
      job.paused = false;
    }
    pending.set(job.key, job);
  }

  /**
   * @param {'bed' | 'obstacle'} type
   * @param {Record<string, any>} row
   */
  function insertJob(type, row) {
    const body = rowBody(type, row, false);
    return {
      key: `${type}:${row.id}`,
      type,
      id: row.id,
      op: 'insert',
      method: 'PUT',
      path: `/${resource(type)}`,
      body,
      immediate: true,
      signature: signatureOf(body),
      blocked: false,
    };
  }

  /**
   * @param {'bed' | 'obstacle'} type
   * @param {Record<string, any>} row
   */
  function updateJob(type, row) {
    const body = rowBody(type, row, true);
    return {
      key: `${type}:${row.id}`,
      type,
      id: row.id,
      op: 'update',
      method: 'PUT',
      path: `/${resource(type)}/${row.id}`,
      body,
      immediate: false,
      signature: signatureOf(body),
      blocked: false,
    };
  }

  /**
   * @param {'bed' | 'obstacle'} type
   * @param {number} id
   */
  function deleteJob(type, id) {
    return {
      key: `${type}:${id}`,
      type,
      id,
      op: 'delete',
      method: 'DELETE',
      path: `/${resource(type)}/${id}`,
      body: null,
      immediate: true,
      signature: 'delete',
      blocked: false,
    };
  }

  /**
   * A deleted row is back on the canvas. A bed keeps its id, because the
   * calendar still names it. An obstacle was removed outright, so it is inserted
   * again and the new id is stamped onto the canvas.
   * @param {'bed' | 'obstacle'} type
   * @param {Record<string, any>} row
   */
  function restoreJob(type, row) {
    if (type === 'obstacle') return insertJob(type, row);
    const job = updateJob(type, row);
    job.immediate = true;
    return job;
  }

  /**
   * @param {'bed' | 'obstacle'} type
   * @param {Record<string, any>} row
   * @param {number} now
   * @param {any} prev
   */
  function followUpdate(type, row, now, prev) {
    const job = updateJob(type, row);
    job.readyAt = prev && prev.signature === job.signature ? prev.readyAt : now + SAVE_QUIET_MS;
    job.paused = false;
    return job;
  }

  /**
   * @param {'bed' | 'obstacle'} type
   * @param {Record<string, any>[]} rows
   * @param {Map<number, Record<string, any>>} saved
   * @param {number} now
   */
  function syncRows(type, rows, saved, now) {
    /** @type {Set<unknown>} */
    const seen = new Set();
    for (const row of rows) {
      seen.add(row.id);
      const key = `${type}:${row.id}`;
      const flight = inflight.get(key);
      if (flight && (flight.op === 'insert' || flight.op === 'update')) {
        flight.cancelWhenDone = false;
        const current = rowBody(type, row, flight.op === 'update');
        flight.next = sameBody(flight.body, current) ? null : followUpdate(type, row, now, flight.next);
        continue;
      }
      if (flight && flight.op === 'delete') {
        // Ctrl+Z brought the row back while the delete is still on the wire.
        // Restore it as soon as that delete finishes, or the canvas and the
        // server stay out of sync until the next reload.
        const restore = restoreJob(type, row);
        restore.readyAt = now;
        restore.paused = false;
        flight.next = restore;
        continue;
      }

      const known = saved.get(row.id);
      if (!known) {
        // A new stand-in is inserted. A row that already had a server id and
        // then left the saved set was deleted; seeing it again is an undo.
        place(serverId(row.id) ? restoreJob(type, row) : insertJob(type, row), now);
        continue;
      }
      const current = rowBody(type, row, true);
      const waiting = pending.get(key);
      if (waiting && waiting.op === 'delete') {
        // Delete was queued but not sent. Drop it; keep an edit if one is needed.
        if (!sameBody(known, current)) place(updateJob(type, row), now);
        else pending.delete(key);
        continue;
      }
      if (!sameBody(known, current)) place(updateJob(type, row), now);
      else if (pending.has(key)) pending.delete(key);
    }

    for (const id of saved.keys()) {
      if (seen.has(id)) continue;
      const key = `${type}:${id}`;
      const flight = inflight.get(key);
      if (flight) {
        flight.cancelWhenDone = true;
        flight.next = null;
        continue;
      }
      place(deleteJob(type, id), now);
    }

    for (const flight of inflight.values()) {
      if (flight.type !== type || flight.op !== 'insert') continue;
      if (!seen.has(flight.id)) {
        flight.cancelWhenDone = true;
        flight.next = null;
      }
    }

    for (const [key, job] of pending) {
      if (job.type === type && job.op === 'insert' && !seen.has(job.id)) pending.delete(key);
    }
  }

  /**
   * @param {number} bedId
   * @param {string} name
   * @param {'assign' | 'archive'} op
   */
  function cropJob(bedId, name, op) {
    const archive = op === 'archive';
    return {
      key: `crop:${bedId}:${name}`,
      type: 'crop',
      id: bedId,
      op,
      method: 'PUT',
      path: archive ? `/beds/${bedId}/crops/archive` : `/beds/${bedId}/crops`,
      body: { name },
      immediate: false,
      signature: `${op}:${name}`,
      blocked: false,
    };
  }

  /**
   * @param {number} now
   */
  function syncPlants(now) {
    /** @type {Record<string, string[]>} */
    const current = {};
    for (const bed of latest.beds) {
      if (bed.plants.length) current[String(bed.id)] = [...bed.plants];
    }
    /** @type {Map<string, ReturnType<typeof cropJob>>} */
    const wanted = new Map();
    const bedIds = new Set([...Object.keys(savedPlants), ...Object.keys(current)]);
    for (const idText of bedIds) {
      const bedId = Number(idText);
      const next = current[idText] || [];
      const prev = savedPlants[idText] || [];
      for (const name of next) {
        if (!prev.includes(name)) wanted.set(`crop:${bedId}:${name}`, cropJob(bedId, name, 'assign'));
      }
      for (const name of prev) {
        if (!next.includes(name)) wanted.set(`crop:${bedId}:${name}`, cropJob(bedId, name, 'archive'));
      }
    }
    for (const key of [...pending.keys()]) {
      const job = pending.get(key);
      if (job.type === 'crop' && !wanted.has(key)) pending.delete(key);
    }
    for (const [key, job] of wanted) {
      job.blocked = !serverId(job.id);
      const flight = inflight.get(key);
      if (flight) {
        if (flight.op === job.op) flight.next = null;
        else {
          const follow = { ...job, readyAt: now + SAVE_QUIET_MS, paused: false };
          flight.next = follow;
        }
        continue;
      }
      place(job, now);
    }
  }

  /**
   * @param {number} now
   */
  function syncSettings(now) {
    const body = settingsBody(latest);
    syncDocument('settings', {
      changed: JSON.stringify(body) !== JSON.stringify(savedSettings),
      path: '/garden',
      body,
      signature: JSON.stringify(body),
      blocked: false,
    }, now);
  }

  /**
   * @param {string} key
   * @param {{ changed: boolean, path: string, body: any, signature: string, blocked: boolean }} spec
   * @param {number} now
   */
  function syncDocument(key, spec, now) {
    const flight = inflight.get(key);
    if (!spec.changed) {
      if (flight) flight.next = null;
      else pending.delete(key);
      return;
    }
    const job = {
      key,
      type: key,
      id: null,
      op: key,
      method: 'PUT',
      path: spec.path,
      body: spec.body,
      immediate: false,
      signature: spec.signature,
      blocked: spec.blocked,
    };
    if (flight) {
      job.readyAt = flight.next && flight.next.signature === job.signature
        ? flight.next.readyAt
        : now + SAVE_QUIET_MS;
      job.paused = false;
      flight.next = job;
      return;
    }
    place(job, now);
  }

  /**
   * @param {number} now
   */
  function reconcile(now) {
    syncRows('bed', latest.beds, savedBeds, now);
    syncRows('obstacle', latest.obstacles, savedObstacles, now);
    syncPlants(now);
    syncSettings(now);
  }

  /**
   * @param {'bed' | 'obstacle'} type
   * @param {number | string} from
   * @param {number} to
   */
  function rewrite(type, from, to) {
    const rows = type === 'bed' ? latest.beds : latest.obstacles;
    for (const row of rows) {
      if (row.id === from) row.id = to;
    }
    if (type !== 'bed') return;
    for (const [key, job] of [...pending.entries()]) {
      if (job.type !== 'crop' || job.id !== from) continue;
      pending.delete(key);
      job.id = to;
      job.key = `crop:${to}:${job.body.name}`;
      job.path = job.op === 'archive' ? `/beds/${to}/crops/archive` : `/beds/${to}/crops`;
      job.blocked = false;
      pending.set(job.key, job);
    }
  }

  /**
   * @param {any} job
   */
  function requestFrom(job) {
    return {
      key: job.key,
      attempt: job.attempt,
      method: job.method,
      path: job.path,
      body: job.body,
      type: job.type,
      id: job.id,
      op: job.op,
    };
  }

  return {
    /**
     * The scene already stored on the server. Later notes diff against it.
     * @param {Record<string, any> | null | undefined} plan
     */
    baseline(plan) {
      latest = sceneFromPlan(plan);
      remember(latest);
      baselined = true;
      pending.clear();
    },

    /**
     * @param {Record<string, any> | null | undefined} plan
     * @param {number} now
     */
    observe(plan, now) {
      latest = sceneFromPlan(plan);
      if (!baselined) {
        remember(latest);
        baselined = true;
        return;
      }
      reconcile(now);
    },

    /**
     * Requests whose quiet period has elapsed and which are not waiting on an insert.
     * Taking one marks it in flight so a second call does not send it again.
     * @param {number} now
     */
    take(now) {
      /** @type {ReturnType<typeof requestFrom>[]} */
      const ready = [];
      for (const job of [...pending.values()]) {
        if (job.paused || job.blocked) continue;
        if (job.readyAt > now) continue;
        if (inflight.has(job.key)) continue;
        pending.delete(job.key);
        const flying = {
          ...job,
          body: clone(job.body),
          attempt: ++attemptSeq,
          next: null,
          cancelWhenDone: false,
        };
        inflight.set(job.key, flying);
        ready.push(requestFrom(flying));
      }
      return ready;
    },

    /**
     * @param {number} now
     * @returns {number | null}
     */
    nextDelay(now) {
      let delay = null;
      for (const job of pending.values()) {
        if (job.paused || job.blocked) continue;
        const wait = job.readyAt - now;
        if (wait <= 0) continue;
        if (delay === null || wait < delay) delay = wait;
      }
      return delay;
    },

    /**
     * Send every waiting row now. A follow-up that still needs its insert
     * stays held, and leaves as soon as that insert returns.
     * @param {number} now
     */
    flush(now) {
      for (const job of pending.values()) {
        job.readyAt = now;
        job.paused = false;
      }
      for (const flight of inflight.values()) {
        if (!flight.next) continue;
        flight.next.readyAt = now;
        flight.next.paused = false;
      }
    },

    /**
     * @param {{ key: string, attempt: number }} request
     * @param {{ id?: number } | null | undefined} row
     * @param {number} now
     * @returns {{ stamp: { type: 'bed' | 'obstacle', from: number | string, to: number } | null, alert: boolean }}
     */
    succeeded(request, row, now) {
      const flight = inflight.get(request.key);
      if (!flight || flight.attempt !== request.attempt) return { stamp: null, alert: false };

      /** @type {{ type: 'bed' | 'obstacle', from: number | string, to: number } | null} */
      let stamp = null;
      if (flight.op === 'insert') {
        const realId = row && Number.isInteger(row.id) ? row.id : null;
        if (!serverId(realId)) {
          inflight.delete(request.key);
          flight.paused = true;
          flight.next = null;
          pending.set(flight.key, flight);
          return { stamp: null, alert: true };
        }
        stamp = { type: flight.type, from: flight.id, to: realId };
        rewrite(flight.type, flight.id, realId);
        const stored = { ...clone(flight.body), id: realId };
        const saved = flight.type === 'bed' ? savedBeds : savedObstacles;
        saved.set(realId, stored);
        inflight.delete(request.key);
        if (flight.cancelWhenDone) {
          const removal = deleteJob(flight.type, realId);
          removal.readyAt = now;
          removal.paused = false;
          pending.set(removal.key, removal);
        } else if (flight.next) {
          const follow = flight.next;
          follow.key = `${flight.type}:${realId}`;
          follow.id = realId;
          follow.path = `/${resource(flight.type)}/${realId}`;
          follow.body = { ...follow.body, id: realId };
          follow.blocked = false;
          pending.set(follow.key, follow);
        }
      } else if (flight.op === 'update') {
        const saved = flight.type === 'bed' ? savedBeds : savedObstacles;
        saved.set(flight.id, clone(flight.body));
        inflight.delete(request.key);
        if (flight.cancelWhenDone) {
          const removal = deleteJob(flight.type, flight.id);
          removal.readyAt = now;
          removal.paused = false;
          pending.set(removal.key, removal);
        } else if (flight.next) {
          pending.set(flight.key, flight.next);
        }
      } else if (flight.op === 'delete') {
        const saved = flight.type === 'bed' ? savedBeds : savedObstacles;
        saved.delete(flight.id);
        if (flight.type === 'bed') delete savedPlants[String(flight.id)];
        const follow = flight.next;
        inflight.delete(request.key);
        if (follow) pending.set(flight.key, follow);
      } else if (flight.op === 'assign' || flight.op === 'archive') {
        const id = String(flight.id);
        const names = [...(savedPlants[id] || [])];
        const name = flight.body.name;
        if (flight.op === 'assign') {
          if (!names.includes(name)) names.push(name);
        } else {
          const index = names.indexOf(name);
          if (index >= 0) names.splice(index, 1);
        }
        if (names.length) savedPlants[id] = names;
        else delete savedPlants[id];
        inflight.delete(request.key);
        if (flight.next) pending.set(flight.key, flight.next);
      } else if (flight.op === 'settings') {
        savedSettings = clone(flight.body);
        inflight.delete(request.key);
        if (flight.next) pending.set(flight.key, flight.next);
      }

      reconcile(now);
      return { stamp, alert: false };
    },

    /**
     * The request failed. Returns true once, so the host raises one alert.
     * @param {{ key: string, attempt: number }} request
     */
    failed(request) {
      const flight = inflight.get(request.key);
      if (!flight || flight.attempt !== request.attempt) return false;
      inflight.delete(request.key);
      const job = flight.next ? { ...flight.next } : { ...flight };
      if (flight.next && flight.op === 'insert') {
        job.key = flight.key;
        job.id = flight.id;
        job.op = 'insert';
        job.method = 'PUT';
        job.path = `/${resource(flight.type)}`;
        job.body = withoutId(flight.next.body);
        job.signature = signatureOf(job.body);
        job.immediate = true;
        job.blocked = false;
      }
      job.next = null;
      job.cancelWhenDone = false;
      job.paused = true;
      pending.set(job.key, job);
      return true;
    },
  };
}
