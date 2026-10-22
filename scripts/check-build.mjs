import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes:true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]))).flat();
}
for (const file of [...await files('dist'), ...await files('netlify')]) {
  if (file.endsWith('.mjs')) {
    const checked = spawnSync(process.execPath, ['--check',file], { encoding:'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
  }
}
const html = await readFile('dist/index.html','utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const path = match[1]; if (path.startsWith('http') || path === './') continue;
  assert.ok((await stat(join('dist',path))).isFile(), `Missing asset ${path}`);
}
const publicFiles = await files('dist');
assert.ok(!publicFiles.some(p => /(?:\.env|node_modules|netlify\/|package-lock)/.test(p)), 'Server/config secrets must not be published');
for (const path of ['api-calculate','api-config','api-health','api-not-found','api-rate-limited','api-scenarios-create','api-scenarios-read']) {
  const fn = await import(`../netlify/functions/${path}.mjs`);
  assert.equal(typeof fn.default, 'function'); assert.ok(fn.config.path);
  assert.ok(!Object.hasOwn(fn, 'handler'), 'A named handler export makes Netlify infer the legacy API and omit v2 routes');
}
console.log('Static assets, syntax, function entry points and public directory checks passed.');
