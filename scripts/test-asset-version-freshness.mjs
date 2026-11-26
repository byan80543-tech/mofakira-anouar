import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function lastModifiedDate(relativePath) {
  const date = execFileSync(
    'git',
    ['log', '-1', '--format=%cs', '--', relativePath],
    { cwd: root, encoding: 'utf8' }
  ).trim();
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `Git history is required to inspect ${relativePath}`);
  return date;
}


function lastModifiedTimestamp(relativePath) {
  const timestamp = execFileSync(
    'git',
    ['log', '-1', '--format=%ct', '--', relativePath],
    { cwd: root, encoding: 'utf8' }
  ).trim();
  assert.match(timestamp, /^\d+$/, 'Git history is required to timestamp ' + relativePath);
  return Number(timestamp);
}

function dateFromVersion(value) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  assert.ok(match, `Version key must begin with YYYYMMDD: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

const staleReferences = [];
let checkedReferences = 0;

for (const sourcePath of [
  'index.html', 'app-core.js', 'manifest.webmanifest', 'service-worker.js',
  'ibtihalat-radio.js', 'prayer-times.js', 'poetry-dictation.js', 'protective-adhkar.js',
  'tasbih-controller.js', 'tasbih-vault.js', 'official-adhkar.js', 'vault-crypto.js', 'vault-storage.js',
  'vault-device-unlock.js', 'toolbar-back-navigation.js', 'api-gateway-config.js',
  'click-guard.js', 'floating-panels.js', 'floating-panels.css',
  'update-notice-v2.js', 'update-notice-v2.css'
]) {
  const source = readRepoFile(sourcePath);
  const pattern = /["'`]([^"'`]*\?v=(\d{8})[^"'`]*)["'`]/g;

  for (const match of source.matchAll(pattern)) {
    const reference = match[1];
    const rawPath = reference.split(/[?#]/, 1)[0];

    // External URLs are controlled by their respective providers, not this repository.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(rawPath)) continue;

    const relativePath = path.normalize(rawPath.replace(/^\.\//, ''));
    if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) continue;

    const absolutePath = path.resolve(root, relativePath);
    assert.ok(
      absolutePath === root || absolutePath.startsWith(root + path.sep),
      `Asset path escapes the repository: ${reference}`
    );
    assert.ok(fs.existsSync(absolutePath), `Versioned local asset does not exist: ${reference}`);

    const taggedDate = dateFromVersion(match[2]);
    const modifiedDate = lastModifiedDate(relativePath);
    checkedReferences++;

    if (taggedDate < modifiedDate) {
      staleReferences.push(`${sourcePath}: ${reference} (file changed ${modifiedDate})`);
    }
  }
}

assert.ok(checkedReferences > 0, 'No versioned local asset references were inspected');

const worker = readRepoFile('service-worker.js');
const cacheName = /const CACHE_NAME\s*=\s*['"]anwar-shell-(\d{4}-\d{2}-\d{2})-v(\d+)['"]/.exec(worker);
assert.ok(cacheName, 'Service worker cache name must contain a dated release and version number');
const cacheDate = cacheName[1];
const shellBlock = /const SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/.exec(worker);
assert.ok(shellBlock, 'Service worker shell asset list must be present');

const staleShellAssets = [];
const workerTimestamp = lastModifiedTimestamp('service-worker.js');
const assetPattern = /['"](\.\/[^'"]+)['"]/g;
for (const match of shellBlock[1].matchAll(assetPattern)) {
  const relativePath = path.normalize(match[1].replace(/^\.\//, ''));
  const modifiedDate = lastModifiedDate(relativePath);
  const modifiedTimestamp = lastModifiedTimestamp(relativePath);
  if (cacheDate < modifiedDate) {
    staleShellAssets.push(relativePath + ' (changed ' + modifiedDate + '; shell ' + cacheDate + ')');
  }
  if (workerTimestamp < modifiedTimestamp) {
    staleShellAssets.push(relativePath + ' (updated after service-worker.js; rebuild the app-shell cache)');
  }
}

assert.deepEqual(
  staleReferences,
  [],
  `Stale cache-busting references found:\n${staleReferences.join('\n')}`
);
assert.deepEqual(
  staleShellAssets,
  [],
  `Service-worker shell date predates cached assets:\n${staleShellAssets.join('\n')}`
);

console.log(
  `Asset version freshness passed: ${checkedReferences} local versioned references checked; ${shellBlock[1].match(assetPattern)?.length ?? 0} service-worker shell assets checked; cache ${cacheName[0]}.`
);
