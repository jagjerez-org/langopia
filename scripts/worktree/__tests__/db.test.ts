import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';
import {
  deriveDbName,
  parseDatabaseUrl,
  readDbRegistry,
  registerDb,
  writeDbRegistry,
} from '../db.ts';

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

test('parseDatabaseUrl parses postgresql url', () => {
  const parsed = parseDatabaseUrl('postgresql://langopia:secret@localhost:5432/langopia');
  assert.deepStrictEqual(parsed, {
    user: 'langopia',
    password: 'secret',
    host: 'localhost',
    port: '5432',
    db: 'langopia',
  });
});

test('registry read/write roundtrip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'worktree-db-'));
  try {
    assert.deepStrictEqual(readDbRegistry(dir), {});
    writeDbRegistry(dir, { 'feature-x': 'langopia_feature_x' });
    assert.deepStrictEqual(readDbRegistry(dir), { 'feature-x': 'langopia_feature_x' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('registerDb derives name and persists registry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'worktree-db-'));
  try {
    const dbName = registerDb(dir, 'feature-x');
    assert.strictEqual(dbName, 'langopia_feature_x');
    assert.deepStrictEqual(readDbRegistry(dir), { 'feature-x': 'langopia_feature_x' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
