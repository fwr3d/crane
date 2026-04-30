from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, insert, update, delete
import uuid, csv, io, json, os, requests
from datetime import datetime

from database import engine, jobs_table, init_db

STATUSES = ["Not Applied", "Applied", "Interview", "Offer", "Rejected"]

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def normalize_status(s: str) -> str:
    for k in STATUSES:
        if k.lower() == s.lower():
            return k
    return s


def row_to_dict(row) -> dict:
    return dict(row._mapping)


def validate_auth_token(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase auth is not configured")

    token = authorization.split(" ", 1)[1].strip()
    try:
        response = requests.get(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=5,
        )
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="Could not validate auth token")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    user = response.json()

    # Access tokens are JWTs, so an already-issued token can briefly outlive an
    # admin deletion. A service-role lookup lets deployed apps reject deleted
    # accounts immediately instead of waiting for token expiry.
    if SUPABASE_SERVICE_ROLE_KEY and user.get("id"):
        try:
            admin_response = requests.get(
                f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user['id']}",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                },
                timeout=5,
            )
        except requests.RequestException:
            raise HTTPException(status_code=503, detail="Could not verify auth user")

        if admin_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Auth user no longer exists")

    return user


def require_auth(authorization: str | None = Header(default=None)) -> dict:
    return validate_auth_token(authorization)


def migrate_json():
    if not os.path.exists("jobs.json"):
        return
    with engine.connect() as conn:
        existing = conn.execute(select(jobs_table)).fetchall()
        if existing:
            return
        with open("jobs.json") as f:
            jobs = json.load(f)
        for job in jobs:
            conn.execute(insert(jobs_table).values(
                id=str(uuid.uuid4()),
                company=job.get("company", ""),
                position=job.get("position", ""),
                status=normalize_status(job.get("status", "Not Applied")),
                date_added=job.get("date_added"),
                date_applied=job.get("date_applied"),
            ))
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    migrate_json()
    yield


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Crane", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    company:  str
    position: str
    status:   str = "Not Applied"
    url:      Optional[str] = None
    notes:    Optional[str] = None
    deadline: Optional[str] = None
    location: Optional[str] = None

class JobUpdate(BaseModel):
    status:   Optional[str] = None
    url:      Optional[str] = None
    notes:    Optional[str] = None
    deadline: Optional[str] = None
    location: Optional[str] = None

class BulkUpdate(BaseModel):
    ids:    list[str]
    status: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/auth/validate")
def validate_session(current_user: dict = Depends(require_auth)):
    return {"id": current_user.get("id")}


@app.get("/api/jobs")
def list_jobs(
    search: str = "",
    status: str = "",
    sort: str = "date_desc",
    _current_user: dict = Depends(require_auth),
):
    with engine.connect() as conn:
        rows = conn.execute(select(jobs_table)).fetchall()

    jobs = [row_to_dict(r) for r in rows]

    if search:
        q = search.lower()
        jobs = [j for j in jobs if q in j["company"].lower() or q in j["position"].lower()]

    if status:
        statuses = set(status.split(","))
        jobs = [j for j in jobs if normalize_status(j["status"]) in statuses]

    if sort == "company":
        jobs.sort(key=lambda j: j["company"].lower())
    elif sort == "status":
        order = {s: i for i, s in enumerate(STATUSES)}
        jobs.sort(key=lambda j: order.get(normalize_status(j["status"]), 99))
    elif sort == "deadline":
        jobs.sort(key=lambda j: j.get("deadline") or "9999-99-99")
    else:
        jobs.sort(key=lambda j: j.get("date_added") or "", reverse=True)

    return jobs


@app.get("/api/stats")
def stats(_current_user: dict = Depends(require_auth)):
    with engine.connect() as conn:
        rows = conn.execute(select(jobs_table)).fetchall()

    jobs = [row_to_dict(r) for r in rows]
    counts = {s: 0 for s in STATUSES}
    for job in jobs:
        ns = normalize_status(job["status"])
        if ns in counts:
            counts[ns] += 1

    total     = len(jobs)
    responded = counts["Applied"] + counts["Interview"] + counts["Offer"] + counts["Rejected"]
    active    = counts["Applied"] + counts["Interview"] + counts["Offer"]

    # Follow-up alerts: Applied/Interview with no update in 14+ days
    today = datetime.now().date()
    stale = 0
    for job in jobs:
        if normalize_status(job["status"]) not in ("Applied", "Interview"):
            continue
        ref = job.get("date_applied") or job.get("date_added")
        if ref:
            days = (today - datetime.strptime(ref, "%Y-%m-%d").date()).days
            if days >= 14:
                stale += 1

    return {
        "total":         total,
        "by_status":     counts,
        "response_rate": round(responded / total * 100) if total else 0,
        "offer_rate":    round(counts["Offer"] / active * 100) if active else 0,
        "stale":         stale,
    }


@app.delete("/api/jobs", status_code=204)
def clear_jobs(_current_user: dict = Depends(require_auth)):
    with engine.connect() as conn:
        conn.execute(delete(jobs_table))
        conn.commit()


@app.post("/api/jobs", status_code=201)
def add_job(body: JobCreate, _current_user: dict = Depends(require_auth)):
    company  = body.company.strip()
    position = body.position.strip()
    url = body.url.strip() if body.url else None
    location = body.location.strip() if body.location else None

    # Deduplication check
    with engine.connect() as conn:
        existing = conn.execute(select(jobs_table)).fetchall()
    for row in existing:
        r = row_to_dict(row)
        same_url = bool(url and r.get("url") and r["url"].strip().lower() == url.lower())
        same_listing = (
            r["company"].lower() == company.lower()
            and r["position"].lower() == position.lower()
            and (r.get("location") or "").strip().lower() == (location or "").lower()
        )
        if same_url or same_listing:
            raise HTTPException(status_code=409, detail="Job already exists")

    now = datetime.now().strftime("%Y-%m-%d")
    job = {
        "id":           str(uuid.uuid4()),
        "company":      company,
        "position":     position,
        "status":       body.status,
        "date_added":   now,
        "date_applied": now if body.status == "Applied" else None,
        "url":          url,
        "notes":        body.notes,
        "deadline":     body.deadline,
        "location":     location,
    }
    with engine.connect() as conn:
        conn.execute(insert(jobs_table).values(**job))
        conn.commit()
    return job


# Bulk must come before /{job_id} so "bulk" isn't matched as an ID
@app.patch("/api/jobs/bulk")
def bulk_update(body: BulkUpdate, _current_user: dict = Depends(require_auth)):
    now = datetime.now().strftime("%Y-%m-%d")
    with engine.connect() as conn:
        for job_id in body.ids:
            values: dict = {"status": body.status}
            if body.status == "Applied":
                row = conn.execute(select(jobs_table).where(jobs_table.c.id == job_id)).fetchone()
                if row and not row_to_dict(row).get("date_applied"):
                    values["date_applied"] = now
            conn.execute(update(jobs_table).where(jobs_table.c.id == job_id).values(**values))
        conn.commit()
    return {"updated": len(body.ids)}


@app.patch("/api/jobs/{job_id}")
def update_job(job_id: str, body: JobUpdate, _current_user: dict = Depends(require_auth)):
    values: dict = {}

    if body.status is not None:
        values["status"] = body.status
        if body.status == "Applied":
            with engine.connect() as conn:
                row = conn.execute(select(jobs_table).where(jobs_table.c.id == job_id)).fetchone()
            if row and not row_to_dict(row).get("date_applied"):
                values["date_applied"] = datetime.now().strftime("%Y-%m-%d")

    if body.url      is not None: values["url"]      = body.url
    if body.notes    is not None: values["notes"]    = body.notes
    if body.deadline is not None: values["deadline"] = body.deadline
    if body.location is not None: values["location"] = body.location

    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with engine.connect() as conn:
        result = conn.execute(update(jobs_table).where(jobs_table.c.id == job_id).values(**values))
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        row = conn.execute(select(jobs_table).where(jobs_table.c.id == job_id)).fetchone()

    return row_to_dict(row)


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, _current_user: dict = Depends(require_auth)):
    with engine.connect() as conn:
        result = conn.execute(delete(jobs_table).where(jobs_table.c.id == job_id))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found")


@app.post("/api/scrape")
def scrape(
    search: str = "Software Engineer",
    location: str = "California",
    job_type: Optional[list[str]] = Query(None),
    experience: Optional[list[str]] = Query(None),
    workplace: Optional[list[str]] = Query(None),
    date_posted: str | None = None,
    easy_apply: bool = False,
    _current_user: dict = Depends(require_auth),
):
    from scraper import scrape_linkedin_jobs
    return scrape_linkedin_jobs(
        search,
        location,
        job_types=job_type,
        experience_levels=experience,
        workplace_types=workplace,
        date_posted=date_posted,
        easy_apply=easy_apply,
    )


@app.post("/api/scrape/stream")
def scrape_stream(
    search: str = "Software Engineer",
    location: str = "California",
    job_type: Optional[list[str]] = Query(None),
    experience: Optional[list[str]] = Query(None),
    workplace: Optional[list[str]] = Query(None),
    date_posted: str | None = None,
    easy_apply: bool = False,
    _current_user: dict = Depends(require_auth),
):
    from scraper import scrape_linkedin_job_pages

    def events():
        total = 0
        for event in scrape_linkedin_job_pages(
            search,
            location,
            job_types=job_type,
            experience_levels=experience,
            workplace_types=workplace,
            date_posted=date_posted,
            easy_apply=easy_apply,
        ):
            if event["type"] == "page":
                total += len(event["jobs"])
                event["total"] = total
            yield json.dumps(event) + "\n"
        yield json.dumps({"type": "done", "total": total}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.get("/api/export")
def export_csv(_current_user: dict = Depends(require_auth)):
    with engine.connect() as conn:
        rows = conn.execute(select(jobs_table)).fetchall()

    jobs = [row_to_dict(r) for r in rows]
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["company", "position", "status", "date_added", "date_applied", "location", "url", "deadline", "notes"],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(jobs)

    filename = f"crane_jobs_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
