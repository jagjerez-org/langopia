import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function deriveDbName(name: string): string {
  return 'langopia_' + name.replace(/-/g, '_').replace(/[^a-z0-9_]/gi, '_');
}

export function readDbRegistry(worktreesDir: string): Record<string, string> {
  const file = join(worktreesDir, '.databases.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeDbRegistry(worktreesDir: string, registry: Record<string, string>): void {
  mkdirSync(worktreesDir, { recursive: true });
  writeFileSync(join(worktreesDir, '.databases.json'), JSON.stringify(registry, null, 2) + '\n');
}

export function registerDb(worktreesDir: string, name: string): string {
  const registry = readDbRegistry(worktreesDir);
  const dbName = deriveDbName(name);
  registry[name] = dbName;
  writeDbRegistry(worktreesDir, registry);
  return dbName;
}

export function parseDatabaseUrl(url: string): { user: string; password: string; host: string; port: string; db: string } {
  const match = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error(`Invalid DATABASE_URL: ${url}`);
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    db: match[5],
  };
}

export function databaseExists(dbName: string, env: { user: string; password: string; host: string; port: string }): boolean {
  const r = spawnSync(
    'psql',
    ['-U', env.user, '-h', env.host, '-p', env.port, '-d', 'postgres', '-t', '-c', `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
    { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: env.password } },
  );
  return r.status === 0 && r.stdout.trim().includes('1');
}

export function createDatabase(dbName: string, env: { user: string; password: string; host: string; port: string }): { ok: boolean; error?: string } {
  const r = spawnSync(
    'psql',
    ['-U', env.user, '-h', env.host, '-p', env.port, '-d', 'postgres', '-c', `CREATE DATABASE "${dbName}"`],
    { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: env.password } },
  );
  if (r.status !== 0) {
    const msg = (r.stderr || '').trim();
    if (msg.includes('already exists')) return { ok: true };
    return { ok: false, error: msg };
  }
  return { ok: true };
}
