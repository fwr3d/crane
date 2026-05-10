import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import (
    create_app_engine,
    documents_table,
    events_table,
    interviews_table,
    jobs_table,
)


TABLES = {
    "jobs": jobs_table,
    "events": events_table,
    "interviews": interviews_table,
    "documents": documents_table,
}


def read_table(conn, table):
    return [dict(row._mapping) for row in conn.execute(select(table)).fetchall()]


def main():
    parser = argparse.ArgumentParser(description="Create a Crane JSON database backup.")
    parser.add_argument("--out-dir", default=os.environ.get("BACKUP_DIR", "backups"))
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--keep", type=int, default=int(os.environ.get("BACKUP_KEEP", "20")))
    args = parser.parse_args()

    engine = create_app_engine(args.database_url) if args.database_url else create_app_engine()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d_%H%M%S")
    path = out_dir / f"crane_backup_{stamp}.json"

    with engine.connect() as conn:
        payload = {
            "version": 1,
            "exported_at": now.isoformat().replace("+00:00", "Z"),
            **{name: read_table(conn, table) for name, table in TABLES.items()},
        }

    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    backups = sorted(out_dir.glob("crane_backup_*.json"), reverse=True)
    for old in backups[args.keep:]:
        old.unlink(missing_ok=True)

    print(path)


if __name__ == "__main__":
    main()
