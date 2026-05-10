# Crane — Codebase Guide (v1.1)

## How the app is structured

```
job-tracker/
├── main.py          ← Python API (FastAPI) — scraper + export only
├── database.py      ← SQLAlchemy schema (SQLite locally, PostgreSQL on Railway)
├── scraper.py       ← LinkedIn scraper
├── sources.py       ← Additional job source scrapers
├── job_tracker.py   ← Legacy CLI (unused by the web app)
├── requirements.txt
├── railway.toml     ← Railway deployment config
└── frontend/        ← React app (TypeScript + Vite)
    └── src/
        ├── main.tsx                   ← Entry point, routing, AuthProvider
        ├── App.tsx                    ← Sidebar layout + page switching
        ├── api.ts                     ← Fetch calls to Python backend (scrape/export)
        ├── types.ts                   ← TypeScript types (Job, Stats, Status)
        ├── index.css                  ← Global styles
        ├── context/
        │   ├── AuthContext.tsx        ← Supabase auth state provider
        │   └── auth.ts               ← useAuth() hook
        ├── lib/
        │   ├── supabase.ts           ← Supabase client (url + anon key from env)
        │   ├── jobsApi.ts            ← All job CRUD via Supabase (primary data layer)
        │   └── sentry.ts             ← Sentry init + ErrorBoundary export
        ├── hooks/
        │   ├── useTutorial.ts        ← Onboarding checklist state + step logic
        │   ├── useTheme.ts           ← Dark/light theme toggle (persisted)
        │   ├── useDebouncedValue.ts  ← Generic debounce hook
        │   └── useIsMobile.ts        ← Responsive breakpoint hook
        ├── components/
        │   ├── RequireAuth.tsx        ← Route guard; redirects to / if not authed
        │   ├── StatusBadge.tsx        ← Colored status pill
        │   ├── statusTokens.ts        ← Status color/label constants
        │   ├── CompanyLogo.tsx        ← Company favicon via Clearbit/Google
        │   ├── TutorialChecklist.tsx  ← Sidebar onboarding checklist UI
        │   └── SpotlightOverlay.tsx   ← Highlight overlay for tutorial steps
        ├── pages/
        │   ├── Landing.tsx            ← Marketing page (/)
        │   ├── Onboarding.tsx         ← Post-signup profile setup (/onboarding)
        │   ├── Dashboard.tsx          ← Stats strip + pipeline view
        │   ├── Jobs.tsx               ← Kanban board with inline editing
        │   ├── Scrape.tsx             ← LinkedIn job discovery UI
        │   ├── Stats.tsx              ← Advanced analytics page
        │   └── Account.tsx            ← User profile/settings
        └── utils/
            ├── offlineDrafts.ts       ← LocalStorage draft queue for offline adds
            └── companyDomain.ts       ← Utility to extract domain from company name
```

---

## Auth (Supabase)

Authentication is handled entirely by Supabase Auth, not the Python backend.

- `lib/supabase.ts` — creates the Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `context/AuthContext.tsx` — wraps the app in an `AuthProvider` that subscribes to `supabase.auth.onAuthStateChange` and exposes `{ session, profile, signOut }`.
- `context/auth.ts` — exports `useAuth()` to consume the context anywhere.
- `components/RequireAuth.tsx` — wraps the `/app` routes; redirects unauthenticated users to `/`.
- `/onboarding` — post-signup route where users set their name and target role before hitting the main app.

Routes in `main.tsx`:
| Path | Component | Protected |
|------|-----------|-----------|
| `/` | `Landing` | No |
| `/onboarding` | `Onboarding` | No |
| `/app` | `App` | Yes (RequireAuth) |

---

## Data Layer

There are two API layers — which one is used depends on the operation:

### `lib/jobsApi.ts` (Supabase — primary)
All job CRUD goes directly to the Supabase `jobs` table from the frontend. No Python server involved.

| Operation | Method |
|-----------|--------|
| List jobs | `supabase.from('jobs').select('*')` with search/filter/sort |
| Create job | `.insert(body).select().single()` |
| Update job | `.update(fields).eq('id', id)` |
| Bulk update | `.update({ status }).in('id', ids)` |
| Delete job | `.delete().eq('id', id)` |
| Clear all | `.delete().eq('user_id', user.id)` |
| Stats | Computed client-side from a lightweight `select('status,date_applied,date_added')` |
| Export CSV | Client-side CSV generation from full table select |

### `api.ts` (Python backend — scraper + export only)
The Python backend is now only used for scraping LinkedIn. All endpoints except `/api/scrape` and `/api/export` are effectively superseded by `jobsApi.ts`.

The scraper now supports streaming: `api.scrapeStream(...)` reads newline-delimited JSON from `/api/scrape/stream` and fires `onEvent` callbacks as pages arrive.

---

## Backend (Python / FastAPI)

### `database.py`
SQLAlchemy setup. Reads `DATABASE_URL` from env (SQLite locally, PostgreSQL on Railway). `init_db()` creates the `jobs` table and calls `_migrate_columns()` to safely add new columns to existing tables without data loss.

### `main.py`
FastAPI app. Primary role is now the LinkedIn scraper.

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/jobs` | List jobs (legacy — frontend now uses Supabase) |
| GET | `/api/stats` | Stats (legacy) |
| POST | `/api/jobs` | Create job (legacy) |
| PATCH | `/api/jobs/bulk` | Bulk status update (legacy) |
| PATCH | `/api/jobs/{id}` | Update job (legacy) |
| DELETE | `/api/jobs/{id}` | Delete job (legacy) |
| DELETE | `/api/jobs` | Clear all (legacy) |
| POST | `/api/scrape` | Run LinkedIn scraper, return all results |
| POST | `/api/scrape/stream` | Run scraper, stream results page-by-page (NDJSON) |
| GET | `/api/export` | Download CSV |

### `scraper.py`
Scrapes LinkedIn public job search using `requests` + `BeautifulSoup`. Uses a `requests.Session` with a warmup request to establish cookies before paginating the `seeMoreJobPostings` API endpoint. Accepts `search`, `location`, `job_type`, `experience`, `workplace`, `date_posted`, `easy_apply` params. Handles 429 with exponential backoff (up to 3 retries), detects LinkedIn login-wall redirects, and tolerates up to 2 consecutive empty pages before stopping. The stream endpoint emits `rate_limited` events instead of raising.

### `sources.py`
Additional job source scrapers (Greenhouse, Lever, etc.) for multi-source aggregation.

---

## Frontend Detail

### `App.tsx`
Sidebar layout. Manages active page in state (`dashboard | jobs | scrape | stats | account`). Renders the sidebar with logo, nav, pipeline counts, tutorial checklist, user info, export CSV, theme toggle, clear-all, and sign out. Mounts `<Analytics />` and `<SpeedInsights />` (Vercel) at the root.

### Pages

**`Landing.tsx`** — Marketing page at `/`. Logo, headline, feature cards, auth flow entry.

**`Onboarding.tsx`** — First-time setup after sign-up. Collects name and target role, writes to Supabase profile.

**`Dashboard.tsx`** — Stats strip (Total, Applied, Interviews, Follow-ups) and pipeline view. Follow-ups card turns amber when stale count > 0.

**`Jobs.tsx`** — Kanban board. Cards have colored left borders by status. Clicking a card expands it to show editable Status, Deadline, URL, Tags, Notes, and richer job metadata inline. Company logos via `CompanyLogo`. Stale and deadline warning badges. Search filters across company, position, and tags; tag chips filter the board.

**`Stats.tsx`** — Advanced analytics view: response rate, offer rate, application velocity, source breakdown charts. Uses `useIsMobile` for layout adjustments and is wired into the main `App.tsx` nav.

**`Account.tsx`** — User profile/settings page for name, target role, location, theme, CSV export, clear-all, and sign out. Uses `useIsMobile` and is wired into the main `App.tsx` nav.

**`Scrape.tsx`** — LinkedIn discovery UI. Streams results page-by-page as they arrive from the backend. Users select jobs from the results list to add to their board.

### Components

**`StatusBadge.tsx` / `statusTokens.ts`** — Status color system. Tokens define text, background, and border colors per status. Used across cards and forms.

**`CompanyLogo.tsx`** — Fetches a company's favicon using the Clearbit Logo API or Google favicon service, with a fallback initial.

**`TutorialChecklist.tsx`** — Sidebar checklist for new users. Steps: add a job, find jobs, change a status, set a deadline.

**`SpotlightOverlay.tsx`** — Full-screen overlay that highlights a specific element (by `data-tutorial-id`) to guide users through a step.

**`RequireAuth.tsx`** — Checks `useAuth().session`; renders children if authed, redirects to `/` if not.

### Hooks

**`useTutorial.ts`** — Tracks which tutorial steps are done (localStorage), manages spotlight state, exposes `markDone`, `dismiss`, `setSpotlight`.

**`useTheme.ts`** — Toggles `data-theme` on `<html>`, persists to localStorage.

**`useDebouncedValue.ts`** — Returns a value that only updates after a delay. Used for search inputs.

**`useIsMobile.ts`** — Returns true when viewport width is below the mobile breakpoint.

### Hooks

**`useTutorial.ts`** — Tracks which tutorial steps are done (localStorage key: `crane_tutorial_v1`), manages spotlight state, exposes `markDone`, `dismiss`, `setSpotlight`. Steps: `add_job`, `find_jobs`, `change_status`, `set_deadline`.

**`useTheme.ts`** — Toggles `data-theme` on `<html>`, persists to localStorage. Surfaced in the sidebar and Account settings.

**`useDebouncedValue.ts`** — Returns a value that only updates after a delay. Used for search inputs.

**`useIsMobile.ts`** — Returns true when viewport width is below the mobile breakpoint. Used in `Stats.tsx` and `Account.tsx`.

### Utils

**`offlineDrafts.ts`** — Saves job drafts to localStorage (up to 100) when the user is offline or the API is unavailable. Key: `crane.offlineJobDrafts.v1`.

**`companyDomain.ts`** — Extracts a guessable domain from a company name for logo lookups.

---

## How data flows

1. User action in UI → component calls `jobsApi.something(...)`.
2. `jobsApi` sends a query directly to Supabase (no Python hop).
3. Supabase returns JSON; React updates state and re-renders.

For scraping: component calls `api.scrapeStream(...)` → Python backend → LinkedIn → streamed NDJSON back to browser → `onEvent` callbacks update UI incrementally.

---

## Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase public anon key |
| `VITE_API_URL` | Frontend | Python backend URL (for scraper/export) |
| `VITE_SENTRY_DSN` | Frontend | Sentry error tracking (optional) |
| `DATABASE_URL` | Backend | PostgreSQL (Railway sets this automatically) |

---

## Running locally

Double-click `dev.bat`. Opens two terminals:
- **API** — `python -m uvicorn main:app --reload --port 8002`
- **Frontend** — `npm run dev` inside `frontend/`

Then opens `http://localhost:5173`.

---

## Deployment

- **Backend → Railway** — auto-deploys on push. `railway.toml` runs `uvicorn main:app --host 0.0.0.0 --port $PORT`. PostgreSQL plugin sets `DATABASE_URL`.
- **Frontend → Vercel** — auto-deploys on push. Root directory: `frontend/`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` in Vercel env vars.
- **Observability** — Vercel Analytics + Speed Insights are mounted in `App.tsx`. Sentry is initialized via `lib/sentry.ts` if `VITE_SENTRY_DSN` is set.
