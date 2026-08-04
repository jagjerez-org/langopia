import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_PORTS = { app: 5173, api: 3000, sites: 4321 };

export function readPortRegistry(worktreesDir: string): Record<string, number> {
  const file = join(worktreesDir, '.ports.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

export function writePortRegistry(worktreesDir: string, registry: Record<string, number>): void {
  mkdirSync(worktreesDir, { recursive: true });
  writeFileSync(join(worktreesDir, '.ports.json'), JSON.stringify(registry, null, 2) + '\n');
}

export function assignOffset(worktreesDir: string, name: string): number {
  const registry = readPortRegistry(worktreesDir);
  if (registry[name] !== undefined) return registry[name];
  const used = new Set(Object.values(registry));
  let offset = 1;
  while (used.has(offset)) offset++;
  registry[name] = offset;
  writePortRegistry(worktreesDir, registry);
  return offset;
}

export function getPorts(name: string, offset: number): { app: number; api: number; sites: number } {
  return {
    app: BASE_PORTS.app + offset,
    api: BASE_PORTS.api + offset,
    sites: BASE_PORTS.sites + offset,
  };
}
