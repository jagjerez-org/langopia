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
