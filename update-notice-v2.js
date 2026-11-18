(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  const secureContext = location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  if (!secureContext) return;

  const serviceWorker = navigator.serviceWorker;
  let registration = null;
  let hasActiveController = Boolean(serviceWorker.controller);
  let waitingWorker = null;
  let dismissedWorker = null;
  let noticeWorker = null;
  let noticeElement = null;
  let noticeShown = false;
  let checkInProgress = false;
  let lastCheckAt = 0;
  let started = false;
  const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

  function getWaitingWorker() {
    const candidate = registration && registration.waiting
      ? registration.waiting
      : waitingWorker;
    return candidate && candidate.state === 'installed' ? candidate : null;
  }

  function removeNotice(dismissCurrent) {
    if (dismissCurrent && noticeWorker) dismissedWorker = noticeWorker;
    if (noticeElement) noticeElement.remove();
    noticeElement = null;
    noticeWorker = null;
    noticeShown = false;
  }

  function showUpdateNotice(worker) {
    if (!worker || worker.state !== 'installed' || !hasActiveController ||
        worker === dismissedWorker || noticeShown || !document.body) return;

    noticeShown = true;
    noticeWorker = worker;

    const notice = document.createElement('aside');
    notice.id = 'anouarUpdateNotice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('dir', 'rtl');

    const copy = document.createElement('div');
    copy.className = 'anouar-update-copy';

    const title = document.createElement('strong');
    title.className = 'anouar-update-title';
    title.textContent = 'تحديث جديد متاح';

    const description = document.createElement('p');
    description.className = 'anouar-update-description';
    description.textContent = 'أصبح إصدار أحدث من مفكرة أنوار جاهزاً. احفظ عملك ثم حدّث بأمان.';

    copy.append(title, description);

    const actions = document.createElement('div');
    actions.className = 'anouar-update-actions';

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'anouar-update-primary';
    updateButton.textContent = 'تحديث الآن';

    const laterButton = document.createElement('button');
    laterButton.type = 'button';
    laterButton.className = 'anouar-update-secondary';
    laterButton.textContent = 'لاحقاً';

    updateButton.addEventListener('click', async () => {
      if (updateButton.disabled) return;
      updateButton.disabled = true;
      laterButton.disabled = true;
      description.textContent = 'جارٍ حفظ تعديلاتك المشفّرة والتحقق منها…';

      let releasePage = null;
      try {
        const bridge = window.AnouarUpdateBridge;
        if (!bridge || typeof bridge.prepareForReload !== 'function') {
          throw new Error('تعذّر تهيئة الحفظ الآمن. أعد تحميل المفكرة ثم حاول مجدداً.');
        }

        releasePage = await bridge.prepareForReload();

        const targetWorker = getWaitingWorker() || worker;
        if (!targetWorker || targetWorker.state !== 'installed') {
          throw new Error('لم يعد التحديث جاهزاً. أعد المحاولة بعد لحظة.');
        }

        description.textContent = 'اكتمل الحفظ. يجري تفعيل الإصدار الجديد…';

        const controllerChanged = new Promise((resolve, reject) => {
          let settled = false;
          let timeoutId = null;
          const finish = (error) => {
            if (settled) return;
            settled = true;
            serviceWorker.removeEventListener('controllerchange', onControllerChange);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            if (error) reject(error);
            else resolve();
          };
          const onControllerChange = () => finish();
          serviceWorker.addEventListener('controllerchange', onControllerChange);
          timeoutId = window.setTimeout(() => {
            finish(new Error('تأخر تفعيل الإصدار الجديد. لم نحذف بياناتك؛ حاول التحديث مرة أخرى.'));
          }, 20000);
          try {
            targetWorker.postMessage({ type: 'ANOUAR_ACTIVATE_UPDATE' });
          } catch (error) {
            finish(error);
          }
        });

        await controllerChanged;
        window.location.reload();
      } catch (error) {
        if (typeof releasePage === 'function') releasePage();
        updateButton.disabled = false;
        laterButton.disabled = false;
        description.textContent = error && error.message
          ? error.message
          : 'تعذّر إتمام التحديث. بقيت بياناتك كما هي؛ حاول مجدداً.';
      }
    });

    laterButton.addEventListener('click', () => removeNotice(true));

    actions.append(updateButton, laterButton);
    notice.append(copy, actions);
    document.body.append(notice);
    noticeElement = notice;
  }

  function observeRegistration(currentRegistration) {
    registration = currentRegistration;

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state !== 'installed') return;
        if (serviceWorker.controller) {
          hasActiveController = true;
          waitingWorker = registration.waiting || installingWorker;
          showUpdateNotice(waitingWorker);
        }
      });
    });

    if (registration.waiting && serviceWorker.controller) {
      hasActiveController = true;
      waitingWorker = registration.waiting;
      showUpdateNotice(waitingWorker);
    }
  }

  serviceWorker.addEventListener('controllerchange', () => {
    // The first controller belongs to the first install, not an update.
    hasActiveController = true;
  });

  async function checkForUpdates(force = false) {
    if (!registration) return;
    if (serviceWorker.controller) hasActiveController = true;

    // A waiting worker is already downloaded; show it immediately without
    // making another network request.
    if (registration.waiting && hasActiveController) {
      waitingWorker = registration.waiting;
      showUpdateNotice(waitingWorker);
      return;
    }

    if (checkInProgress || document.visibilityState === 'hidden' || navigator.onLine === false) return;
    const now = Date.now();
    if (!force && now - lastCheckAt < UPDATE_CHECK_INTERVAL_MS) return;

    lastCheckAt = now;
    checkInProgress = true;
    try {
      await registration.update();
      if (registration.waiting && serviceWorker.controller) {
        hasActiveController = true;
        waitingWorker = registration.waiting;
        showUpdateNotice(waitingWorker);
      }
    } catch (error) {
      // Offline visits and temporary network failures should stay silent.
    } finally {
      checkInProgress = false;
    }
  }

  function start() {
    if (started) return;
    started = true;
    serviceWorker.ready.then(currentRegistration => {
      observeRegistration(currentRegistration);
      const runCheck = () => checkForUpdates(true);
      // Do not compete with first paint, editor setup or the first user action.
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runCheck, { timeout: 12000 });
      } else {
        window.setTimeout(runCheck, 7000);
      }
    }).catch(() => {
      // Service-worker registration may not be ready while offline.
    });

    window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdates();
  });

  window.addEventListener('online', () => checkForUpdates(true));

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
