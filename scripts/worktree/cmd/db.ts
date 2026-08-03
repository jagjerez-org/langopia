import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from '../args.ts';
import { createDatabase, databaseExists, deriveDbName, parseDatabaseUrl, readDbRegistry, registerDb } from '../db.ts';

export function db(root: string, args: string[]): void {
  const { positional } = parseArgs(args);
  const name = positional[0];
  const subcommand = positional[1];

  if (!name) {
    console.error('Usage: wt:db <name> [init|push|migrate|generate|seed|studio|status|drop|clone]');
    process.exit(1);
  }

  const worktreePath = join(root, '.worktrees', name);
  if (!existsSync(worktreePath)) {
    console.error(`Worktree not found: ${worktreePath}`);
    process.exit(1);
  }

  const worktreesDir = join(root, '.worktrees');
  const registeredDb = readDbRegistry(worktreesDir)[name];

  if (!subcommand || subcommand === 'status') {
    console.log(`Worktree: ${name}`);
    console.log(`Database: ${registeredDb || 'shared (no isolation)'}`);
    if (registeredDb) {
      // Try to check existence
      const envPath = join(root, '.env');
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        const match = content.match(/^DATABASE_URL=(.+)$/m);
        if (match) {
          const parsed = parseDatabaseUrl(match[1]);
          const exists = databaseExists(registeredDb, {
            user: parsed.user,
            password: parsed.password,
            host: parsed.host,
            port: parsed.port,
          });
          console.log(`Status:   ${exists ? '✓ accessible' : '✗ not found'}`);
        }
      }
    }
    return;
  }

  if (subcommand === 'init') {
    const dbName = registeredDb || deriveDbName(name);
    if (!registeredDb) registerDb(worktreesDir, name);
    const envPath = join(root, '.env');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        const parsed = parseDatabaseUrl(match[1]);
        const env = { user: parsed.user, password: parsed.password, host: parsed.host, port: parsed.port };
        if (!databaseExists(dbName, env)) {
          const created = createDatabase(dbName, env);
          if (!created.ok) {
            console.error(`Failed to create database: ${created.error}`);
            process.exit(1);
          }
        }
        execSync('npm run db:migrate', { cwd: worktreePath, stdio: 'inherit' });
        console.log(`Database "${dbName}" ready.`);
      }
    }
    return;
  }

  const npmMap: Record<string, string> = {
    push: 'db:push',
    migrate: 'db:migrate',
    generate: 'db:generate',
    seed: 'db:seed',
    studio: 'db:studio',
  };

  if (npmMap[subcommand]) {
    if (!registeredDb) {
      console.error(`No isolated DB for "${name}". Run: wt:db ${name} init`);
      process.exit(1);
    }
    execSync(`npm run ${npmMap[subcommand]}`, { cwd: worktreePath, stdio: 'inherit' });
    return;
  }

  console.error(`Unknown subcommand: ${subcommand}`);
  process.exit(1);
}
