# FieldOps Dispatch Lab

A local full-stack field service dispatch app for comparing resource allocation strategies.

The scenario models industrial maintenance technicians, incoming service requests, skill
requirements, availability windows, busy windows, travel distance, priority, and service cost.
The UI visualizes assignments on an SVG spatial map and compares greedy dispatch against a
batch Hungarian optimizer.

## Tech Stack

- Frontend: React + Vite
- Backend: FastAPI
- Algorithms: Pure Python, no paid services or API keys
- Visualization: Local SVG map using latitude/longitude projection
- Tests: Python standard-library `unittest`

## Setup

### Docker

Recommended for reviewers:

```bash
docker compose up --build
```

Then open `http://localhost:5173`.

The Compose stack runs:

- Frontend: nginx serving the built React app on `localhost:5173`
- Backend: FastAPI on `localhost:8000`
- API proxy: frontend requests to `/api/*` are routed to the backend container

Stop the stack with:

```bash
docker compose down
```

Run backend tests inside Docker:

```bash
docker compose run --rm backend python -m unittest discover tests
```

If your machine uses the older standalone Compose binary, use `docker-compose` in place of
`docker compose`.

### Local Development

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --app-dir backend
```

The API runs at `http://127.0.0.1:8000`.

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The web app runs at `http://127.0.0.1:5173`.

## Tests

```bash
PYTHONPATH=backend python3 -m unittest discover backend/tests
```

The test suite verifies hard constraints, busy-window handling, incompatible skill rejection,
and the expected algorithm tradeoff in the sample scenario.

## API

- `GET /api/health` returns service status.
- `GET /api/scenario` returns the sample dispatch scenario.
- `POST /api/allocate` runs one algorithm. Include `algorithm: "greedy"` or
  `algorithm: "hungarian"` in the request body.
- `POST /api/compare` runs both algorithms and returns metrics, assignments, and explanations.

## Approach

The allocation engine treats the dispatch wave as a one-job-per-technician matching problem.
That keeps the optimization explainable while still representing realistic field-service
constraints:

- Hard constraints: required skill, availability window, busy windows, one assignment per
  technician, and maximum travel distance.
- Soft constraints: travel distance, arrival lateness, service cost, and request priority.
- Decision explanations: every assignment returns the reason it was selected, including skill,
  arrival time, distance, and final weighted score.

Greedy processes requests by priority and appointment time, then picks the lowest-cost feasible
technician for each request. Hungarian builds the feasible cost matrix for the whole dispatch
wave and optimizes all pairings simultaneously, with dummy columns representing unassigned
requests.

## Brief Analysis

In the provided scenario, greedy minimizes travel because it assigns the closest multi-skilled
technician to a high-priority electrical request first. That local decision consumes the only
good mechanical option for a later pump failure.

Hungarian sees the whole batch. It sends a farther electrical technician to Aurora so the
multi-skilled Aurora technician can cover Joliet. The result is higher travel, but better
priority coverage and a lower objective score.

See [docs/ALGORITHM_ANALYSIS.md](docs/ALGORITHM_ANALYSIS.md) for the full comparison notes.

## Project Layout

```text
backend/app/
  allocation.py      Core algorithms and metrics
  domain.py          Domain dataclasses and payload parsing
  main.py            FastAPI endpoints
  sample_data.py     Deterministic demo scenario
backend/tests/
  test_allocation.py Constraint and comparison tests
backend/Dockerfile    Backend container
frontend/src/
  App.jsx            React dashboard
  styles.css         UI styling
frontend/Dockerfile   Frontend container
frontend/nginx.conf   Static server and API proxy
docs/
  ALGORITHM_ANALYSIS.md
docker-compose.yml    One-command app startup
```
