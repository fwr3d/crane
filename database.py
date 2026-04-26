from sqlalchemy import create_engine, Column, String, MetaData, Table
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./crane.db")

# Railway provides postgres:// but SQLAlchemy 2.x requires postgresql://
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
)


def init_db():
    meta.create_all(engine)
