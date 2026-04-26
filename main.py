from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import csv
import io
from datetime import datetime

from job_tracker import load_jobs, save_jobs
from scraper import scrape_linkedin_jobs

app = FastAPI()

STATUSES = ["Not Applied", "Applied", "Interview", "Offer", "Rejected"]


def normalize_status(s: str) -> str:
    for k in STATUSES:
        if k.lower() == s.lower():
            return k
    return s


def ensure_ids(jobs: list[dict]) -> list[dict]:
    changed = False
    for job in jobs:
        if not job.get("id"):
            job["id"] = str(uuid.uuid4())
            changed = True
    if changed:
        save_jobs(jobs)
    return jobs


# ── Models ─────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    company: str
    position: str
    status: str = "Not Applied"

class JobUpdate(BaseModel):
    status: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/jobs")
def list_jobs(search: str = "", status: str = "", sort: str = "date_desc"):
    jobs = ensure_ids(load_jobs())

    if search:
        q = search.lower()
        jobs = [j for j in jobs if q in j["company"].lower() or q in j["position"].lower()]

    if status:
        statuses = status.split(",")
        jobs = [j for j in jobs if normalize_status(j["status"]) in statuses]

    if sort == "company":
        jobs = sorted(jobs, key=lambda j: j["company"].lower())
    elif sort == "status":
        order = {s: i for i, s in enumerate(STATUSES)}
        jobs = sorted(jobs, key=lambda j: order.get(normalize_status(j["status"]), 99))
    else:
        jobs = sorted(jobs, key=lambda j: j.get("date_added", ""), reverse=True)

    return jobs


@app.get("/api/stats")
def stats():
    jobs = ensure_ids(load_jobs())
    counts = {s: 0 for s in STATUSES}
    for job in jobs:
        ns = normalize_status(job["status"])
        if ns in counts:
            counts[ns] += 1

    total = len(jobs)
    responded = counts["Applied"] + counts["Interview"] + counts["Offer"] + counts["Rejected"]
    active = counts["Applied"] + counts["Interview"] + counts["Offer"]

    return {
        "total": total,
        "by_status": counts,
        "response_rate": round(responded / total * 100) if total else 0,
        "offer_rate": round(counts["Offer"] / active * 100) if active else 0,
    }


@app.post("/api/jobs", status_code=201)
def add_job(body: JobCreate):
    jobs = ensure_ids(load_jobs())
    now = datetime.now().strftime("%Y-%m-%d")
    new_job = {
        "id": str(uuid.uuid4()),
        "company": body.company.strip(),
        "position": body.position.strip(),
        "status": body.status,
        "date_added": now,
        "date_applied": now if body.status == "Applied" else None,
    }
    jobs.append(new_job)
    save_jobs(jobs)
    return new_job


@app.patch("/api/jobs/{job_id}")
def update_job(job_id: str, body: JobUpdate):
    jobs = ensure_ids(load_jobs())
    for job in jobs:
        if job["id"] == job_id:
            job["status"] = body.status
            if body.status == "Applied" and not job.get("date_applied"):
                job["date_applied"] = datetime.now().strftime("%Y-%m-%d")
            save_jobs(jobs)
            return job
    raise HTTPException(status_code=404, detail="Job not found")


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: str):
    jobs = ensure_ids(load_jobs())
    new_jobs = [j for j in jobs if j["id"] != job_id]
    if len(new_jobs) == len(jobs):
        raise HTTPException(status_code=404, detail="Job not found")
    save_jobs(new_jobs)


@app.post("/api/scrape")
def scrape(search: str = "Software Engineer", location: str = "California"):
    results = scrape_linkedin_jobs(search, location)
    return results


@app.get("/api/export")
def export_csv():
    jobs = load_jobs()
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["company", "position", "status", "date_added", "date_applied"],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(jobs)

    filename = f"jobs_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
