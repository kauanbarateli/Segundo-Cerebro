import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);

test('adaptador de lint usa o motor oficial corrigido e mantém exports CJS e ESM', async () => {
  const callable = require('minimatch');
  const upstream = require('minimatch-actual');
  const esm = await import('minimatch');
  assert.equal(typeof callable, 'function');
  assert.equal(callable('src/test.ts', '**/*.ts'), true);
  assert.equal(callable('src/test.css', '**/*.ts'), false);
  assert.equal(callable.minimatch, callable);
  assert.equal(callable.Minimatch, upstream.Minimatch);
  assert.equal(esm.default('src/test.ts', '**/*.ts'), true);
  assert.equal(new esm.Minimatch('**/*.ts').match('src/test.ts'), true);
  assert.equal((await lstat(new URL('node_modules/minimatch', root))).isSymbolicLink(), false);
  for (const file of ['package.json', 'index.cjs', 'index.mjs']) {
    assert.deepEqual(await readFile(new URL(`node_modules/minimatch/${file}`, root)), await readFile(new URL(`compat/${file}`, root)));
  }
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
  const pin = lock.packages['node_modules/minimatch-actual'];
  assert.equal(pin.name, 'minimatch');
  assert.equal(pin.version, '11.0.3');
  assert.equal(pin.resolved, 'https://registry.npmjs.org/minimatch/-/minimatch-11.0.3.tgz');
  assert.equal(pin.integrity, 'sha512-iny/40PEGkNJQ5/Pv6z3nm6FbRAby32GeZRjCUJk2WnNDbgPSTcdI+DDvLqsgBdD4cD5sMtMheqPPnehCCa8Nw==');
  const globRequire = createRequire(require.resolve('glob'));
  assert.equal(typeof globRequire('minimatch'), 'object');
  assert.equal(typeof globRequire('minimatch').minimatch, 'function');
});
