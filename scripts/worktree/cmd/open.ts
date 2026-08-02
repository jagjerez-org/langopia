// scripts/worktree/cmd/open.ts
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { parseArgs } from '../args.ts';

export function open(root: string, args: string[]): void {
  const { positional } = parseArgs(args);
  const name = positional[0];
  if (!name) {
    console.error('Usage: wt:open <name>');
    process.exit(1);
  }
  const worktreePath = join(root, '.worktrees', name);
  if (!existsSync(worktreePath)) {
    console.error(`Worktree not found: ${worktreePath}`);
    process.exit(1);
  }
  const result = spawnSync('code', [worktreePath], { stdio: 'ignore' });
  if (result.status === 0) console.log(`VSCode opened: ${worktreePath}`);
  else {
    console.error(`Failed to open VSCode. Try manually: code ${worktreePath}`);
    process.exit(1);
  }
}
