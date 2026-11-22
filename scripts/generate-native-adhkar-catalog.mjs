import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'official-adhkar.js');
const outputPath = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'official-adhkar.json');

const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, {
  filename: 'official-adhkar.js',
  timeout: 3000
});

const catalog = sandbox.window.ANWAR_OFFICIAL_ADHKAR;
if (!Array.isArray(catalog) || catalog.length < 35) {
  throw new Error('The official adhkar source did not produce the expected complete catalog.');
}

const periods = new Set(catalog.map((item) => item.period));
for (const period of ['tasbih', 'morning', 'evening', 'daily']) {
  if (!periods.has(period)) {
    throw new Error('Missing official adhkar category: ' + period);
  }
}

const normalized = catalog.map((item) => ({
  id: String(item.id),
  title: String(item.title),
  text: String(item.text),
  period: String(item.period),
  count: item.count == null ? null : Number(item.count),
  occasion: item.occasion == null ? '' : String(item.occasion),
  source: item.source == null ? '' : String(item.source)
}));

if (normalized.some((item) =>
  !item.id || !item.title.trim() || !item.text.trim() ||
  !['tasbih', 'morning', 'evening', 'daily'].includes(item.period) ||
  (item.count !== null && (!Number.isInteger(item.count) || item.count < 1))
)) {
  throw new Error('The official adhkar catalog contains an invalid item.');
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
console.log(
  'Generated native adhkar catalog: ' + normalized.length +
  ' entries (' + normalized.filter((item) => item.period === 'tasbih').length +
  ' tasbih-specific entries).'
);
