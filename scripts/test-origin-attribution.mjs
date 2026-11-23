import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('origin-shield.js');
const css = read('origin-shield.css');
const html = read('index.html');
const manifest = JSON.parse(read('origin-manifest.json'));
const record = read('ORIGIN-DESIGN-RECORD.md');
const failures = [];
const ok = (condition, message) => {
  if (condition) console.log('PASS', message);
  else failures.push(message);
};

try {
  new vm.Script(source, { filename: 'origin-shield.js' });
  ok(true, 'origin marker JavaScript syntax is valid');
} catch (error) {
  failures.push('origin marker JavaScript syntax: ' + error.message);
}

ok(manifest.format === 'anouar-origin-manifest/v1', 'origin manifest format is recognized');
ok(manifest.declaredCreator === 'Anouar Oumlili (أنوار أومليلي)', 'creator attribution is explicit');
ok(manifest.documentedConceptOriginDate === '2026-11-17', 'documented concept reference date is explicit');
ok(manifest.documentedConceptOriginDateBasis.includes('not independent proof'), 'date is clearly distinguished from independent proof');
ok(Array.isArray(manifest.coreSpaces) && manifest.coreSpaces.length === 5, 'manifest records exactly five core notebook spaces');

const requiredTerms = [
  'الكتابة الأدبية',
  'المكتبة',
  'إذاعة القرآن الكريم',
  'الدروس الصوتية',
  'السبحة',
  'إنشاء الكتب',
  'النسخ الاحتياطي',
  'QR'
];
for (const term of requiredTerms) {
  ok(
    manifest.inventionDescription.includes(term) ||
    manifest.supportingTools?.some((item) => item.includes(term)) ||
    manifest.coreSpaces?.some((item) => item.label.includes(term)),
    'manifest includes: ' + term
  );
  ok(record.includes(term), 'design record includes: ' + term);
}

ok(source.includes('إذاعة القرآن الكريم والدروس الصوتية'), 'visible attribution expressly identifies Quran radio and audio lessons');
ok(source.includes('17 نوفمبر 2026'), 'visible attribution carries the documented project-record date');
ok(source.includes('ANOUAR-MOFKIRA-ORIGIN-2026-01'), 'stable origin marker ID is retained');
ok(css.includes('.anouar-origin-notice'), 'origin notice has a matching stylesheet');
ok(html.includes('./origin-shield.js?v=20261123-2'), 'HTML loads the updated origin marker version');
ok(html.includes('./origin-shield.css?v=20261123-2'), 'HTML loads the updated origin notice stylesheet version');
ok(html.includes('./origin-manifest.json?v=20261123-2'), 'HTML exposes the updated origin manifest');
ok(html.includes('إذاعة القرآن الكريم') && html.includes('الدروس الصوتية'), 'page metadata describes the radio and lessons');

const forbidden = [
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bsendBeacon\s*\(/i,
  /\bWebSocket\b/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\bindexedDB\b/i
];
ok(forbidden.every((pattern) => !pattern.test(source)), 'origin marker does not call network APIs or access browser storage');
ok(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), 'origin marker does not execute dynamically generated code');

function simulate(hostname, protocol, pathname) {
  const nodes = new Map();
  const body = { appendChild(node) { nodes.set(node.id, node); } };
  const document = {
    body,
    readyState: 'complete',
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tag) {
      return {
        tag,
        children: [],
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener() {},
        append(...items) { this.children.push(...items); },
        remove() { nodes.delete(this.id); }
      };
    },
    addEventListener() {}
  };
  const window = { location: { hostname, protocol, pathname } };
  vm.runInNewContext(source, { window, document }, { filename: 'origin-shield.js' });
  return { status: window.__ANOUAR_ORIGIN__?.status, notice: nodes.get('anouar-origin-notice') };
}

const official = simulate('byan80543-tech.github.io', 'https:', '/mofakira-anouar/');
const local = simulate('localhost', 'http:', '/');
const copied = simulate('copied-example.test', 'https:', '/');
const wrongPath = simulate('byan80543-tech.github.io', 'https:', '/another-app/');
ok(official.status === 'official' && !official.notice, 'official GitHub Pages deployment does not show a copied-source notice');
ok(local.status === 'development' && !local.notice, 'local development does not show a copied-source notice');
ok(copied.status === 'unverified' && !!copied.notice, 'unverified copied hostname displays an attribution notice');
ok(wrongPath.status === 'unverified' && !!wrongPath.notice, 'an unrelated path on the official host is not treated as the app');

if (failures.length) {
  console.error('\nFAIL', failures.length, 'origin attribution check(s):');
  for (const failure of failures) console.error(' -', failure);
  process.exitCode = 1;
} else {
  console.log('\nAll origin attribution checks passed.');
}
