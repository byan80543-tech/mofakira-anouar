(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  const secureContext = location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  if (!secureContext) return;

  // A controller at startup means this page was already using an older app shell.
  const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
  let registration = null;
  let noticeShown = false;
  let checkInProgress = false;
  let started = false;

  function showUpdateNotice() {
    if (noticeShown || !document.body) return;
    noticeShown = true;

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
    description.textContent = 'أصبح إصدار أحدث من مفكرة أنوار جاهزاً. حدّث الصفحة للاستفادة من التحسينات.';

    copy.append(title, description);

    const actions = document.createElement('div');
    actions.className = 'anouar-update-actions';

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'anouar-update-primary';
    updateButton.textContent = 'تحديث الآن';
    updateButton.addEventListener('click', () => {
      updateButton.disabled = true;
      updateButton.textContent = 'جارٍ التحديث…';
      window.location.reload();
    });

    const laterButton = document.createElement('button');
    laterButton.type = 'button';
    laterButton.className = 'anouar-update-secondary';
    laterButton.textContent = 'لاحقاً';
    laterButton.addEventListener('click', () => notice.remove());

    actions.append(updateButton, laterButton);
    notice.append(copy, actions);
    document.body.append(notice);
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Do not interrupt first-time visitors: their first worker install is not an update.
    if (hadControllerAtStart) showUpdateNotice();
  });

  async function checkForUpdates() {
    if (!registration || checkInProgress || document.visibilityState === 'hidden') return;
    checkInProgress = true;
    try {
      if (registration.waiting && hadControllerAtStart) showUpdateNotice();
      // The browser downloads the worker only when its script has changed.
      await registration.update();
    } catch (error) {
      // Offline visits and temporary network failures should stay silent.
    } finally {
      checkInProgress = false;
    }
  }

  function start() {
    if (started) return;
    started = true;
    navigator.serviceWorker.ready.then(async currentRegistration => {
      registration = currentRegistration;
      if (registration.waiting && hadControllerAtStart) showUpdateNotice();
      await checkForUpdates();
    }).catch(() => {
      // Service-worker registration may not be ready while offline.
    });

    // Check periodically and again when a visitor returns to the open app.
    window.setInterval(checkForUpdates, 5 * 60 * 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdates();
  });

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
