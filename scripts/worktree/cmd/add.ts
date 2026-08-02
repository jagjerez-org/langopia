// scripts/worktree/cmd/add.ts
import { execSync, spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from '../args.ts';
import { createDatabase, databaseExists, deriveDbName, parseDatabaseUrl, readDbRegistry, registerDb, writeDbRegistry } from '../db.ts';
import { buildWorktreeEnv } from '../env.ts';
import { branchExists, runGit } from '../git.ts';
import { assignOffset, getPorts } from '../ports.ts';

export function add(root: string, args: string[]): void {
  const { flags, positional } = parseArgs(args);
  const name = positional[0];

  if (!name) {
    console.error('Usage: wt:add <name> [--from <branch>] [--no-db] [--seed]');
    process.exit(1);
  }

  if (/[^a-zA-Z0-9._-]/.test(name)) {
    console.error(`Invalid worktree name: "${name}". Use only letters, numbers, dots, hyphens, underscores.`);
    process.exit(1);
  }

  const baseBranch = (flags.from as string) || 'main';
  if (!branchExists(baseBranch)) {
    console.error(`Branch "${baseBranch}" does not exist.`);
    process.exit(1);
  }

  const worktreesDir = join(root, '.worktrees');
  const worktreePath = join(worktreesDir, name);

  if (existsSync(worktreePath)) {
    console.error(`Worktree already exists: ${worktreePath}`);
    process.exit(1);
  }

  mkdirSync(worktreesDir, { recursive: true });

  console.log(`Creating worktree .worktrees/${name} (branch: ${name}, from: ${baseBranch})`);
  try {
    runGit(['worktree', 'add', worktreePath, '-b', name, baseBranch], { stdio: 'inherit' });
  } catch {
    try {
      runGit(['worktree', 'add', worktreePath, name], { stdio: 'inherit' });
    } catch {
      console.error(`Failed to create worktree. Branch "${name}" may be checked out elsewhere.`);
      process.exit(1);
    }
  }

  // Copy root .env
  const rootEnvPath = join(root, '.env');
  const worktreeEnvPath = join(worktreePath, '.env');
  if (existsSync(rootEnvPath)) {
    copyFileSync(rootEnvPath, worktreeEnvPath);
  }

  // Assign port offset
  const offset = assignOffset(worktreesDir, name);
  const ports = getPorts(name, offset);

  // Register isolated DB
  let dbName: string | null = null;
  if (!flags['no-db']) {
    dbName = registerDb(worktreesDir, name);
  }

  // Rewrite env
  if (existsSync(worktreeEnvPath) && dbName) {
    const rootEnv = readFileSync(rootEnvPath, 'utf-8');
    const nextEnv = buildWorktreeEnv(rootEnv, name, dbName, ports);
    writeFileSync(worktreeEnvPath, nextEnv);
  }

  // Install dependencies
  console.log('Installing dependencies...');
  try {
    execSync('npm install', { cwd: worktreePath, stdio: 'inherit' });
  } catch {
    console.error('npm install failed. Run manually inside the worktree.');
  }

  // DB setup
  let dbReady = false;
  if (dbName && existsSync(rootEnvPath)) {
    const rootEnv = readFileSync(rootEnvPath, 'utf-8');
    const dbUrlMatch = rootEnv.match(/^DATABASE_URL=(.+)$/m);
    if (dbUrlMatch) {
      const parsed = parseDatabaseUrl(dbUrlMatch[1]);
      const env = { user: parsed.user, password: parsed.password, host: parsed.host, port: parsed.port };
      console.log(`Setting up database: ${dbName}`);
      const created = createDatabase(dbName, env);
      if (created.ok) {
        dbReady = true;
        console.log(`  Database "${dbName}" ready`);
        try {
          execSync('npm run db:migrate', { cwd: worktreePath, stdio: 'inherit' });
        } catch {
          console.error('  Migrations failed. Run manually: wt:db ' + name + ' migrate');
        }
      } else {
        console.error(`  Could not create database: ${created.error}`);
      }
    }
  }

  // Open VSCode
  const vsResult = spawnSync('code', [worktreePath], { stdio: 'ignore' });
  if (vsResult.status === 0) console.log('VSCode window opened.');
  else console.log(`Open manually: code ${worktreePath}`);

  // Summary
  console.log('');
  console.log(`Worktree ready: .worktrees/${name}`);
  console.log(`  Branch: ${name}`);
  console.log(`  Ports:  web=${ports.web} api=${ports.api} sites=${ports.sites} (offset: +${offset})`);
  console.log(`  DB:     ${dbName ? dbName + (dbReady ? ' ✓' : ' (pending)') : 'shared'}`);
}
