// scripts/worktree/cmd/clean.ts
import { execSync } from 'child_process';
import { existsSync, readdirSync, rmdirSync, statSync } from 'fs';
import { join } from 'path';
import { parseArgs } from '../args.ts';
import { getActiveWorktreeNames } from '../git.ts';

export function clean(root: string, args: string[]): void {
  const { flags } = parseArgs(args);
  const worktreesDir = join(root, '.worktrees');
  if (!existsSync(worktreesDir)) {
    console.log('No .worktrees directory.');
    return;
  }

  const active = new Set(getActiveWorktreeNames(root));
  const entries = readdirSync(worktreesDir).filter((e) => !e.startsWith('.') && statSync(join(worktreesDir, e)).isDirectory());
  const orphans = entries.filter((e) => !active.has(e));

  if (orphans.length === 0) {
    console.log('No orphaned worktree directories.');
    return;
  }

  console.log(`Orphaned directories: ${orphans.join(', ')}`);
  if (!flags.all) {
    console.log('Run with --all to remove them.');
    return;
  }

  for (const orphan of orphans) {
    const path = join(worktreesDir, orphan);
    try {
      rmdirSync(path, { recursive: true });
      console.log(`Removed ${path}`);
    } catch (err) {
      console.error(`Failed to remove ${path}: ${err}`);
    }
  }
  execSync('git worktree prune', { cwd: root, stdio: 'inherit' });
}
