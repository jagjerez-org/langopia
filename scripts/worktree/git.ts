import { execSync } from 'child_process';
import { basename, dirname, isAbsolute, join, resolve } from 'path';

export function resolveRepoRoot(): string {
  try {
    const common = execSync('git rev-parse --git-common-dir', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (common) return dirname(isAbsolute(common) ? common : resolve(process.cwd(), common));
  } catch {
    // not inside a git repo
  }
  return process.cwd();
}

export function runGit(
  args: string[],
  opts: { cwd?: string; stdio?: 'pipe' | 'inherit' } = {},
): string {
  const result = execSync(`git ${args.map((a) => `"${a}"`).join(' ')}`, {
    encoding: 'utf-8',
    cwd: opts.cwd ?? resolveRepoRoot(),
    stdio: opts.stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'ignore'],
  });
  return (result ?? '').trim();
}

export function branchExists(branch: string): boolean {
  try {
    runGit(['rev-parse', '--verify', branch]);
    return true;
  } catch {
    return false;
  }
}

export function getActiveWorktreeNames(root: string): string[] {
  try {
    const output = runGit(['worktree', 'list', '--porcelain']);
    const names: string[] = [];
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        const wtPath = line.slice(9);
        if (wtPath.includes('.worktrees') && !wtPath.includes('/.claude/')) {
          names.push(basename(wtPath));
        }
      }
    }
    return names;
  } catch {
    return [];
  }
}
