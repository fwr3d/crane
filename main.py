from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel
from sqlalchemy import select, insert, update, delete
import uuid, csv, io, json, os
from datetime import datetime

from database import engine, jobs_table, init_db
from scraper import scrape_linkedin_jobs

STATUSES = ["Not Applied", "Applied", "Interview", "Offer", "Rejected"]


def normalize_status(s: str) -> str:
    for k in STATUSES:
        if k.lower() == s.lower():
            return k
    return s


def row_to_dict(row) -> dict:
    return dict(row._mapping)


def migrate_json():
    """One-time migration from jobs.json into the database."""
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

class JobUpdate(BaseModel):
    status: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/jobs")
def list_jobs(search: str = "", status: str = "", sort: str = "date_desc"):
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
    else:
        jobs.sort(key=lambda j: j.get("date_added") or "", reverse=True)

    return jobs


@app.get("/api/stats")
def stats():
    with engine.connect() as conn:
        rows = conn.execute(select(jobs_table)).fetchall()

    jobs = [row_to_dict(r) for r in rows]
    counts = {s: 0 for s in STATUSES}
    for job in jobs:
        ns = normalize_status(job["status"])
        if ns in counts:
            counts[ns] += 1

    total = len(jobs)
    responded = counts["Applied"] + counts["Interview"] + counts["Offer"] + counts["Rejected"]
    active    = counts["Applied"] + counts["Interview"] + counts["Offer"]

    return {
        "total":         total,
        "by_status":     counts,
        "response_rate": round(responded / total * 100) if total else 0,
        "offer_rate":    round(counts["Offer"] / active * 100) if active else 0,
    }


@app.post("/api/jobs", status_code=201)
def add_job(body: JobCreate):
    now = datetime.now().strftime("%Y-%m-%d")
    job = {
        "id":           str(uuid.uuid4()),
        "company":      body.company.strip(),
        "position":     body.position.strip(),
        "status":       body.status,
        "date_added":   now,
        "date_applied": now if body.status == "Applied" else None,
    }
    with engine.connect() as conn:
        conn.execute(insert(jobs_table).values(**job))
        conn.commit()
    return job


@app.patch("/api/jobs/{job_id}")
def update_job(job_id: str, body: JobUpdate):
    values = {"status": body.status}
    if body.status == "Applied":
        with engine.connect() as conn:
            row = conn.execute(select(jobs_table).where(jobs_table.c.id == job_id)).fetchone()
        if row and not row_to_dict(row).get("date_applied"):
            values["date_applied"] = datetime.now().strftime("%Y-%m-%d")

    with engine.connect() as conn:
        result = conn.execute(
            update(jobs_table).where(jobs_table.c.id == job_id).values(**values)
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        row = conn.execute(select(jobs_table).where(jobs_table.c.id == job_id)).fetchone()

    return row_to_dict(row)


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: str):
    with engine.connect() as conn:
        result = conn.execute(delete(jobs_table).where(jobs_table.c.id == job_id))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found")


@app.delete("/api/jobs", status_code=204)
def clear_all_jobs():
    with engine.connect() as conn:
        conn.execute(delete(jobs_table))
        conn.commit()


@app.post("/api/scrape")
def scrape(search: str = "Software Engineer", location: str = "California"):
    return scrape_linkedin_jobs(search, location)


@app.get("/api/export")
def export_csv():
    with engine.connect() as conn:
        rows = conn.execute(select(jobs_table)).fetchall()

    jobs = [row_to_dict(r) for r in rows]
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["company", "position", "status", "date_added", "date_applied"],
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
