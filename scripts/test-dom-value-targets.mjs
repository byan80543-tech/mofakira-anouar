import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');

const htmlIds=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1]));
const valueTargets=[...core.matchAll(/\$\(\s*(['"])([^'"]+)\1\s*\)\s*\.value\s*=/g)].map(match=>match[2]);
const missing=[...new Set(valueTargets.filter(id=>!htmlIds.has(id)))];
assert.deepEqual(missing,[],'every direct jQuery-style value assignment must target an existing HTML element');

assert.ok(!htmlIds.has('bt'),'the removed legacy backup textarea must stay out of the rescue UI');
assert.doesNotMatch(core,/\$\(\s*['"]bt['"]\s*\)\s*\.value\s*=/,'vault lock must not access the removed legacy backup textarea');

const lockStart=core.indexOf('async function lockVault(');
const lockEnd=core.indexOf('function isRescueReminderEnabled(',lockStart);
assert.ok(lockStart>=0&&lockEnd>lockStart,'the vault lock implementation is present');
const lockSource=core.slice(lockStart,lockEnd);
assert.ok(lockSource.includes("console.warn('تعذّر قفل مفكرة أنوار',error);"),'technical lock details remain available in the developer console');
assert.ok(lockSource.includes("toast('تعذّر قفل المفكرة. بقيت بياناتك محفوظة؛ أعد المحاولة.',6000);"),'the user sees an Arabic lock error');
assert.doesNotMatch(lockSource,/toast\(\s*error(?:\.message|&&error\.message)/,'raw JavaScript exception text is never shown in the vault lock toast');

console.log('DOM value-target integrity and Arabic vault-lock notification checks passed.');
