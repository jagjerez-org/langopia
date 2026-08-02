import assert from 'node:assert';
import test from 'node:test';
import { getPorts, assignOffset } from '../ports.ts';

test('getPorts returns base + offset', () => {
  const ports = getPorts('feature', 3);
  assert.strictEqual(ports.web, 5176);
  assert.strictEqual(ports.api, 3003);
  assert.strictEqual(ports.sites, 4324);
});
