# Baghban: Personal Garden Management System

Baghban is a personal garden management system  for a vegetable garden. It keeps track of the plot, the crops in each bed, and a calendar of sowings, care, pests, harvests, and notes. The home page is a briefing: the weather at that place, what is in the ground, and what the next two weeks ask for.

## What you can do

- **Home** — garden name and place, current weather, wind, sunrise, sunset, and moon, plus crops currently growing, today's plans, the next 14 days, and this season's harvest.
- **Planner** — draw beds, pots, planters, and obstacles on a scaled plot, and assign crops to beds.
- **Calendar** — record sowing, care, pest control, harvest, and diary entries.
- **Crops** — a catalogue of vegetables, herbs, flowers, and fruit, with spacing, sun, water, and companion notes.
- **Setup** — garden name, size, and latitude and longitude. The server derives the timezone from that point.

Weather comes from [Yr](https://developer.yr.no/), through the Norwegian Meteorological Institute's location forecast. No API key is required. Sunrise, sunset, and the moon are calculated on the server. The home-page map is a static [OpenStreetMap](https://www.openstreetmap.org/) thumbnail of the saved coordinates.

## Coming Soon

- **Seed inventory** — variety, supplier, quantity on hand, and how long a packet stays viable.
- **Succession sowing** — repeated sowings for crops picked over several weeks, such as coriander, radish, and beans.
- **Crop rotation** — the plant family that grew in each bed, with a warning when the same family returns too soon.
- **Sun and shade** — full sun, partial shade, and shade marked on the plan.
- **Season plans** — a saved layout for each growing season, kept alongside the one before it.
- **Local planting windows** — suggested sowing and transplanting dates for this garden's climate.
- **Weather-aware care** — a watering task held back when rain is already on the way.
- **Backup** — export and restore the garden as a file, separate from the database.

## Stack

- Frontend: [Svelte 5](https://svelte.dev/), [Vite](https://vite.dev/), and [Tailwind CSS](https://tailwindcss.com/)
- Backend: [FastAPI](https://fastapi.tiangolo.com/) and SQLite
- Sun and moon: [Astral](https://astral.readthedocs.io/)
- Timezone from coordinates: [timezonefinder](https://timezonefinder.readthedocs.io/)

The app is English only. One database holds one garden.

## Requirements

- Python 3.10 or newer
- Node.js 20.19 or newer (or Node.js 22.12+)
- npm

## Run locally

Start the API and the frontend in two terminals. The Vite dev server proxies `/api` to the API.

### API

From `backend`:

```bash
python -m venv .venv
```

Windows (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

macOS and Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

The database is created on first run at `backend/data/baghban.db`. Photos are stored beside it in `backend/data/photos/`. Both are local and are not part of the repository. Set `BAGHBAN_DB` to use a different database file.

### Frontend

From `frontend`:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

To serve a production build of the frontend:

```bash
npm run build
npm run preview
```

The preview server still expects the API on port 8000. After `npm run build`, the API also serves `frontend/dist` on its own port, so opening that address loads the app.

## Docker / CasaOS

The home-server container syncs `master` from GitHub on each start and serves the site on port 6060. See [docker/README.md](docker/README.md).

## Tests

API tests, from `backend` with the virtual environment active:

```bash
pytest
```

Frontend domain tests, from `frontend`:

```bash
node --test src/lib/domain
```

## Layout

```
backend/    FastAPI app, SQLite schema, and API tests
frontend/   Svelte app (planner canvas, pages, and domain tests)
```

Save a location on Setup before Home can show weather, sunrise, and the map. With no coordinates, the clock, timezone, and moon still appear.
