// scripts/worktree/cmd/list.ts
import { basename } from 'path';
import { getActiveWorktreeNames } from '../git.ts';
import { readDbRegistry } from '../db.ts';
import { getPorts, readPortRegistry } from '../ports.ts';

export function list(root: string): void {
  const names = getActiveWorktreeNames(root);
  if (names.length === 0) {
    console.log('No worktrees found.');
    return;
  }

  const portsReg = readPortRegistry(root + '/.worktrees');
  const dbReg = readDbRegistry(root + '/.worktrees');

  const rows = names.map((name) => {
    const offset = portsReg[name] ?? 0;
    const ports = name === 'main' ? { app: 5173, api: 3000, sites: 4321 } : getPorts(name, offset);
    const db = dbReg[name] ?? 'shared';
    return { name, branch: name, ports, db };
  });

  const maxName = Math.max(...rows.map((r) => r.name.length), 4);
  console.log('');
  console.log(`  ${'NAME'.padEnd(maxName + 2)}BRANCH  APP    API    SITES  DB`);
  console.log('  ' + '─'.repeat(maxName + 38));
  for (const row of rows) {
    console.log(
      `  ${row.name.padEnd(maxName + 2)}${row.branch.padEnd(7)}` +
        `${String(row.ports.app).padEnd(7)}${String(row.ports.api).padEnd(7)}${String(row.ports.sites).padEnd(7)}${row.db}`,
    );
  }
  console.log('');
}
