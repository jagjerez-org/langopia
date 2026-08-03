#!/usr/bin/env node
// scripts/worktree.ts
import { add } from './worktree/cmd/add.ts';
import { clean } from './worktree/cmd/clean.ts';
import { db } from './worktree/cmd/db.ts';
import { dev } from './worktree/cmd/dev.ts';
import { list } from './worktree/cmd/list.ts';
import { open } from './worktree/cmd/open.ts';
import { remove } from './worktree/cmd/remove.ts';
import { resolveRepoRoot } from './worktree/git.ts';

const root = resolveRepoRoot();
const command = process.argv[2];
const args = process.argv.slice(3);

const commands: Record<string, (root: string, args: string[]) => void> = {
  add,
  remove,
  list,
  open,
  dev,
  db,
  clean,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: wt:<add|remove|list|open|dev|db|clean> [args]');
  process.exit(1);
}

handler(root, args);
