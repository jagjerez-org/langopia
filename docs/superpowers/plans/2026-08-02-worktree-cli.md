# CLI de Git Worktrees para Langopia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un CLI TypeScript (`scripts/worktree.ts`) para crear, gestionar y eliminar Git worktrees aislados en `.worktrees/`, con asignación automática de puertos y bases de datos Postgres aisladas por worktree.

**Architecture:** El CLI se divide en un entry point (`scripts/worktree.ts`) que despacha subcomandos, y módulos auxiliares puros en `scripts/worktree/` para parseo de args, operaciones git, registro de puertos/DB y reescritura de `.env`. Cada subcomando es una función que orquesta helpers; la lógica pura se testea con Node test runner.

**Tech Stack:** TypeScript, Node 22, `tsx`, `child_process`, `fs`, `path`, npm workspaces, Git, Postgres local.

## Global Constraints

- La carpeta de worktrees es `.worktrees/` y debe estar en `.gitignore`.
- El prefijo de scripts npm es `wt:` (ej. `wt:add`).
- El step de offset de puertos es `1`.
- Puertos base: web=5173, api=3000, sites=4321.
- Nombre de DB aislada: `langopia_<name>` (reemplazando `-` por `_`).
- `tsx` se añade como `devDependency` en root.
- No se añaden tests de integración contra git/Postgres; solo tests unitarios para funciones puras.

---

## Task 1: Scaffolding y configuración inicial

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- No produce interfaces; prepara el entorno.

- [ ] **Step 1: Añadir `tsx` como devDependency en root**

  En `package.json`, dentro de `devDependencies`, añadir:

  ```json
  "tsx": "^4.20.0"
  ```

- [ ] **Step 2: Añadir scripts `wt:*` en root**

  En `package.json`, dentro de `scripts`, añadir al final:

  ```json
  "wt:add": "tsx scripts/worktree.ts add",
  "wt:remove": "tsx scripts/worktree.ts remove",
  "wt:list": "tsx scripts/worktree.ts list",
  "wt:open": "tsx scripts/worktree.ts open",
  "wt:dev": "tsx scripts/worktree.ts dev",
  "wt:db": "tsx scripts/worktree.ts db",
  "wt:clean": "tsx scripts/worktree.ts clean"
  ```

- [ ] **Step 3: Añadir `.worktrees/` a `.gitignore`**

  Añadir al final de `.gitignore`:

  ```gitignore
  # Git worktrees
  .worktrees/
  ```

- [ ] **Step 4: Instalar dependencias**

  Run:
  ```bash
  npm install
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add package.json .gitignore package-lock.json
  git commit -m "chore: configura tsx y scripts wt:* para CLI de worktrees"
  ```

---

## Task 2: Módulo de parseo de argumentos

**Files:**
- Create: `scripts/worktree/args.ts`
- Create: `scripts/worktree/__tests__/args.test.ts`

**Interfaces:**
- Produces: `parseArgs(args: string[]): { flags: Record<string, string | boolean>; positional: string[] }`

- [ ] **Step 1: Escribir test fallido**

  ```typescript
  // scripts/worktree/__tests__/args.test.ts
  import assert from 'node:assert';
  import test from 'node:test';
  import { parseArgs } from '../args.ts';

  test('parseArgs extracts flags and positionals', () => {
    const result = parseArgs(['add', 'feature-x', '--from', 'main', '--seed']);
    assert.deepStrictEqual(result.positional, ['add', 'feature-x']);
    assert.strictEqual(result.flags.from, 'main');
    assert.strictEqual(result.flags.seed, true);
  });

  test('parseArgs treats lone flags as boolean', () => {
    const result = parseArgs(['--no-db']);
    assert.strictEqual(result.flags['no-db'], true);
    assert.deepStrictEqual(result.positional, []);
  });
  ```

- [ ] **Step 2: Correr test y verificar que falla**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/args.test.ts
  ```
  Expected: FAIL con "parseArgs is not defined" o similar.

- [ ] **Step 3: Implementar `parseArgs`**

  ```typescript
  // scripts/worktree/args.ts
  export function parseArgs(args: string[]): {
    flags: Record<string, string | boolean>;
    positional: string[];
  } {
    const flags: Record<string, string | boolean> = {};
    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          flags[key] = args[i + 1];
          i++;
        } else {
          flags[key] = true;
        }
      } else {
        positional.push(arg);
      }
    }

    return { flags, positional };
  }
  ```

- [ ] **Step 4: Correr test y verificar que pasa**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/args.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/worktree/args.ts scripts/worktree/__tests__/args.test.ts
  git commit -m "feat(worktree): añade parseArgs para CLI"
  ```

---

## Task 3: Módulo de utilidades git

**Files:**
- Create: `scripts/worktree/git.ts`

**Interfaces:**
- Produces:
  - `resolveRepoRoot(): string`
  - `runGit(args: string[], opts?: { cwd?: string; stdio?: 'pipe' | 'inherit' }): string`
  - `getActiveWorktreeNames(root: string): string[]`
  - `branchExists(branch: string): boolean`

- [ ] **Step 1: Implementar `resolveRepoRoot`**

  ```typescript
  // scripts/worktree/git.ts
  import { execSync } from 'child_process';
  import { dirname, isAbsolute, resolve } from 'path';

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
  ```

- [ ] **Step 2: Implementar `runGit` y `branchExists`**

  Añadir al mismo archivo:

  ```typescript
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
  ```

- [ ] **Step 3: Implementar `getActiveWorktreeNames`**

  Añadir:

  ```typescript
  import { basename, join } from 'path';

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
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add scripts/worktree/git.ts
  git commit -m "feat(worktree): añade helpers git para root, runGit y listado"
  ```

---

## Task 4: Módulo de registro de puertos

**Files:**
- Create: `scripts/worktree/ports.ts`
- Create: `scripts/worktree/__tests__/ports.test.ts`

**Interfaces:**
- Produces:
  - `readPortRegistry(worktreesDir: string): Record<string, number>`
  - `writePortRegistry(worktreesDir: string, registry: Record<string, number>): void`
  - `assignOffset(worktreesDir: string, name: string): number`
  - `getPorts(name: string, offset: number): { web: number; api: number; sites: number }`

- [ ] **Step 1: Escribir test fallido**

  ```typescript
  // scripts/worktree/__tests__/ports.test.ts
  import assert from 'node:assert';
  import test from 'node:test';
  import { getPorts, assignOffset } from '../ports.ts';

  test('getPorts returns base + offset', () => {
    const ports = getPorts('feature', 3);
    assert.strictEqual(ports.web, 5176);
    assert.strictEqual(ports.api, 3003);
    assert.strictEqual(ports.sites, 4324);
  });
  ```

- [ ] **Step 2: Correr test y verificar que falla**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/ports.test.ts
  ```
  Expected: FAIL.

- [ ] **Step 3: Implementar módulo de puertos**

  ```typescript
  // scripts/worktree/ports.ts
  import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
  import { join } from 'path';

  const BASE_PORTS = { web: 5173, api: 3000, sites: 4321 };

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

  export function getPorts(name: string, offset: number): { web: number; api: number; sites: number } {
    return {
      web: BASE_PORTS.web + offset,
      api: BASE_PORTS.api + offset,
      sites: BASE_PORTS.sites + offset,
    };
  }
  ```

- [ ] **Step 4: Correr test y verificar que pasa**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/ports.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/worktree/ports.ts scripts/worktree/__tests__/ports.test.ts
  git commit -m "feat(worktree): añade registro y asignación de puertos"
  ```

---

## Task 5: Módulo de gestión de base de datos

**Files:**
- Create: `scripts/worktree/db.ts`
- Create: `scripts/worktree/__tests__/db.test.ts`

**Interfaces:**
- Produces:
  - `deriveDbName(name: string): string`
  - `readDbRegistry(worktreesDir: string): Record<string, string>`
  - `writeDbRegistry(worktreesDir: string, registry: Record<string, string>): void`
  - `registerDb(worktreesDir: string, name: string): string`
  - `parseDatabaseUrl(url: string): { user: string; password: string; host: string; port: string; db: string }`

- [ ] **Step 1: Escribir test fallido**

  ```typescript
  // scripts/worktree/__tests__/db.test.ts
  import assert from 'node:assert';
  import test from 'node:test';
  import { deriveDbName, parseDatabaseUrl } from '../db.ts';

  test('deriveDbName prefixes and sanitizes', () => {
    assert.strictEqual(deriveDbName('feature-x'), 'langopia_feature_x');
    assert.strictEqual(deriveDbName('my.feature'), 'langopia_my_feature');
  });

  test('parseDatabaseUrl parses postgres url', () => {
    const parsed = parseDatabaseUrl('postgres://langopia:secret@localhost:5432/langopia');
    assert.deepStrictEqual(parsed, {
      user: 'langopia',
      password: 'secret',
      host: 'localhost',
      port: '5432',
      db: 'langopia',
    });
  });
  ```

- [ ] **Step 2: Correr test y verificar que falla**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/db.test.ts
  ```
  Expected: FAIL.

- [ ] **Step 3: Implementar módulo de DB**

  ```typescript
  // scripts/worktree/db.ts
  import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
  import { join } from 'path';

  export function deriveDbName(name: string): string {
    return 'langopia_' + name.replace(/-/g, '_').replace(/[^a-z0-9_]/gi, '_');
  }

  export function readDbRegistry(worktreesDir: string): Record<string, string> {
    const file = join(worktreesDir, '.databases.json');
    if (!existsSync(file)) return {};
    try {
      return JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      return {};
    }
  }

  export function writeDbRegistry(worktreesDir: string, registry: Record<string, string>): void {
    mkdirSync(worktreesDir, { recursive: true });
    writeFileSync(join(worktreesDir, '.databases.json'), JSON.stringify(registry, null, 2) + '\n');
  }

  export function registerDb(worktreesDir: string, name: string): string {
    const registry = readDbRegistry(worktreesDir);
    const dbName = deriveDbName(name);
    registry[name] = dbName;
    writeDbRegistry(worktreesDir, registry);
    return dbName;
  }

  export function parseDatabaseUrl(url: string): { user: string; password: string; host: string; port: string; db: string } {
    const match = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (!match) throw new Error(`Invalid DATABASE_URL: ${url}`);
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      db: match[5],
    };
  }
  ```

- [ ] **Step 4: Correr test y verificar que pasa**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/db.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/worktree/db.ts scripts/worktree/__tests__/db.test.ts
  git commit -m "feat(worktree): añade helpers para registro y parsing de DB"
  ```

---

## Task 6: Módulo de reescritura de `.env`

**Files:**
- Create: `scripts/worktree/env.ts`
- Create: `scripts/worktree/__tests__/env.test.ts`

**Interfaces:**
- Produces:
  - `rewriteEnvLine(content: string, key: string, value: string): string`
  - `buildWorktreeEnv(rootEnv: string, worktreeName: string, dbName: string, ports: { web: number; api: number; sites: number }): string`

- [ ] **Step 1: Escribir test fallido**

  ```typescript
  // scripts/worktree/__tests__/env.test.ts
  import assert from 'node:assert';
  import test from 'node:test';
  import { rewriteEnvLine } from '../env.ts';

  test('rewriteEnvLine replaces existing key', () => {
    const result = rewriteEnvLine('API_URL=http://localhost:3000\n', 'API_URL', 'http://localhost:3001');
    assert.strictEqual(result, 'API_URL=http://localhost:3001\n');
  });

  test('rewriteEnvLine appends missing key', () => {
    const result = rewriteEnvLine('FOO=bar\n', 'BAZ', 'qux');
    assert.strictEqual(result, 'FOO=bar\nBAZ=qux\n');
  });
  ```

- [ ] **Step 2: Correr test y verificar que falla**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/env.test.ts
  ```
  Expected: FAIL.

- [ ] **Step 3: Implementar módulo de env**

  ```typescript
  // scripts/worktree/env.ts
  export function rewriteEnvLine(content: string, key: string, value: string): string {
    const re = new RegExp(`^${key}=.*$`, 'gm');
    if (re.test(content)) {
      return content.replace(re, `${key}=${value}`);
    }
    const sep = content.endsWith('\n') ? '' : '\n';
    return content + sep + `${key}=${value}\n`;
  }

  export function buildWorktreeEnv(
    rootEnv: string,
    worktreeName: string,
    dbName: string,
    ports: { web: number; api: number; sites: number },
  ): string {
    // Parse root DATABASE_URL to build isolated URL
    const dbMatch = rootEnv.match(/^DATABASE_URL=(.+)$/m);
    if (!dbMatch) throw new Error('DATABASE_URL not found in root .env');
    const parsed = dbMatch[1].match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (!parsed) throw new Error('Invalid DATABASE_URL in root .env');
    const [, user, password, host, port] = parsed;
    const isolatedUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;
    const appUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}_app`;

    let env = rootEnv;
    env = rewriteEnvLine(env, 'DATABASE_URL', isolatedUrl);
    env = rewriteEnvLine(env, 'DATABASE_URL_APP', appUrl);
    env = rewriteEnvLine(env, 'BETTER_AUTH_URL', `http://localhost:${ports.api}/api/v1/auth`);
    env = rewriteEnvLine(env, 'BETTER_AUTH_TRUSTED_ORIGINS', `http://localhost:${ports.web}`);
    env = rewriteEnvLine(env, 'API_URL', `http://localhost:${ports.api}`);
    return env;
  }
  ```

- [ ] **Step 4: Correr test y verificar que pasa**

  Run:
  ```bash
  npx tsx --test scripts/worktree/__tests__/env.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/worktree/env.ts scripts/worktree/__tests__/env.test.ts
  git commit -m "feat(worktree): añade reescritura de variables de entorno"
  ```

---

## Task 7: Comando `wt:list`

**Files:**
- Create: `scripts/worktree/cmd/list.ts`
- Modify: `scripts/worktree.ts` (entry point, al final de todas las tasks)

**Interfaces:**
- Produces: `list(root: string): void`
- Consumes: `getActiveWorktreeNames`, `readPortRegistry`, `readDbRegistry`, `getPorts`

- [ ] **Step 1: Implementar `list.ts`**

  ```typescript
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
      const ports = name === 'main' ? { web: 5173, api: 3000, sites: 4321 } : getPorts(name, offset);
      const db = dbReg[name] ?? 'shared';
      return { name, branch: name, ports, db };
    });

    const maxName = Math.max(...rows.map((r) => r.name.length), 4);
    console.log('');
    console.log(`  ${'NAME'.padEnd(maxName + 2)}BRANCH  WEB    API    SITES  DB`);
    console.log('  ' + '─'.repeat(maxName + 38));
    for (const row of rows) {
      console.log(
        `  ${row.name.padEnd(maxName + 2)}${row.branch.padEnd(7)}` +
          `${String(row.ports.web).padEnd(7)}${String(row.ports.api).padEnd(7)}${String(row.ports.sites).padEnd(7)}${row.db}`,
      );
    }
    console.log('');
  }
  ```

- [ ] **Step 2: Verificar ejecutando `tsx --test` vacío**

  Run:
  ```bash
  npx tsx scripts/worktree/cmd/list.ts
  ```
  Expected: TypeScript compila sin errores (aunque no haga nada al importar).

- [ ] **Step 3: Commit**

  ```bash
  git add scripts/worktree/cmd/list.ts
  git commit -m "feat(worktree): añade comando list"
  ```

---

## Task 8: Comando `wt:add`

**Files:**
- Create: `scripts/worktree/cmd/add.ts`
- Modify: `scripts/worktree/db.ts` (añadir funciones de Postgres)

**Interfaces:**
- Produces: `add(root: string, args: string[]): void`
- Consumes: `parseArgs`, `branchExists`, `runGit`, `assignOffset`, `getPorts`, `registerDb`, `buildWorktreeEnv`, `parseDatabaseUrl`

- [ ] **Step 1: Añadir funciones de Postgres a `db.ts`**

  Añadir al final de `scripts/worktree/db.ts`:

  ```typescript
  import { spawnSync } from 'child_process';

  export function databaseExists(dbName: string, env: { user: string; password: string; host: string; port: string }): boolean {
    const r = spawnSync(
      'psql',
      ['-U', env.user, '-h', env.host, '-p', env.port, '-d', 'postgres', '-t', '-c', `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
      { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: env.password } },
    );
    return r.status === 0 && r.stdout.trim().includes('1');
  }

  export function createDatabase(dbName: string, env: { user: string; password: string; host: string; port: string }): { ok: boolean; error?: string } {
    const r = spawnSync(
      'psql',
      ['-U', env.user, '-h', env.host, '-p', env.port, '-d', 'postgres', '-c', `CREATE DATABASE "${dbName}"`],
      { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: env.password } },
    );
    if (r.status !== 0) {
      const msg = (r.stderr || '').trim();
      if (msg.includes('already exists')) return { ok: true };
      return { ok: false, error: msg };
    }
    return { ok: true };
  }
  ```

- [ ] **Step 2: Implementar `add.ts`**

  ```typescript
  // scripts/worktree/cmd/add.ts
  import { execSync, spawnSync } from 'child_process';
  import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
  import { join } from 'path';
  import { parseArgs } from '../args.ts';
  import { createDatabase, databaseExists, deriveDbName, parseDatabaseUrl, readDbRegistry, registerDb, writeDbRegistry } from '../db.ts';
  import { buildWorktreeEnv } from '../env.ts';
  import { branchExists, runGit } from '../git.ts';
  import { assignOffset, getPorts } from '../ports.ts';

  export function add(root: string, args: string[]): void {
    const { flags, positional } = parseArgs(args);
    const name = positional[0];

    if (!name) {
      console.error('Usage: wt:add <name> [--from <branch>] [--no-db] [--seed]');
      process.exit(1);
    }

    if (/[^a-zA-Z0-9._-]/.test(name)) {
      console.error(`Invalid worktree name: "${name}". Use only letters, numbers, dots, hyphens, underscores.`);
      process.exit(1);
    }

    const baseBranch = (flags.from as string) || 'main';
    if (!branchExists(baseBranch)) {
      console.error(`Branch "${baseBranch}" does not exist.`);
      process.exit(1);
    }

    const worktreesDir = join(root, '.worktrees');
    const worktreePath = join(worktreesDir, name);

    if (existsSync(worktreePath)) {
      console.error(`Worktree already exists: ${worktreePath}`);
      process.exit(1);
    }

    mkdirSync(worktreesDir, { recursive: true });

    console.log(`Creating worktree .worktrees/${name} (branch: ${name}, from: ${baseBranch})`);
    try {
      runGit(['worktree', 'add', worktreePath, '-b', name, baseBranch], { stdio: 'inherit' });
    } catch {
      try {
        runGit(['worktree', 'add', worktreePath, name], { stdio: 'inherit' });
      } catch {
        console.error(`Failed to create worktree. Branch "${name}" may be checked out elsewhere.`);
        process.exit(1);
      }
    }

    // Copy root .env
    const rootEnvPath = join(root, '.env');
    const worktreeEnvPath = join(worktreePath, '.env');
    if (existsSync(rootEnvPath)) {
      copyFileSync(rootEnvPath, worktreeEnvPath);
    }

    // Assign port offset
    const offset = assignOffset(worktreesDir, name);
    const ports = getPorts(name, offset);

    // Register isolated DB
    let dbName: string | null = null;
    if (!flags['no-db']) {
      dbName = registerDb(worktreesDir, name);
    }

    // Rewrite env
    if (existsSync(worktreeEnvPath) && dbName) {
      const rootEnv = readFileSync(rootEnvPath, 'utf-8');
      const nextEnv = buildWorktreeEnv(rootEnv, name, dbName, ports);
      writeFileSync(worktreeEnvPath, nextEnv);
    }

    // Install dependencies
    console.log('Installing dependencies...');
    try {
      execSync('npm install', { cwd: worktreePath, stdio: 'inherit' });
    } catch {
      console.error('npm install failed. Run manually inside the worktree.');
    }

    // DB setup
    let dbReady = false;
    if (dbName && existsSync(rootEnvPath)) {
      const rootEnv = readFileSync(rootEnvPath, 'utf-8');
      const dbUrlMatch = rootEnv.match(/^DATABASE_URL=(.+)$/m);
      if (dbUrlMatch) {
        const parsed = parseDatabaseUrl(dbUrlMatch[1]);
        const env = { user: parsed.user, password: parsed.password, host: parsed.host, port: parsed.port };
        console.log(`Setting up database: ${dbName}`);
        const created = createDatabase(dbName, env);
        if (created.ok) {
          dbReady = true;
          console.log(`  Database "${dbName}" ready`);
          try {
            execSync('npm run db:migrate', { cwd: worktreePath, stdio: 'inherit' });
          } catch {
            console.error('  Migrations failed. Run manually: wt:db ' + name + ' migrate');
          }
        } else {
          console.error(`  Could not create database: ${created.error}`);
        }
      }
    }

    // Open VSCode
    const vsResult = spawnSync('code', [worktreePath], { stdio: 'ignore' });
    if (vsResult.status === 0) console.log('VSCode window opened.');
    else console.log(`Open manually: code ${worktreePath}`);

    // Summary
    console.log('');
    console.log(`Worktree ready: .worktrees/${name}`);
    console.log(`  Branch: ${name}`);
    console.log(`  Ports:  web=${ports.web} api=${ports.api} sites=${ports.sites} (offset: +${offset})`);
    console.log(`  DB:     ${dbName ? dbName + (dbReady ? ' ✓' : ' (pending)') : 'shared'}`);
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add scripts/worktree/cmd/add.ts scripts/worktree/db.ts
  git commit -m "feat(worktree): añade comando add con puertos, DB y env"
  ```

---

## Task 9: Comando `wt:remove`

**Files:**
- Create: `scripts/worktree/cmd/remove.ts`

**Interfaces:**
- Produces: `remove(root: string, args: string[]): void`

- [ ] **Step 1: Implementar `remove.ts`**

  ```typescript
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
  ```

  Nota: añadir `dropDatabase` a `db.ts` si no existe:

  ```typescript
  export function dropDatabase(dbName: string, env: { user: string; password: string; host: string; port: string }): boolean {
    spawnSync(
      'psql',
      ['-U', env.user, '-h', env.host, '-p', env.port, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS "${dbName}"`],
      { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: env.password } },
    );
    return true;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add scripts/worktree/cmd/remove.ts scripts/worktree/db.ts
  git commit -m "feat(worktree): añade comando remove"
  ```

---

## Task 10: Comandos `wt:open` y `wt:dev`

**Files:**
- Create: `scripts/worktree/cmd/open.ts`
- Create: `scripts/worktree/cmd/dev.ts`

**Interfaces:**
- Produces: `open(root: string, args: string[]): void`, `dev(root: string, args: string[]): void`

- [ ] **Step 1: Implementar `open.ts`**

  ```typescript
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
  ```

- [ ] **Step 2: Implementar `dev.ts`**

  ```typescript
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
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add scripts/worktree/cmd/open.ts scripts/worktree/cmd/dev.ts
  git commit -m "feat(worktree): añade comandos open y dev"
  ```

---

## Task 11: Comando `wt:db`

**Files:**
- Create: `scripts/worktree/cmd/db.ts`

**Interfaces:**
- Produces: `db(root: string, args: string[]): void`

- [ ] **Step 1: Implementar `db.ts`**

  ```typescript
  // scripts/worktree/cmd/db.ts
  import { execSync } from 'child_process';
  import { existsSync, readFileSync } from 'fs';
  import { join } from 'path';
  import { parseArgs } from '../args.ts';
  import { createDatabase, databaseExists, deriveDbName, parseDatabaseUrl, readDbRegistry, registerDb } from '../db.ts';

  export function db(root: string, args: string[]): void {
    const { flags, positional } = parseArgs(args);
    const name = positional[0];
    const subcommand = positional[1];

    if (!name) {
      console.error('Usage: wt:db <name> [init|push|migrate|generate|seed|studio|status|drop|clone]');
      process.exit(1);
    }

    const worktreePath = join(root, '.worktrees', name);
    if (!existsSync(worktreePath)) {
      console.error(`Worktree not found: ${worktreePath}`);
      process.exit(1);
    }

    const worktreesDir = join(root, '.worktrees');
    const registeredDb = readDbRegistry(worktreesDir)[name];

    if (!subcommand || subcommand === 'status') {
      console.log(`Worktree: ${name}`);
      console.log(`Database: ${registeredDb || 'shared (no isolation)'}`);
      if (registeredDb) {
        // Try to check existence
        const envPath = join(root, '.env');
        if (existsSync(envPath)) {
          const content = readFileSync(envPath, 'utf-8');
          const match = content.match(/^DATABASE_URL=(.+)$/m);
          if (match) {
            const parsed = parseDatabaseUrl(match[1]);
            const exists = databaseExists(registeredDb, {
              user: parsed.user,
              password: parsed.password,
              host: parsed.host,
              port: parsed.port,
            });
            console.log(`Status:   ${exists ? '✓ accessible' : '✗ not found'}`);
          }
        }
      }
      return;
    }

    if (subcommand === 'init') {
      const dbName = registeredDb || deriveDbName(name);
      if (!registeredDb) registerDb(worktreesDir, name);
      const envPath = join(root, '.env');
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        const match = content.match(/^DATABASE_URL=(.+)$/m);
        if (match) {
          const parsed = parseDatabaseUrl(match[1]);
          const env = { user: parsed.user, password: parsed.password, host: parsed.host, port: parsed.port };
          if (!databaseExists(dbName, env)) {
            const created = createDatabase(dbName, env);
            if (!created.ok) {
              console.error(`Failed to create database: ${created.error}`);
              process.exit(1);
            }
          }
          execSync('npm run db:migrate', { cwd: worktreePath, stdio: 'inherit' });
          console.log(`Database "${dbName}" ready.`);
        }
      }
      return;
    }

    const npmMap: Record<string, string> = {
      push: 'db:push',
      migrate: 'db:migrate',
      generate: 'db:generate',
      seed: 'db:seed',
      studio: 'db:studio',
    };

    if (npmMap[subcommand]) {
      if (!registeredDb) {
        console.error(`No isolated DB for "${name}". Run: wt:db ${name} init`);
        process.exit(1);
      }
      execSync(`npm run ${npmMap[subcommand]}`, { cwd: worktreePath, stdio: 'inherit' });
      return;
    }

    console.error(`Unknown subcommand: ${subcommand}`);
    process.exit(1);
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add scripts/worktree/cmd/db.ts
  git commit -m "feat(worktree): añade comando db"
  ```

---

## Task 12: Comando `wt:clean`

**Files:**
- Create: `scripts/worktree/cmd/clean.ts`

**Interfaces:**
- Produces: `clean(root: string, args: string[]): void`

- [ ] **Step 1: Implementar `clean.ts`**

  ```typescript
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
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add scripts/worktree/cmd/clean.ts
  git commit -m "feat(worktree): añade comando clean"
  ```

---

## Task 13: Entry point `scripts/worktree.ts`

**Files:**
- Create: `scripts/worktree.ts`

**Interfaces:**
- Consumes: todos los comandos anteriores
- Produces: entry point ejecutable

- [ ] **Step 1: Implementar entry point**

  ```typescript
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
  ```

- [ ] **Step 2: Verificar que los scripts npm funcionan**

  Run:
  ```bash
  npm run wt:list
  ```
  Expected: Muestra "No worktrees found." o lista vacía.

  Run:
  ```bash
  npm run wt:add -- --help
  ```
  Expected: Muestra usage de add.

- [ ] **Step 3: Commit**

  ```bash
  git add scripts/worktree.ts
  git commit -m "feat(worktree): añade entry point scripts/worktree.ts"
  ```

---

## Task 14: Verificación manual end-to-end

**Files:**
- No crea archivos.

- [ ] **Step 1: Crear un worktree de prueba**

  Run:
  ```bash
  npm run wt:add test-feature -- --no-db
  ```
  Expected: Crea `.worktrees/test-feature`, instala deps, abre VSCode.

- [ ] **Step 2: Listar worktrees**

  Run:
  ```bash
  npm run wt:list
  ```
  Expected: Muestra `test-feature` con offset +1 y puertos 5174/3001/4322.

- [ ] **Step 3: Abrir worktree**

  Run:
  ```bash
  npm run wt:open test-feature
  ```
  Expected: Abre VSCode (o muestra comando manual si no está disponible).

- [ ] **Step 4: Eliminar worktree de prueba**

  Run:
  ```bash
  npm run wt:remove test-feature -- --branch
  ```
  Expected: Elimina `.worktrees/test-feature`, limpia registries, borra branch.

- [ ] **Step 5: Limpiar worktrees huérfanos si queda alguno**

  Run:
  ```bash
  npm run wt:clean -- --all
  ```
  Expected: Elimina directorios huérfanos.

- [ ] **Step 6: Commit de ajustes menores si los hay**

  Si se hicieron cambios tras las pruebas:
  ```bash
  git add -A
  git commit -m "fix(worktree): ajustes tras verificación manual"
  ```

---

## Self-Review

**1. Spec coverage:**
- `.worktrees/` en `.gitignore`: Task 1.
- Scripts `wt:*` en root: Task 1.
- TypeScript + `tsx`: Tasks 1 y 13.
- Comandos `add`, `remove`, `list`, `open`, `dev`, `db`, `clean`: Tasks 7-13.
- Puertos con step 1: Task 4.
- DB aislada: Tasks 5, 8, 11.
- Reescritura de `.env`: Task 6.
- Tests unitarios: Tasks 2, 4, 5, 6.
- Verificación manual: Task 14.

**2. Placeholder scan:**
- No se detectan TODOS, placeholders ni referencias a funciones no definidas en el plan. La funcionalidad de clonar DB desde otro worktree (`--clone-from`) se omite del MVP y no aparece en ningún step.

**3. Type consistency:**
- `parseDatabaseUrl` devuelve `{ user, password, host, port, db }` en Task 5.
- `databaseExists`, `createDatabase`, `dropDatabase` reciben `{ user, password, host, port }` consistentemente.
- `getPorts` devuelve `{ web, api, sites }` en Task 4 y se usa así en Task 6.

No se detectan inconsistencias de tipos.
