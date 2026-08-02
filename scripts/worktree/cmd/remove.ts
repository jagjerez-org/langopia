// scripts/worktree/cmd/remove.ts
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from '../args.ts';
import { dropDatabase, readDbRegistry, writeDbRegistry } from '../db.ts';
import { runGit } from '../git.ts';
import { readPortRegistry, writePortRegistry } from '../ports.ts';

export function remove(root: string, args: string[]): void {
  const { flags, positional } = parseArgs(args);
  const name = positional[0];

  if (!name) {
    console.error('Usage: wt:remove <name> [--branch] [--keep-db]');
    process.exit(1);
  }

  if (name === 'main') {
    console.error('Cannot remove the main worktree.');
    process.exit(1);
  }

  const worktreePath = join(root, '.worktrees', name);
  if (!existsSync(worktreePath)) {
    console.error(`Worktree not found: ${worktreePath}`);
    process.exit(1);
  }

  const dbRegistry = readDbRegistry(root + '/.worktrees');
  const dbName = dbRegistry[name];

  console.log(`Removing worktree: ${worktreePath}`);
  try {
    runGit(['worktree', 'remove', worktreePath], { stdio: 'inherit' });
  } catch {
    console.error('');
    console.error('Worktree has uncommitted changes. Options:');
    console.error(`  1. Commit or stash changes in ${worktreePath}`);
    console.error(`  2. Force remove: git worktree remove "${worktreePath}" --force`);
    process.exit(1);
  }

  runGit(['worktree', 'prune']);

  // Clean registries
  const portsReg = readPortRegistry(root + '/.worktrees');
  if (portsReg[name] !== undefined) {
    delete portsReg[name];
    writePortRegistry(root + '/.worktrees', portsReg);
  }
  if (dbRegistry[name] !== undefined) {
    delete dbRegistry[name];
    writeDbRegistry(root + '/.worktrees', dbRegistry);
  }

  // Drop DB
  if (dbName && !flags['keep-db']) {
    console.log(`Dropping database "${dbName}"...`);
    // Need credentials from root .env
    const envPath = join(root, '.env');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        const parsed = match[1].match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
        if (parsed) {
          const dropped = dropDatabase(dbName, {
            user: parsed[1],
            password: parsed[2],
            host: parsed[3],
            port: parsed[4],
          });
          console.log(dropped ? `  Database "${dbName}" dropped` : `  Could not drop "${dbName}"`);
        }
      }
    }
  }

  if (flags.branch) {
    try {
      runGit(['branch', '-d', name], { stdio: 'inherit' });
    } catch {
      console.log(`Branch "${name}" not fully merged. Delete with: git branch -D ${name}`);
    }
  }

  console.log('Worktree removed.');
}
