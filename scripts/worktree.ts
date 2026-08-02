import { resolveRepoRoot } from './worktree/git.ts';
import { clean } from './worktree/cmd/clean.ts';
import { list } from './worktree/cmd/list.ts';

const root = resolveRepoRoot();
const command = process.argv[2];
const args = process.argv.slice(3);

if (command === 'list') {
  list(root);
} else if (command === 'clean') {
  clean(root, args);
} else {
  console.error(`Unknown command: ${command ?? ''}`);
  process.exit(1);
}
