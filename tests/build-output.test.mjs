import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

test('production build resolves assets relative to a GitHub Pages subpath', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const scriptSrc = html.match(/<script[^>]+src="([^"]+)"/)[1];
  const cssHref = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)[1];
  const pageUrl = 'https://user.github.io/my-repo/';
  for (const ref of [scriptSrc, cssHref]) {
    const url = new URL(ref, pageUrl);
    assert.equal(url.origin, 'https://user.github.io');
    assert.ok(url.pathname.startsWith('/my-repo/assets/'), ref);
  }

  const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'));
  const bundle = assets.map((name) => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n');
  assert.match(bundle, /[`'"]\.\/[`'"]/, 'the relative base literal is present');
  assert.match(bundle, /sprites\//, 'the sprite path segment is present');
  assert.ok(!/[`'"]\/sprites\//.test(bundle), 'no absolute sprite URL in the bundle');

  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  for (const path of walk('dist').filter((name) => /\.(html|js|css)$/.test(name))) {
    const text = readFileSync(path, 'utf8');
    assert.ok(!/[`'"]\/(?:assets|sprites)\//.test(text), `absolute asset URL in ${path}`);
  }
});
