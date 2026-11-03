#!/bin/sh
set -eu

APP_SRC="${BAGHBAN_APP_SRC:-/app}"
REPO_URL="${BAGHBAN_GIT_REPO:?BAGHBAN_GIT_REPO is required}"
REF="${BAGHBAN_GIT_REF:-master}"
HOST="${BAGHBAN_HOST:-0.0.0.0}"
PORT="${BAGHBAN_PORT:-6060}"

repo_url_for_clone="${REPO_URL}"
if [ -n "${BAGHBAN_GIT_TOKEN:-}" ]; then
    repo_url_for_clone=$(printf '%s' "$REPO_URL" | sed "s#https://#https://${BAGHBAN_GIT_TOKEN}@#")
fi

mkdir -p "$(dirname "$APP_SRC")"

if [ -d "${APP_SRC}/.git" ]; then
    cd "$APP_SRC"
    git remote set-url origin "$repo_url_for_clone" 2>/dev/null || true
    git fetch origin --prune
    git checkout "$REF" 2>/dev/null || git checkout -B "$REF" "origin/${REF}"
    git reset --hard "origin/${REF}"
else
    # Clone beside the mount, then copy in. Never delete the mount point:
    # backend/data may already hold the garden database.
    mkdir -p "$APP_SRC"
    clone_tmp=$(mktemp -d)
    git clone --branch "$REF" --single-branch "$repo_url_for_clone" "$clone_tmp"
    cp -a "$clone_tmp"/. "$APP_SRC"/
    rm -rf "$clone_tmp"
    cd "$APP_SRC"
fi

python -m pip install --no-cache-dir --upgrade pip
python -m pip install --no-cache-dir -r backend/requirements.txt

cd "$APP_SRC/frontend"
lock_hash=$(sha256sum package-lock.json | awk 'NR==1 { print $1 }')
stamp="node_modules/.baghban-lock-hash"
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$lock_hash" ]; then
    npm ci
    printf '%s\n' "$lock_hash" > "$stamp"
fi
npm run build

cd "$APP_SRC"
exec python -m uvicorn app:app \
    --app-dir "$APP_SRC/backend" \
    --host "$HOST" \
    --port "$PORT"
