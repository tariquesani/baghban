# Docker / CasaOS deployment

Baghban runs in a thin container image that syncs application code from GitHub on every start. The garden database and photos stay on the bind mount.

**Web UI:** `http://<host-ip>:6060`

## How it works

On each container start:

1. Clone or hard-reset the source repo into `/app` (bind-mounted on the host)
2. `pip install -r backend/requirements.txt`
3. `npm ci` in `frontend/` when `package-lock.json` changed, then `npm run build`
4. Start uvicorn (`app:app` on port `6060`)

The GHCR image contains Python, Node, git, and the entrypoint script. It does not contain the application code.

| Asset | In GHCR image? | Where it lives |
|-------|----------------|----------------|
| Application code | No | Cloned at runtime into `/DATA/AppData/baghban` |
| `BAGHBAN_GIT_TOKEN` | No | CasaOS app environment (runtime only) |
| `backend/data/baghban.db` and `backend/data/photos/` | No | Created by the app on the bind mount |
| Built frontend (`frontend/dist`) | No | Built on the bind mount at startup |
| Entrypoint script | Yes | Baked into the image |

Default settings:

- **Image:** `ghcr.io/tariquesani/baghban:master`
- **Source repo:** `https://github.com/tariquesani/baghban.git`
- **Branch:** `master`

`git reset --hard` on startup does not remove gitignored paths. The database, photos, and `node_modules` survive a restart. The entrypoint does not run `git clean`.

## One GitHub PAT (repo + image)

Use a single classic PAT for both pulling the GHCR image and cloning a private source repo. A public repository can leave `BAGHBAN_GIT_TOKEN` unset.

### Create the token

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. Name it e.g. `casaos-baghban`
4. Set an expiration you are comfortable with
5. Enable these scopes:
   - **`repo`** — clone/pull the source repository when it is private
   - **`read:packages`** — pull the GHCR image
6. **Generate token** and copy it (shown only once)

To **build and push** images from your PC, add **`write:packages`** (or use a separate dev-only token). CasaOS itself only needs `repo` + `read:packages`.

### Where the same PAT is used

| Step | How |
|------|-----|
| Pull image on CasaOS | `docker login ghcr.io` on the host (see §3) |
| Clone source at startup | `BAGHBAN_GIT_TOKEN` in the CasaOS app environment (see §4) |

Never commit the PAT to git or put it in `docker-compose.yml`.

---

## 1. Build and push the image

From this directory (`docker/`):

```sh
docker build -f Dockerfile.main -t ghcr.io/tariquesani/baghban:master .
docker push ghcr.io/tariquesani/baghban:master
```

First-time GHCR push: log in with your PAT (add **`write:packages`** on the token used from your PC):

```sh
echo YOUR_GITHUB_PAT | docker login ghcr.io -u tariquesani --password-stdin
```

Rebuild and push this image only when `Dockerfile.main` or `docker-entrypoint-main.sh` changes. Ordinary commits on `master` are picked up by restarting the container.

---

## 2. Make the GHCR package private (recommended)

1. GitHub → **Packages** → **baghban**
2. **Package settings** → **Change visibility** → **Private**

Only accounts and tokens you authorize can pull the image. The image layers contain no app source code, but a private package avoids publishing the runtime image publicly.

---

## 3. Log Docker in on the CasaOS host

CasaOS uses the host Docker daemon. Registry auth is configured on the machine, not in `docker-compose.yml`.

SSH into the CasaOS box:

```sh
echo YOUR_GITHUB_PAT | docker login ghcr.io -u tariquesani --password-stdin
```

Use the same PAT as `BAGHBAN_GIT_TOKEN` (`repo` + `read:packages`).

Verify:

```sh
docker pull ghcr.io/tariquesani/baghban:master
```

Re-run `docker login` after rotating or expiring a token. A failed login shows errors like `pull access denied` or `unauthorized` when starting the app.

---

## 4. Install on CasaOS

1. In CasaOS, add a **Custom App** using `docker/docker-compose.yml`
2. When the GitHub repo is private, set **`BAGHBAN_GIT_TOKEN`** in the app environment (the same PAT used for `docker login`)
3. Ensure the data directory exists (CasaOS usually creates it on first run):
   - `/DATA/AppData/baghban` → mounted at `/app` in the container
4. Start the app and open `http://<casaos-host>:6060`

Do **not** put `BAGHBAN_GIT_TOKEN` in the compose file; use the CasaOS UI only.

The first start clones the repo, installs Python and npm packages, and builds the frontend. Later restarts skip `npm ci` when `package-lock.json` is unchanged, then rebuild the frontend and start the server.

### What persists across restarts

The bind mount holds the synced code and the garden:

- `backend/data/baghban.db` — the garden, beds, crops, and calendar
- `backend/data/photos/` — plot and calendar photos
- `frontend/node_modules/` — reused until the lockfile changes

### Day to day

1. Push to `master`
2. Restart the container (`docker restart baghban-main`, or the CasaOS restart button)

The entrypoint pulls `master` and serves the new build. Edits made inside the container are discarded by the hard reset.

---

## 5. Local test (optional)

```sh
docker run --rm -p 6060:6060 \
  -v baghban-app:/app \
  -e BAGHBAN_GIT_REPO=https://github.com/tariquesani/baghban.git \
  -e BAGHBAN_GIT_REF=master \
  -e BAGHBAN_GIT_TOKEN=your_pat_here \
  ghcr.io/tariquesani/baghban:master
```

Leave `BAGHBAN_GIT_TOKEN` unset when the repository is public.

---

## Environment variables

### CasaOS (user-facing)

| Variable | Default | Description |
|----------|---------|-------------|
| `BAGHBAN_GIT_REPO` | `https://github.com/tariquesani/baghban.git` | HTTPS clone URL for the source repo |
| `BAGHBAN_GIT_REF` | `master` | Branch or tag to check out |
| `BAGHBAN_GIT_TOKEN` | (unset) | Injected into the clone URL for private repos |
| `BAGHBAN_USERNAME` | (optional) | Overrides default `admin` on first credential bootstrap |
| `BAGHBAN_PASSWORD` | (optional) | Overrides default `admin` on first credential bootstrap |
| `BAGHBAN_API_TOKEN` | (optional) | Overrides auto-generated `api.token` in the data dir |
| `BAGHBAN_SESSION_SECRET` | (optional) | Overrides auto-generated `session.secret` in the data dir |

Auth works with no env set: login is `admin` / `admin`, and secrets are created under the bind-mounted data dir. Change the password in **Settings → Account**. Set the env vars only if you want to pin secrets yourself.

### Image defaults (not set in CasaOS)

These are defined in `Dockerfile.main` and only need changing for advanced tuning:

| Variable | Default | Description |
|----------|---------|-------------|
| `BAGHBAN_APP_SRC` | `/app` | Clone target inside the container |
| `BAGHBAN_HOST` | `0.0.0.0` | Listen address |
| `BAGHBAN_PORT` | `6060` | Listen port. Keep this aligned with the published port. |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `pull access denied` on start | Run `docker login ghcr.io` on the CasaOS host; PAT needs `read:packages` |
| `git clone` / `git fetch` fails | Missing or invalid `BAGHBAN_GIT_TOKEN` for a private repo; use a PAT with `repo` scope |
| Container stays on "starting" for several minutes | First clone, `pip install`, and the frontend build. Check the logs. |
| API responds and the UI does not | The frontend build failed. `docker logs baghban-main` shows the `npm run build` error. |
| Cannot log in after reset | Default is `admin` / `admin` until changed in Settings; secrets live in `backend/data/session.secret` and `api.token` |
| Garden is empty after a recreate | The host folder `/DATA/AppData/baghban` was replaced. The database lives at `backend/data/baghban.db` inside that folder. |

View logs from CasaOS or:

```sh
docker logs baghban-main
```

---

## Files in this directory

| File | Purpose |
|------|---------|
| `Dockerfile.main` | Runtime image (Python, Node, git, entrypoint) |
| `docker-entrypoint-main.sh` | Git sync, pip install, frontend build, uvicorn |
| `docker-compose.yml` | CasaOS custom app template |
