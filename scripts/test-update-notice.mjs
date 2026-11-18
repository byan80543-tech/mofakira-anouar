import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../update-notice.js', import.meta.url), 'utf8');

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
  addEventListener(name, handler) {
    const items = this.listeners.get(name) || [];
    items.push(handler);
    this.listeners.set(name, items);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(item => item !== this);
    this.parentNode = null;
  }
  click() {
    for (const handler of this.listeners.get('click') || []) handler();
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

function createHarness({ controller = true } = {}) {
  const serviceWorkerListeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const body = new FakeElement('body');
  const registration = {
    waiting: null,
    updateCalls: 0,
    async update() { this.updateCalls++; }
  };
  let reloadCalls = 0;
  const navigator = {
    serviceWorker: {
      controller: controller ? {} : null,
      ready: Promise.resolve(registration),
      addEventListener(name, handler) { serviceWorkerListeners.set(name, handler); }
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
    location: { reload() { reloadCalls++; } },
    setInterval(handler, delay) {
      assert.equal(delay, 300000, 'periodic update check runs every five minutes');
      window.intervalHandler = handler;
      return 1;
    }
  };
  vm.runInNewContext(source, {
    navigator,
    document,
    window,
    location: { protocol: 'https:', hostname: 'example.test' },
    console
  }, { timeout: 3000 });
  return {
    body,
    registration,
    window,
    reloadCount: () => reloadCalls,
    triggerControllerChange() { serviceWorkerListeners.get('controllerchange')?.(); },
    triggerVisibilityChange() { documentListeners.get('visibilitychange')?.(); }
  };
}

const existingVisitor = createHarness({ controller: true });
await Promise.resolve();
await Promise.resolve();
assert.equal(existingVisitor.registration.updateCalls, 1, 'existing visitors check for a new worker on startup');
assert.equal(existingVisitor.body.children.length, 0, 'no update banner appears before an update exists');
existingVisitor.triggerControllerChange();
const banner = existingVisitor.body.find(node => node.id === 'anouarUpdateNotice');
assert.ok(banner, 'existing visitors see a banner when the new worker takes control');
assert.match(banner.allText(), /تحديث جديد متاح/, 'banner announces a new update in Arabic');
const laterButton = banner.find(node => node.textContent === 'لاحقاً');
assert.ok(laterButton, 'banner offers a dismiss action');
laterButton.click();
assert.equal(existingVisitor.body.children.length, 0, 'dismiss action closes the banner without reloading');
assert.equal(existingVisitor.reloadCount(), 0, 'dismiss action does not reload the app');

const updateVisitor = createHarness({ controller: true });
await Promise.resolve();
await Promise.resolve();
updateVisitor.triggerControllerChange();
const updateBanner = updateVisitor.body.find(node => node.id === 'anouarUpdateNotice');
const updateButton = updateBanner?.find(node => node.textContent === 'تحديث الآن');
assert.ok(updateButton, 'banner offers a one-tap update action');
updateButton.click();
assert.equal(updateVisitor.reloadCount(), 1, 'update action reloads the page exactly once');

const firstVisit = createHarness({ controller: false });
await Promise.resolve();
await Promise.resolve();
firstVisit.triggerControllerChange();
assert.equal(firstVisit.body.children.length, 0, 'first-time visitors are not shown a false update alert');

console.log('Smart update-notice lifecycle tests passed.');
