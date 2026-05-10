import argparse
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, delete, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import (
    documents_table,
    events_table,
    interviews_table,
    jobs_table,
    meta,
    normalize_database_url,
)


TABLES = [jobs_table, events_table, interviews_table, documents_table]


def copy_table(source_engine, target_engine, table, replace: bool):
    with source_engine.connect() as source, target_engine.connect() as target:
        rows = [dict(row._mapping) for row in source.execute(select(table)).fetchall()]
        if replace:
            target.execute(delete(table))
        for row in rows:
            target.execute(table.insert().values(**row))
        target.commit()
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Copy Crane data from local SQLite into PostgreSQL.")
    parser.add_argument("--sqlite", default="sqlite:///./crane.db", help="Source SQLite URL or path.")
    parser.add_argument("--postgres", default=os.environ.get("DATABASE_URL"), help="Target PostgreSQL DATABASE_URL.")
    parser.add_argument("--replace", action="store_true", help="Clear target tables before copying.")
    args = parser.parse_args()

    if not args.postgres:
        raise SystemExit("Provide --postgres or set DATABASE_URL.")

    sqlite_url = args.sqlite if "://" in args.sqlite else f"sqlite:///{args.sqlite}"
    postgres_url = normalize_database_url(args.postgres)

    source_engine = create_engine(sqlite_url)
    target_engine = create_engine(postgres_url, pool_pre_ping=True)
    meta.create_all(target_engine)

    counts = {}
    for table in TABLES:
        counts[table.name] = copy_table(source_engine, target_engine, table, args.replace)

    print("Migration complete:")
    for name, count in counts.items():
        print(f"  {name}: {count}")


if __name__ == "__main__":
    main()
