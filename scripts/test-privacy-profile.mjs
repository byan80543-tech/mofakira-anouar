import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile=JSON.parse(fs.readFileSync(new URL('../privacy-security.json',import.meta.url),'utf8'));
const html=fs.readFileSync(new URL('../privacy-security.html',import.meta.url),'utf8');
const roadmap=fs.readFileSync(new URL('../SECURITY-PRIVACY-PARITY-ROADMAP.md',import.meta.url),'utf8');

const vault=profile.local_data_protection.encrypted_vault;
assert.equal(vault.available,true,'the local encrypted vault is available');
assert.equal(vault.enabled_by_default,true,'private notebook use requires encrypted-vault setup');
assert.equal(vault.mandatory_before_private_use,true,'the private workspace cannot be used before encryption setup');
assert.equal(vault.cipher,'AES-256-GCM','the documented cipher matches the implementation');
assert.equal(vault.key_derivation,'PBKDF2-HMAC-SHA-256','the documented KDF matches the current implementation');
assert.equal(vault.iterations,600000,'the documented PBKDF2 work factor matches the current implementation');
assert.match(vault.kdf_migration_status,/Argon2id planned/i,'Argon2id is not falsely described as already implemented');

assert.match(html,/التشفير إلزامي قبل استخدام المساحة الخاصة/,'public profile describes mandatory first-use encryption');
assert.match(html,/1,050 محاولة إدخال تمثيلية/,'public profile contains the verified live field-matrix result');
assert.match(html,/26\/26 محاولة مشبوهة محظورة/,'public profile contains the verified real-shield result');
assert.match(html,/41\/41 فحصاً للمحيط/,'public profile contains the verified perimeter result');
assert.doesNotMatch(html,/خزنة محلية اختيارية للملاحظات|optional, user-enabled/i,'public profile must not retain the obsolete optional-vault claim');
assert.match(html,/لم يُجرَ تدقيق اختراق مستقل معتمد/,'public profile retains the independent-audit limitation');

assert.match(roadmap,/المرحلة 1 — ترقية اشتقاق المفاتيح إلى Argon2id/,'roadmap prioritizes the KDF migration');
assert.match(roadmap,/إبقاء فك تشفير الإصدار القديم متاحاً/,'roadmap requires backward-compatible vault migration');
assert.match(roadmap,/مزامنة اختيارية مشفرة طرفياً/,'cloud sync remains a separate optional phase');
assert.match(roadmap,/لا تُفعّل افتراضياً/,'roadmap preserves local-first defaults');

console.log('Privacy profile, vault implementation facts and parity roadmap are consistent.');
