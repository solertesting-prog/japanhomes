#!/bin/sh
# Applies pending Prisma migrations. Accepts DATABASE_URL, or DB_HOST/DB_USER/
# DB_PASSWORD (+ DB_PORT, DB_NAME, DB_SSLMODE) as injected by ECS from the
# RDS-managed secret.
set -eu
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node -e '
    const e = process.env, enc = encodeURIComponent;
    if (!e.DB_HOST || !e.DB_USER || !e.DB_PASSWORD) { console.error("DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD required"); process.exit(1); }
    process.stdout.write(`postgresql://${enc(e.DB_USER)}:${enc(e.DB_PASSWORD)}@${e.DB_HOST}:${e.DB_PORT || 5432}/${enc(e.DB_NAME || "jpt")}?sslmode=${e.DB_SSLMODE || "require"}`);
  ')"
  export DATABASE_URL
fi
cd /repo/packages/database
exec npx --no-install prisma migrate deploy
