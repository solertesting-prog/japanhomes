import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Local development convenience: load the monorepo root `.env` before the
 * configuration is validated. Variables already present in the process
 * environment always win, so production (where secrets come from the
 * orchestrator) is unaffected and no file is required.
 *
 * Needed because task runners such as Turborepo filter the environment they
 * pass to child processes, so exporting variables in the parent shell is not
 * enough on its own.
 */
export function loadDotenv(candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]): void {
  if (process.env.NODE_ENV === 'production') return;
  const file = candidates.find((p) => existsSync(p));
  if (!file) return;
  // Windows editors and PowerShell 5 may prepend a BOM and use CRLF.
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/**
 * On AWS the database password lives in the RDS-managed secret and reaches the
 * task as DB_PASSWORD; the connection URL is assembled here so the secret is
 * never written into task definitions or images.
 */
export function composeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): void {
  if (env.DATABASE_URL || !env.DB_HOST || !env.DB_USER || !env.DB_PASSWORD) return;
  const user = encodeURIComponent(env.DB_USER);
  const password = encodeURIComponent(env.DB_PASSWORD);
  const port = env.DB_PORT ?? '5432';
  const name = encodeURIComponent(env.DB_NAME ?? 'jpt');
  const ssl = env.DB_SSLMODE ?? 'require';
  env.DATABASE_URL = `postgresql://${user}:${password}@${env.DB_HOST}:${port}/${name}?sslmode=${ssl}`;
}

loadDotenv();
composeDatabaseUrl();
