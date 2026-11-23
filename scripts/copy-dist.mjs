import assert from 'node:assert/strict';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('docs', { recursive: true, force: true });
cpSync('dist', 'docs', { recursive: true });
writeFileSync('docs/.nojekyll', '');
assert.match(readFileSync('docs/index.html', 'utf8'), /src="\.\/assets\//);
