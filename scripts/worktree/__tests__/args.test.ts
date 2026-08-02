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
