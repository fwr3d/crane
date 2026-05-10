from sqlalchemy import create_engine, Column, String, MetaData, Table, text
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./crane.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
meta = MetaData()

jobs_table = Table(
    "jobs",
    meta,
    Column("id",           String, primary_key=True),
    Column("company",      String, nullable=False),
    Column("position",     String, nullable=False),
    Column("status",       String, nullable=False),
    Column("date_added",   String),
    Column("date_applied", String),
    Column("notes",        String),
    Column("url",          String),
    Column("location",     String),
    Column("deadline",     String),
    Column("user_id",      String),
    Column("salary",       String),
    Column("job_type",     String),
    Column("tags",         String),
    Column("source",       String),
    Column("job_id",       String),
    Column("logo_url",        String),
    Column("applicant_count", String),
)


def init_db():
    meta.create_all(engine)
    _migrate_columns()


def _migrate_columns():
    """Add new columns to an existing table without losing data."""
    is_postgres = "postgresql" in str(engine.url)
    new_cols = [
        ("notes", "TEXT"),
        ("url", "TEXT"),
        ("location", "TEXT"),
        ("deadline", "TEXT"),
        ("user_id", "TEXT"),
        ("salary", "TEXT"),
        ("job_type", "TEXT"),
        ("tags", "TEXT"),
        ("source", "TEXT"),
        ("job_id", "TEXT"),
        ("logo_url", "TEXT"),
        ("applicant_count", "INTEGER"),
    ]

    with engine.connect() as conn:
        for col, col_type in new_cols:
            try:
                if is_postgres:
                    conn.execute(text(f"ALTER TABLE jobs ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                else:
                    conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()
