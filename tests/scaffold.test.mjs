import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('package.json pins runtime dependencies and exposes scripts', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.dependencies['animalese-tts'], '1.1.3');
  assert.ok(pkg.dependencies['@audio/encode']);
  assert.equal(pkg.scripts.test, 'node --test tests/*.test.mjs');
  assert.equal(pkg.scripts.build, 'vite build');
  assert.equal(pkg.scripts.dev, 'vite');
});

test('vendored sprites exist', () => {
  for (const name of [
    'japanese-sprite.wav', 'japanese-sprite.json',
    'english-letters-sprite.json',
  ]) assert.ok(existsSync(`public/sprites/${name}`), name);
});
