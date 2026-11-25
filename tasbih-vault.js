/* Independent encrypted storage for Anwar Tasbih.
 * The notebook vault is intentionally not used here.
 * IndexedDB stores authenticated ciphertext only; the derived key stays in memory.
 */
(function installAnwarTasbihVault(root) {
  'use strict';

  const DB_NAME = 'anwar-tasbih-private-vault-v1';
  const DB_VERSION = 1;
  const STORE = 'records';
  const PRIMARY = 'primary';
  const BACKUP = 'backup';
  const MAX_BYTES = 256 * 1024;

  let databasePromise = null;
  let key = null;
  let template = null;
  let saveQueue = Promise.resolve();

  function cryptoApi() {
    const api = root.AnwarVaultCrypto;
    if (!api || typeof api.createVault !== 'function' ||
        typeof api.decryptEnvelope !== 'function' ||
        typeof api.encryptWithKey !== 'function') {
      throw new Error('محرك التشفير غير جاهز. حدّث المفكرة ثم أعد المحاولة.');
    }
    if (!root.crypto || !root.crypto.subtle || !root.indexedDB) {
      throw new Error('التخزين المشفّر غير متاح هنا. افتح المفكرة عبر HTTPS في متصفح حديث.');
    }
    return api;
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = root.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(new Error('تعذّر فتح خزنة السبحة المستقلة.'));
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('تعذّر فتح خزنة السبحة المستقلة.'));
      request.onblocked = () => reject(new Error('أغلق النسخة الأخرى من المفكرة ثم أعد المحاولة.'));
    }).catch(error => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  }

  async function readPair() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let primary = null;
      let backup = null;
      let tx;
      try {
        tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const p = store.get(PRIMARY);
        const b = store.get(BACKUP);
        p.onsuccess = () => { primary = typeof p.result === 'string' ? p.result : null; };
        b.onsuccess = () => { backup = typeof b.result === 'string' ? b.result : null; };
        tx.oncomplete = () => resolve({ primary, backup });
        tx.onerror = () => reject(new Error('تعذّرت قراءة سجلات خزنة السبحة.'));
        tx.onabort = () => reject(new Error('أُلغيت قراءة خزنة السبحة.'));
      } catch (error) {
        reject(new Error('تعذّرت قراءة سجلات خزنة السبحة.'));
      }
    });
  }

  async function writePair(primary, backup) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.put(primary, PRIMARY);
        store.put(backup, BACKUP);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(new Error('تعذّر حفظ سجلات السبحة المشفّرة.'));
        tx.onabort = () => reject(new Error('أُلغيت كتابة خزنة السبحة.'));
      } catch (error) {
        reject(new Error('تعذّر حفظ سجلات السبحة المشفّرة.'));
      }
    });
    const check = await readPair();
    if (check.primary !== primary || check.backup !== backup) {
      throw new Error('لم تتطابق مراجعة خزنة السبحة بعد الحفظ.');
    }
  }

  function serialize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('بيانات السبحة غير صالحة.');
    }
    const json = JSON.stringify(value);
    if (new TextEncoder().encode(json).byteLength > MAX_BYTES) {
      throw new Error('بيانات السبحة تجاوزت الحد الآمن للتخزين.');
    }
    return json;
  }

  function parse(json) {
    const value = JSON.parse(json);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('محتوى خزنة السبحة غير صالح.');
    }
    return value;
  }

  async function status() {
    const pair = await readPair();
    return {
      exists: !!(pair.primary || pair.backup),
      primaryAvailable: !!pair.primary,
      backupAvailable: !!pair.backup,
      unlocked: !!(key && template)
    };
  }

  async function create(password, value) {
    if (key) throw new Error('خزنة السبحة مفتوحة بالفعل.');
    const api = cryptoApi();
    const existing = await readPair();
    if (existing.primary || existing.backup) {
      throw new Error('توجد خزنة سابقة. افتحها أولاً ولا تنشئ خزنة فوق بياناتها.');
    }
    const plaintext = serialize(value);
    const created = await api.createVault(password, plaintext);
    const backup = await api.encryptWithKey(created.key, created.envelope, plaintext);
    const primaryText = JSON.stringify(created.envelope);
    const backupText = JSON.stringify(backup);
    await writePair(primaryText, backupText);
    const verifiedPrimary = await api.decryptWithKey(created.key, JSON.parse((await readPair()).primary));
    const verifiedBackup = await api.decryptWithKey(created.key, JSON.parse((await readPair()).backup));
    if (verifiedPrimary !== plaintext || verifiedBackup !== plaintext) {
      throw new Error('فشل التحقق من النسخة الأساسية أو الاحتياطية. لم نعرض أن الحماية اكتملت.');
    }
    key = created.key;
    template = created.envelope;
    return parse(plaintext);
  }

  async function unlock(password) {
    const api = cryptoApi();
    const pair = await readPair();
    const candidates = [
      { name: 'primary', value: pair.primary },
      { name: 'backup', value: pair.backup }
    ].filter(item => item.value);

    if (!candidates.length) throw new Error('لا توجد خزنة بعد. أنشئ حماية السبحة أولاً.');

    let lastError = null;
    for (const candidate of candidates) {
      try {
        const envelope = JSON.parse(candidate.value);
        const opened = await api.decryptEnvelope(password, envelope);
        const data = parse(opened.plaintext);
        key = opened.key;
        template = opened.envelope;
        return { data, recoveredFromBackup: candidate.name === 'backup' };
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(lastError && lastError.message
      ? lastError.message
      : 'تعذّر فتح خزنة السبحة. تحقق من عبارة المرور أو سلامة النسخة الاحتياطية.');
  }

  async function save(value) {
    const operation = saveQueue.then(async () => {
      if (!key || !template) throw new Error('خزنة السبحة مقفلة. افتح الدرع قبل الحفظ.');
      const api = cryptoApi();
      const plaintext = serialize(value);
      const primary = await api.encryptWithKey(key, template, plaintext);
      const backup = await api.encryptWithKey(key, template, plaintext);
      const primaryText = JSON.stringify(primary);
      const backupText = JSON.stringify(backup);
      await writePair(primaryText, backupText);
      const check = await readPair();
      const verifiedPrimary = await api.decryptWithKey(key, JSON.parse(check.primary));
      const verifiedBackup = await api.decryptWithKey(key, JSON.parse(check.backup));
      if (verifiedPrimary !== plaintext || verifiedBackup !== plaintext) {
        throw new Error('لم تجتز بيانات السبحة اختبار التحقق بعد الحفظ.');
      }
      template = primary;
      return true;
    });
    saveQueue = operation.catch(() => false);
    return operation;
  }

  async function lock() {
    await saveQueue;
    key = null;
    template = null;
    return true;
  }

  root.AnwarTasbihVault = Object.freeze({
    status,
    create,
    unlock,
    save,
    lock,
    isUnlocked: () => !!(key && template)
  });
})(globalThis);
