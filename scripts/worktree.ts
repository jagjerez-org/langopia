import { resolveRepoRoot } from './worktree/git.ts';
import { list } from './worktree/cmd/list.ts';

const root = resolveRepoRoot();
const command = process.argv[2];
const args = process.argv.slice(3);

if (command === 'list') {
  list(root);
} else {
  console.error(`Unknown command: ${command ?? ''}`);
  process.exit(1);
}
