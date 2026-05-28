# Project Sync System — Deployment Notes

This document describes what changed and what you need to do on production / staging
to bring the project-sync feature live.

## What's new

A complete FL Studio project syncing system, paired with a Tauri desktop app.

- **5 new Prisma models** (`Project`, `ProjectVersion`, `ProjectFileEntry`,
  `ProjectFileBlob`, `ProjectTrackLink`) in `prisma/schema.prisma`
- **1 SQL migration**: `prisma/migrations/20260528000000_add_projects`
- **New service** `src/services/ProjectSyncService.ts` (blob dedup, version finalize,
  export-ZIP generation)
- **New routes file** `src/api/routes/projects.ts` registered from `src/api/index.ts`
  - OAuth device flow: `POST /api/oauth/device/start`, `/poll`, `GET /verify`
  - Project CRUD: `GET/POST/PUT/DELETE /api/projects[/<id>]`
  - Sync protocol: `POST /api/projects/:id/versions/{check,upload-file,complete}`
  - Version history + diff
  - Publish/unpublish: `POST /api/projects/:id/{publish,unpublish}`
  - Download: `GET /api/projects/:id/download/:versionId`
- **Dashboard pages** (`/projects`, `/projects/:projectId`)
- **Track page integration** — when a track has a linked project version,
  it shows a "Synced" banner with the version number, file count, and (for the owner)
  a link back to the source project.
- **Track API response** now includes `projectLink` (with version + project) on
  `GET /api/musician/tracks/:username/:trackSlug` and `GET /api/musician/profile/:userId`.
- **Global** `BigInt.prototype.toJSON` polyfill added near the top of
  `src/api/index.ts` so `totalSize: BigInt` serialises cleanly.

## R2 storage layout

```
project-blobs/<2-char hash prefix>/<remaining 62-char hash>   # raw deduplicated files
projects/<projectId>/exports/<versionId>.zip                  # published export ZIPs
```

If R2 isn't configured, files fall back to `public/uploads/project-blobs/...`
and `public/uploads/project-exports/...`.

## Deployment steps (staging first, then prod)

The standard deploy from `CLAUDE.md` already runs `npm install` (which now also runs
`prisma generate`) and `npm run build` (which runs `tsc` + `prisma generate` again).
You'll need to run `prisma migrate deploy` **before** restarting the API process so
the new tables exist when the new code tries to query them.

### Staging

```bash
ssh root@143.198.136.83 'cd ~/simon-bot \
  && git pull origin staging \
  && npm install \
  && npx prisma migrate deploy \
  && npm run build \
  && npm run dashboard:build \
  && pm2 restart all'
```

### Production

```bash
ssh root@143.198.51.52 'cd ~/simon-bot \
  && git pull \
  && npm install \
  && npx prisma migrate deploy \
  && npm run build \
  && npm run dashboard:build \
  && pm2 restart all'
```

If `prisma migrate deploy` fails because the production DB's `_prisma_migrations`
table doesn't yet contain the migrations in your repo, run `npx prisma migrate
resolve --applied <name>` to mark already-applied migrations as applied, then
re-run `migrate deploy`. See <https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing>.

## Verifying the deploy

Run these in order on the deployed host (replace `localhost:3001` with the API
process's port):

```bash
# 1. Migration applied — should list our new migration as 'applied'
sudo -u postgres psql -d fujistudio -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;"

# 2. New tables exist
sudo -u postgres psql -d fujistudio -c \
  "\dt projects project_versions project_file_entries project_file_blobs project_track_links"

# 3. API is responding to the new routes (will return 401 because no auth — that's fine)
curl -i http://localhost:3001/api/projects
```

## Rolling back

The migration is purely additive (new tables only — no changes to existing tables).
To roll back:

```sql
DROP TABLE IF EXISTS "project_track_links";
DROP TABLE IF EXISTS "project_file_entries";
DROP TABLE IF EXISTS "project_file_blobs";
DROP TABLE IF EXISTS "project_versions";
DROP TABLE IF EXISTS "projects";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260528000000_add_projects';
```

Then revert the code commit and `pm2 restart all`.

## Notes

- The OAuth device flow stores pending auths in **process memory** (a `Map` in
  `routes/projects.ts`). They expire after 10 minutes. If the API process restarts
  during an active device-auth flow, the user must restart the login from the
  desktop app. This is acceptable for a low-traffic feature, but if it becomes
  problematic, persist them to the DB.
- The `BigInt.prototype.toJSON` polyfill coerces to `Number`. Project sizes well
  below `2^53` (8 PiB) are safe; if anyone tries to upload >8 PiB we have bigger
  problems than serialization precision.
