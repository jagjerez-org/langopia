// scripts/worktree/cmd/dev.ts
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { parseArgs } from '../args.ts';

export function dev(root: string, args: string[]): void {
  const { flags, positional } = parseArgs(args);
  const name = positional[0] || 'main';
  const cwd = name === 'main' ? root : join(root, '.worktrees', name);

  if (name !== 'main' && !existsSync(cwd)) {
    console.error(`Worktree not found: ${cwd}`);
    process.exit(1);
  }

  const validApps = ['web', 'api', 'sites'];
  let filters: string[] = [];
  if (flags.filter) {
    filters = String(flags.filter)
      .split(',')
      .map((f) => f.trim())
      .filter((f) => validApps.includes(f));
  }

  console.log(`Starting dev for ${name}...`);
  if (filters.length > 0) {
    for (const app of filters) {
      spawnSync('npm', ['run', `${app}:dev`], { cwd, stdio: 'inherit', shell: true });
    }
  } else {
    spawnSync('npm', ['run', 'dev'], { cwd, stdio: 'inherit', shell: true });
  }
}
