import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../update-notice-v2.js', import.meta.url), 'utf8');
const appCore = fs.readFileSync(new URL('../app-core.js', import.meta.url), 'utf8');

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.parentNode = null;
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.disabled = false;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...items) {
    for (const item of items) {
      item.parentNode = this;
      this.children.push(item);
    }
  }
  addEventListener(name, handler, options) {
    const items = this.listeners.get(name) || [];
    items.push({ handler, once: Boolean(options && options.once) });
    this.listeners.set(name, items);
  }
  removeEventListener(name, handler) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item.handler !== handler));
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(item => item !== this);
    this.parentNode = null;
  }
  click() {
    const handlers = [...(this.listeners.get('click') || [])];
    return handlers.map(item => item.handler())[0];
  }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }
  allText() {
    return this.textContent + this.children.map(child => child.allText()).join(' ');
  }
}

class FakeWorker {
  constructor(state = 'installing', url = 'https://example.test/mofakira-anouar/service-worker.js') {
    this.state = state;
    this.scriptURL = url;
    this.listeners = new Map();
    this.messages = [];
    this.onMessage = null;
  }
  addEventListener(name, handler) {
    const list = this.listeners.get(name) || [];
    list.push(handler);
    this.listeners.set(name, list);
  }
  setState(state) {
    this.state = state;
    for (const handler of this.listeners.get('statechange') || []) handler();
  }
  postMessage(message) {
    this.messages.push(message);
    if (this.onMessage) this.onMessage(message);
  }
}

function createHarness({ controller = true, bridge = null, confirmUpdate = false } = {}) {
  const serviceWorkerListeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const registrationListeners = new Map();
  const body = new FakeElement('body');
  const registration = {
    waiting: null,
    installing: null,
    updateCalls: 0,
    addEventListener(name, handler) {
      const list = registrationListeners.get(name) || [];
      list.push(handler);
      registrationListeners.set(name, list);
    },
    emit(name) {
      for (const handler of registrationListeners.get(name) || []) handler();
    },
    async update() { this.updateCalls++; }
  };
  let reloadCalls = 0;
  const serviceWorker = {
    controller: controller ? { scriptURL: 'https://example.test/mofakira-anouar/service-worker.js' } : null,
    ready: Promise.resolve(registration),
    addEventListener(name, handler, options) {
      const list = serviceWorkerListeners.get(name) || [];
      list.push({ handler, once: Boolean(options && options.once) });
      serviceWorkerListeners.set(name, list);
    },
    removeEventListener(name, handler) {
      serviceWorkerListeners.set(name, (serviceWorkerListeners.get(name) || []).filter(item => item.handler !== handler));
    },
    emit(name) {
      const list = [...(serviceWorkerListeners.get(name) || [])];
      for (const item of list) {
        item.handler();
        if (item.once) this.removeEventListener(name, item.handler);
      }
    }
  };
  const document = {
    body,
    readyState: 'complete',
    visibilityState: 'visible',
    createElement(tagName) { return new FakeElement(tagName); },
    addEventListener(name, handler) { documentListeners.set(name, handler); }
  };
  const window = {
    AnouarUpdateBridge: bridge,
    confirm(message) { window.confirmMessage = message; return confirmUpdate; },
    location: { reload() { reloadCalls++; } },
    requestIdleCallback(handler, options) {
      window.idleHandler = handler;
      window.idleOptions = options;
      return 1;
    },
    addEventListener(name, handler) { windowListeners.set(name, handler); },
    setInterval(handler, delay) {
      assert.equal(delay, 900000, 'periodic update check runs every fifteen minutes');
      window.intervalHandler = handler;
      return 1;
    },
    setTimeout(handler, delay) {
      assert.equal(delay, 20000, 'worker activation has a bounded wait');
      window.timeoutHandler = handler;
      return 1;
    },
    clearTimeout() {}
  };
  vm.runInNewContext(source, {
    navigator: { serviceWorker, onLine: true },
    document,
    window,
    location: { protocol: 'https:', hostname: 'example.test' },
    console
  }, { timeout: 3000 });

  return {
    body,
    registration,
    serviceWorker,
    window,
    reloadCount: () => reloadCalls,
    triggerIdleCheck() { window.idleHandler?.(); },
    triggerOnline() { windowListeners.get('online')?.(); },
    triggerControllerChange() { serviceWorker.emit('controllerchange'); },
    triggerVisibilityChange() { documentListeners.get('visibilitychange')?.(); },
    installWorker(worker) {
      registration.installing = worker;
      registration.waiting = null;
      registration.emit('updatefound');
    },
    finishWorkerInstall(worker) {
      registration.waiting = worker;
      registration.installing = null;
      worker.setState('installed');
    }
  };
}

const firstVisit = createHarness({ controller: false });
await new Promise(resolve => setImmediate(resolve));
assert.equal(firstVisit.registration.updateCalls, 0, 'the startup update check waits until the browser is idle');
assert.equal(firstVisit.window.idleOptions?.timeout, 12000, 'the idle update check has a bounded fallback');
firstVisit.triggerIdleCheck();
await new Promise(resolve => setImmediate(resolve));
assert.equal(firstVisit.registration.updateCalls, 1, 'the deferred startup update check runs once after first paint');
const firstInstall = new FakeWorker('installing');
firstVisit.installWorker(firstInstall);
firstVisit.finishWorkerInstall(firstInstall);
assert.equal(firstVisit.body.children.length, 0, 'initial installation does not show an update notice');
firstVisit.serviceWorker.controller = { scriptURL: 'https://example.test/mofakira-anouar/service-worker.js' };
firstVisit.triggerControllerChange();
const laterUpdate = new FakeWorker('installing', 'https://example.test/mofakira-anouar/service-worker-v2.js');
firstVisit.installWorker(laterUpdate);
firstVisit.finishWorkerInstall(laterUpdate);
assert.ok(firstVisit.body.find(node => node.id === 'anouarUpdateNotice'), 'a first-time visitor is notified about later updates in the same session');

const dismissedWorker = new FakeWorker('installed', 'https://example.test/mofakira-anouar/service-worker-v3.js');
const dismissedVisit = createHarness({ controller: true });
await new Promise(resolve => setImmediate(resolve));
dismissedVisit.registration.waiting = dismissedWorker;
dismissedVisit.triggerVisibilityChange();
const dismissedBanner = dismissedVisit.body.find(node => node.id === 'anouarUpdateNotice');
assert.ok(dismissedBanner, 'existing visitors see an installed waiting update');
dismissedBanner.find(node => node.textContent === 'لاحقاً').click();
assert.equal(dismissedVisit.body.children.length, 0, 'later dismisses the current update');
dismissedVisit.triggerVisibilityChange();
assert.equal(dismissedVisit.body.children.length, 0, 'the same dismissed update does not immediately reappear');
const nextWorker = new FakeWorker('installing', 'https://example.test/mofakira-anouar/service-worker-v4.js');
dismissedVisit.installWorker(nextWorker);
dismissedVisit.finishWorkerInstall(nextWorker);
assert.ok(dismissedVisit.body.find(node => node.id === 'anouarUpdateNotice'), 'a later release can show a fresh notice in the same session');

let resolveBridge;
const bridgeGate = new Promise(resolve => { resolveBridge = resolve; });
const safeVisit = createHarness({
  controller: true,
  bridge: { async prepareForReload() { await bridgeGate; return () => {}; } }
});
await new Promise(resolve => setImmediate(resolve));
const safeWorker = new FakeWorker('installed');
safeVisit.registration.waiting = safeWorker;
safeVisit.triggerVisibilityChange();
const safeBanner = safeVisit.body.find(node => node.id === 'anouarUpdateNotice');
const updateButton = safeBanner.find(node => node.textContent === 'تحديث الآن');
const updatePromise = updateButton.click();
assert.equal(safeWorker.messages.length, 0, 'the worker is not activated before encrypted-save preparation completes');
resolveBridge();
await new Promise(resolve => setImmediate(resolve));
assert.equal(safeWorker.messages.length, 1, 'the visitor approves activation only after save preparation');
assert.equal(safeWorker.messages[0].type, 'ANOUAR_ACTIVATE_UPDATE', 'the expected consent message is sent to the waiting worker');
safeVisit.serviceWorker.controller = safeWorker;
safeVisit.triggerControllerChange();
await updatePromise;
assert.equal(safeVisit.reloadCount(), 1, 'the page reloads only after the new worker takes control');

const failedVisit = createHarness({
  controller: true,
  bridge: { async prepareForReload() { throw new Error('تعذّر حفظ الخزنة'); } }
});
await new Promise(resolve => setImmediate(resolve));
failedVisit.registration.waiting = new FakeWorker('installed');
failedVisit.triggerVisibilityChange();
const failedBanner = failedVisit.body.find(node => node.id === 'anouarUpdateNotice');
const failedButton = failedBanner.find(node => node.textContent === 'تحديث الآن');
await failedButton.click();
assert.equal(failedVisit.registration.waiting.messages.length, 0, 'save failure prevents worker activation');
assert.equal(failedButton.disabled, false, 'failed save re-enables the update action');

const noBridgeVisit = createHarness({ controller: true, bridge: null });
await new Promise(resolve => setImmediate(resolve));
noBridgeVisit.registration.waiting = new FakeWorker('installed');
noBridgeVisit.triggerVisibilityChange();
const noBridgeBanner = noBridgeVisit.body.find(node => node.id === 'anouarUpdateNotice');
const noBridgeButton = noBridgeBanner.find(node => node.textContent === 'تحديث الآن');
await noBridgeButton.click();
assert.ok(noBridgeVisit.window.confirmMessage.includes('قد تفقد أي كتابة لم تُحفظ بعد'), 'missing save bridge displays an explicit data-loss warning');
assert.equal(noBridgeVisit.registration.waiting.messages.length, 0, 'declining emergency update never activates a worker');
assert.equal(noBridgeButton.disabled, false, 'declining emergency update restores the update action');

const emergencyVisit = createHarness({ controller: true, bridge: null, confirmUpdate: true });
await new Promise(resolve => setImmediate(resolve));
const emergencyWorker = new FakeWorker('installed');
emergencyVisit.registration.waiting = emergencyWorker;
emergencyVisit.triggerVisibilityChange();
const emergencyBanner = emergencyVisit.body.find(node => node.id === 'anouarUpdateNotice');
const emergencyButton = emergencyBanner.find(node => node.textContent === 'تحديث الآن');
const emergencyAction = emergencyButton.click();
await Promise.resolve();
assert.equal(emergencyWorker.messages[0].type, 'ANOUAR_ACTIVATE_UPDATE', 'explicitly approved recovery activates the waiting worker');
emergencyVisit.serviceWorker.controller = emergencyWorker;
emergencyVisit.triggerControllerChange();
await emergencyAction;
assert.equal(emergencyVisit.reloadCount(), 1, 'approved recovery reloads after the new worker takes control');

const appScript = appCore;
assert.ok(appScript.includes('function save(){') && appScript.includes('window.AnouarUpdateBridge'), 'the external application bundle exposes its encrypted-save bridge');
const bridgeStart = appScript.indexOf('window.AnouarUpdateBridge');
const bridgeEnd = appScript.indexOf('\n});', bridgeStart);
const bridgeSource = appScript.slice(bridgeStart, bridgeEnd);
const initClose = appScript.indexOf('},0));', bridgeStart);
assert.ok(initClose > bridgeStart, 'the update bridge remains inside the notebook initialization scope');
assert.ok(bridgeSource.includes('storageRecoveryBlocked'), 'the update bridge refuses to reload during storage recovery');
assert.ok(bridgeSource.includes('await vaultSaveQueue'), 'the update bridge waits for the encrypted save queue');
assert.ok(bridgeSource.includes('flushPrivatePreferenceSave()'), 'the update bridge flushes delayed preference changes');
assert.ok(bridgeSource.indexOf('app.inert = true') < bridgeSource.indexOf('flushPendingEdit(false)'), 'editing is frozen before pending note changes are flushed');
assert.ok(bridgeSource.indexOf('flushPendingEdit(false)') < bridgeSource.indexOf('await vaultSaveQueue'), 'pending editor changes are flushed before the encrypted queue is awaited');
assert.ok(bridgeSource.includes('vaultLastWriteError'), 'a failed encrypted write cancels the update');

console.log('Safe update notification, first-install tracking, deferral and encrypted-save tests passed.');
