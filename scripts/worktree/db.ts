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
