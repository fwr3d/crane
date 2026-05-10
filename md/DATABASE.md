# Crane Database

Crane uses SQLite locally by default and PostgreSQL in production when `DATABASE_URL` is set.

## Railway PostgreSQL

1. Add a PostgreSQL service to the Railway project.
2. In the Crane service, set `DATABASE_URL` to the PostgreSQL connection string from Railway.
3. Redeploy Crane. On startup, `init_db()` creates the required tables.

The app accepts both `postgres://...` and `postgresql://...` URLs.

## Migrate Existing Local Data

From the project root:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB"
python scripts/migrate_sqlite_to_postgres.py --sqlite crane.db --replace
```

Omit `--replace` to append into an existing target database.

## Backups

Create a JSON backup:

```powershell
python scripts/backup_database.py --out-dir backups
```

For Railway scheduled backups, create a second service or scheduled job that runs:

```bash
python scripts/backup_database.py --out-dir /data/backups
```

Use a Railway volume for `/data/backups` if you want backups to survive redeploys. Keep count is controlled by `BACKUP_KEEP`, default `20`.

The app also exposes:

- `GET /api/backup` for manual JSON backup download
- `POST /api/restore` for restoring a JSON backup
