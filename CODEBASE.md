# Crane — Codebase Guide

## How the app is structured

Crane is split into two parts that run separately:

```
job-tracker/
├── main.py          ← Python API (FastAPI)
├── database.py      ← Database setup and schema
├── scraper.py       ← LinkedIn scraper
├── job_tracker.py   ← Legacy CLI (not used by the web app)
├── requirements.txt ← Python dependencies
├── railway.toml     ← Railway deployment config
└── frontend/        ← React app (TypeScript)
    ├── src/
    │   ├── main.tsx          ← App entry point + routing
    │   ├── App.tsx           ← Sidebar layout + navigation
    │   ├── api.ts            ← All fetch calls to the backend
    │   ├── types.ts          ← TypeScript types (Job, Stats, Status)
    │   ├── index.css         ← Global styles (Tailwind import)
    │   ├── pages/
    │   │   ├── Landing.tsx   ← Marketing landing page (/)
    │   │   ├── Dashboard.tsx ← Stats and pipeline (/app)
    │   │   ├── Jobs.tsx      ← Job list with filters (/app → All Jobs)
    │   │   ├── AddJob.tsx    ← Add job form (/app → Add Job)
    │   │   └── Scrape.tsx    ← LinkedIn scraper UI (/app → Scrape)
    │   └── components/
    │       └── StatusBadge.tsx ← Colored status pill component
    └── public/
        └── favicon.svg       ← Crane logo (used as browser tab icon)
```

---

## Backend (Python / FastAPI)

### `database.py`
Defines the database connection and the `jobs` table schema using SQLAlchemy.

- Reads `DATABASE_URL` from environment variables. Locally it defaults to a SQLite file (`crane.db`). On Railway it uses PostgreSQL.
- `jobs_table` defines the columns: `id`, `company`, `position`, `status`, `date_added`, `date_applied`, `url`, `notes`, `deadline`.
- `init_db()` creates the table if it doesn't exist, then calls `_migrate_columns()` which safely adds new columns to an existing table using `ALTER TABLE`. This means you can add columns without losing data.

### `main.py`
The FastAPI app. Every URL the frontend calls is defined here.

**Endpoints:**

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/jobs` | List all jobs. Accepts `search`, `status`, `sort` query params. |
| GET | `/api/stats` | Returns counts by status, response rate, offer rate, and stale count. |
| POST | `/api/jobs` | Create a new job. |
| PATCH | `/api/jobs/bulk` | Update the status of multiple jobs at once (bulk update). |
| PATCH | `/api/jobs/{id}` | Update a single job's status, url, notes, or deadline. |
| DELETE | `/api/jobs/{id}` | Delete a single job. |
| DELETE | `/api/jobs` | Delete all jobs. |
| POST | `/api/scrape` | Run the LinkedIn scraper and return results. |
| GET | `/api/export` | Download all jobs as a CSV file. |

**Important:** `/api/jobs/bulk` must be defined before `/api/jobs/{id}` in the file, otherwise FastAPI would treat the word "bulk" as a job ID.

**Startup:** When the server starts, `init_db()` runs to create/migrate the database, and `migrate_json()` runs once to import any data from the old `jobs.json` file if the database is empty.

### `scraper.py`
Scrapes LinkedIn's public job search page using `requests` and `BeautifulSoup`. Returns a list of `{company, position}` dicts. LinkedIn occasionally blocks scrapers, so results may vary.

---

## Frontend (TypeScript / React / Tailwind)

### `types.ts`
Defines the shapes of data used throughout the app.

- `Job` — a job record with all its fields including the new ones (`url`, `notes`, `deadline`).
- `Status` — the allowed status values as a TypeScript union type.
- `Stats` — what the `/api/stats` endpoint returns, including `stale` (jobs needing a follow-up).

### `api.ts`
A single object (`api`) that wraps every backend call. The frontend never calls `fetch` directly — it always goes through here. This makes it easy to see all API calls in one place and change the base URL.

The base URL is `VITE_API_URL + /api`. In development, `VITE_API_URL` is empty and Vite proxies `/api` to `localhost:8000`. In production (Vercel), `VITE_API_URL` is set to the Railway backend URL.

### `main.tsx`
Sets up React Router with two routes:
- `/` → Landing page
- `/app` → The main tracker app

### `App.tsx`
The sidebar layout. Renders the dark sidebar with the Crane logo, navigation buttons, Export CSV link, and Clear all jobs button. Switches between pages by tracking which nav item is active in React state.

### Pages

**`Landing.tsx`** — Marketing page at `/`. Has the logo, headline, three feature cards, and a "Get started" button linking to `/app`.

**`Dashboard.tsx`** — Shows four metric cards (Total, Applied, Interviews, Follow-ups) plus a pipeline bar chart and rate cards. The "Follow-ups" card turns amber when there are jobs with no update in 14+ days.

**`Jobs.tsx`** — The main job list. Key behaviors:
- Each job card has a colored left border that matches its status color.
- Clicking the `▾` chevron expands the card to show editable fields: Status, Deadline, URL, Notes.
- Jobs with no status update in 14+ days show a "Follow up" amber badge.
- Jobs with a deadline within 3 days (or overdue) show a deadline warning badge.
- Checkboxes on each card enable bulk selection. When any are selected, a floating bar appears at the bottom to update all selected jobs to a new status at once.

**`AddJob.tsx`** — Form to manually add a job. Fields: Company, Position, URL, Deadline, Status (pill selector), Notes.

**`Scrape.tsx`** — Runs the LinkedIn scraper, shows results as a checklist, and adds selected jobs to the database.

### `StatusBadge.tsx`
A small reusable component that renders a colored pill for a job's status. Colors are defined inline — each status has a text color, background color, and border color.

---

## How data flows

1. User does something in the UI (clicks a button, submits a form).
2. A function in the page component calls `api.jobs.something(...)`.
3. `api.ts` sends a `fetch` request to the FastAPI backend.
4. FastAPI runs a SQLAlchemy query against the database.
5. The result comes back as JSON.
6. React updates state and re-renders.

---

## Running locally

Double-click `dev.bat`. It opens two terminals:
- **API** — `python -m uvicorn main:app --reload --port 8000`
- **Frontend** — `npm run dev` inside `frontend/`

Then opens `http://localhost:5173` automatically.

---

## Deployment

- **Backend → Railway** — push to GitHub, Railway auto-deploys. `railway.toml` tells Railway to run `uvicorn main:app --host 0.0.0.0 --port $PORT`. The PostgreSQL plugin auto-sets `DATABASE_URL`.
- **Frontend → Vercel** — push to GitHub, Vercel auto-deploys. Root directory is set to `frontend/`. Environment variable `VITE_API_URL` must be set to the Railway backend URL (e.g. `https://crane-production.up.railway.app`).
