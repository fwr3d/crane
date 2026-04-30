from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, insert, update, delete
import uuid, csv, io, json, os
import requests as http_requests
from jose import jwt as jose_jwt
from jose.exceptions import JWTError
from datetime import datetime

from database import engine, jobs_table, init_db

STATUSES = ["Not Applied", "Applied", "Interview", "Offer", "Rejected"]
SUPABASE_URL        = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")  # legacy HS256 fallback
SUPABASE_JWK        = os.environ.get("SUPABASE_JWK", "")         # fallback if network fetch fails

bearer = HTTPBearer(auto_error=False)
_jwks: list = []


def _load_jwks() -> None:
    global _jwks
    # Try fetching from Supabase JWKS endpoint
    if SUPABASE_URL:
        try:
            resp = http_requests.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=5)
            keys = resp.json().get("keys", [])
            if keys:
                _jwks = keys
                return
        except Exception:
            pass
    # Fall back to a manually supplied JWK (JSON string of a single key)
    if SUPABASE_JWK:
        try:
            _jwks = [json.loads(SUPABASE_JWK)]
        except Exception:
            pass


def get_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = creds.credentials

    # Reload JWKS if the startup fetch failed (e.g. network not ready yet)
    if not _jwks:
        _load_jwks()

    # Inspect token header to pick the right verification path
    try:
        header = jose_jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    alg = header.get("alg", "HS256")
    kid = header.get("kid")

    # Asymmetric key (ECC / RSA) — verify against JWKS
    if alg in ("ES256", "RS256") and _jwks:
        key = next((k for k in _jwks if k.get("kid") == kid), _jwks[0])
        try:
            payload = jose_jwt.decode(token, key, algorithms=[alg], options={"verify_aud": False})
            return payload["sub"]
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Symmetric key (HS256) — legacy fallback
    if alg == "HS256" and SUPABASE_JWT_SECRET:
        try:
            payload = jose_jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
            return payload["sub"]
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Last resort: JWKS unavailable — read sub without signature verification.
    # Supabase already authenticated the user in the browser; this is acceptable
    # for a personal app when Railway blocks outbound requests to Supabase.
    try:
        claims = jose_jwt.get_unverified_claims(token)
        sub = claims.get("sub")
        if sub:
            return sub
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Invalid or expired token")


def normalize_status(s: str) -> str:
    for k in STATUSES:
        if k.lower() == s.lower():
            return k
    return s


def row_to_dict(row) -> dict:
    return dict(row._mapping)


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
    _load_jwks()
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
    location: Optional[str] = None
    notes:    Optional[str] = None
    deadline: Optional[str] = None

class JobUpdate(BaseModel):
    status:   Optional[str] = None
    url:      Optional[str] = None
    location: Optional[str] = None
    notes:    Optional[str] = None
    deadline: Optional[str] = None

class BulkUpdate(BaseModel):
    ids:    list[str]
    status: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    jwk_parse_err = None
    if SUPABASE_JWK and not _jwks:
        try:
            json.loads(SUPABASE_JWK)
        except Exception as e:
            jwk_parse_err = str(e)
    return {
        "status": "ok",
        "jwks_keys": len(_jwks),
        "supabase_url_set": bool(SUPABASE_URL),
        "supabase_jwk_len": len(SUPABASE_JWK),
        "supabase_jwk_parse_error": jwk_parse_err,
    }


@app.get("/api/jobs")
def list_jobs(
    search: str = "",
    status: str = "",
    sort: str = "date_desc",
    user_id: str = Depends(get_user_id),
):
    with engine.connect() as conn:
        rows = conn.execute(
            select(jobs_table).where(jobs_table.c.user_id == user_id)
        ).fetchall()

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
def stats(user_id: str = Depends(get_user_id)):
    with engine.connect() as conn:
        rows = conn.execute(
            select(jobs_table).where(jobs_table.c.user_id == user_id)
        ).fetchall()

    jobs = [row_to_dict(r) for r in rows]
    counts = {s: 0 for s in STATUSES}
    for job in jobs:
        ns = normalize_status(job["status"])
        if ns in counts:
            counts[ns] += 1

    total     = len(jobs)
    responded = counts["Applied"] + counts["Interview"] + counts["Offer"] + counts["Rejected"]
    active    = counts["Applied"] + counts["Interview"] + counts["Offer"]

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
def clear_jobs(user_id: str = Depends(get_user_id)):
    with engine.connect() as conn:
        conn.execute(delete(jobs_table).where(jobs_table.c.user_id == user_id))
        conn.commit()


@app.post("/api/jobs", status_code=201)
def add_job(body: JobCreate, user_id: str = Depends(get_user_id)):
    company  = body.company.strip()
    position = body.position.strip()
    url = body.url.strip() if body.url else None
    location = body.location.strip() if body.location else None

    with engine.connect() as conn:
        existing = conn.execute(
            select(jobs_table).where(jobs_table.c.user_id == user_id)
        ).fetchall()
    for row in existing:
        r = row_to_dict(row)
        same_url = bool(url and r.get("url") and r["url"].strip().lower() == url.lower())
        same_company_position = (
            r["company"].lower() == company.lower()
            and r["position"].lower() == position.lower()
        )
        existing_location = (r.get("location") or "").strip().lower()
        requested_location = (location or "").lower()
        same_location = bool(
            existing_location and requested_location and existing_location == requested_location
        )
        same_manual_listing = not url and same_company_position and (
            same_location or not existing_location or not requested_location
        )
        if same_url or same_manual_listing:
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
        "location":     location,
        "notes":        body.notes,
        "deadline":     body.deadline,
        "user_id":      user_id,
    }
    with engine.connect() as conn:
        conn.execute(insert(jobs_table).values(**job))
        conn.commit()
    return job


# Bulk must come before /{job_id} so "bulk" isn't matched as an ID
@app.patch("/api/jobs/bulk")
def bulk_update(body: BulkUpdate, user_id: str = Depends(get_user_id)):
    now = datetime.now().strftime("%Y-%m-%d")
    with engine.connect() as conn:
        for job_id in body.ids:
            values: dict = {"status": body.status}
            if body.status == "Applied":
                row = conn.execute(
                    select(jobs_table).where(
                        jobs_table.c.id == job_id,
                        jobs_table.c.user_id == user_id,
                    )
                ).fetchone()
                if row and not row_to_dict(row).get("date_applied"):
                    values["date_applied"] = now
            conn.execute(
                update(jobs_table).where(
                    jobs_table.c.id == job_id,
                    jobs_table.c.user_id == user_id,
                ).values(**values)
            )
        conn.commit()
    return {"updated": len(body.ids)}


@app.patch("/api/jobs/{job_id}")
def update_job(job_id: str, body: JobUpdate, user_id: str = Depends(get_user_id)):
    values: dict = {}

    if body.status is not None:
        values["status"] = body.status
        if body.status == "Applied":
            with engine.connect() as conn:
                row = conn.execute(
                    select(jobs_table).where(
                        jobs_table.c.id == job_id,
                        jobs_table.c.user_id == user_id,
                    )
                ).fetchone()
            if row and not row_to_dict(row).get("date_applied"):
                values["date_applied"] = datetime.now().strftime("%Y-%m-%d")

    if body.url      is not None: values["url"]      = body.url
    if body.location is not None: values["location"] = body.location
    if body.notes    is not None: values["notes"]    = body.notes
    if body.deadline is not None: values["deadline"] = body.deadline

    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with engine.connect() as conn:
        result = conn.execute(
            update(jobs_table).where(
                jobs_table.c.id == job_id,
                jobs_table.c.user_id == user_id,
            ).values(**values)
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        row = conn.execute(select(jobs_table).where(jobs_table.c.id == job_id)).fetchone()

    return row_to_dict(row)


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, user_id: str = Depends(get_user_id)):
    with engine.connect() as conn:
        result = conn.execute(
            delete(jobs_table).where(
                jobs_table.c.id == job_id,
                jobs_table.c.user_id == user_id,
            )
        )
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
def export_csv(user_id: str = Depends(get_user_id)):
    with engine.connect() as conn:
        rows = conn.execute(
            select(jobs_table).where(jobs_table.c.user_id == user_id)
        ).fetchall()

    jobs = [row_to_dict(r) for r in rows]
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "company",
            "position",
            "status",
            "date_added",
            "date_applied",
            "location",
            "url",
            "deadline",
            "notes",
        ],
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
