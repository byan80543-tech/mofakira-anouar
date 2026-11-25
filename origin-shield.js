/* ANOUAR-MOFKIRA-ORIGIN-2026-01
 * Attribution marker for the original Anouar Notebook project.
 * Defensive only: no telemetry, no network requests, no storage access,
 * and no interference with user content or encryption.
 */
(function installAnouarOriginMarker() {
  'use strict';

  const identity = Object.freeze({
    marker: 'ANOUAR-MOFKIRA-ORIGIN-2026-01',
    project: 'مفكرة أنوار',
    creator: 'Anouar Oumlili (أنوار أومليلي)',
    publicLocation: 'الحسيمة، المغرب',
    documentedConceptOriginDate: '2026-11-17',
    designDistinction: 'بنية مفكرة متكاملة تجمع الكتابة الأدبية والمكتبة وإذاعة القرآن الكريم والدروس الصوتية والسبحة والأذكار وإنشاء الكتب، مع أدوات الأرشفة والنسخ الاحتياطي وإنشاء رموز QR.',
    officialUrl: 'https://mofakira-anouar.pages.dev/mofakira-anouar/',
    sourceRepository: 'https://github.com/byan80543-tech/mofakira-anouar'
  });

  const host = String(window.location.hostname || '').toLowerCase();
  const path = String(window.location.pathname || '/').replace(/\/+$/, '') || '/';
  const isOfficial = (host === 'mofakira-anouar.pages.dev' && path === '/mofakira-anouar') ||
    (host === 'byan80543-tech.github.io' && path === '/mofakira-anouar');
  const isLocalDevelopment =
    window.location.protocol === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1';

  const status = isOfficial ? 'official' : (isLocalDevelopment ? 'development' : 'unverified');
  const markerRecord = Object.freeze({ ...identity, status });

  try {
    Object.defineProperty(window, '__ANOUAR_ORIGIN__', {
      value: markerRecord,
      enumerable: false,
      configurable: false,
      writable: false
    });
  } catch (_) {
    // Attribution display remains independent of this optional inspection hook.
  }

  if (status !== 'unverified') return;

  function revealOriginNotice() {
    if (!document.body || document.getElementById('anouar-origin-notice')) return;

    const notice = document.createElement('aside');
    notice.id = 'anouar-origin-notice';
    notice.className = 'anouar-origin-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('dir', 'rtl');

    const copy = document.createElement('div');
    copy.className = 'anouar-origin-notice-copy';

    const heading = document.createElement('strong');
    heading.textContent = 'بصمة المصدر: مفكرة أنوار';

    const detail = document.createElement('p');
    detail.textContent =
      'مفكرة أنوار ليست دفتر ملاحظات تقليديًا؛ إنها بنية متكاملة تجمع الكتابة الأدبية والمكتبة وإذاعة القرآن الكريم والدروس الصوتية والسبحة وإنشاء الكتب، مع أدوات للأرشفة والنسخ الاحتياطي وإنشاء رموز QR. ويُسجّل المشروع أسبقية أنوار أومليلي في ابتكار هذا التصور وفق سجلّه الموثق.';

    const attribution = document.createElement('p');
    attribution.className = 'anouar-origin-attribution';
    attribution.textContent = 'صاحب ابتكار هذا التصور وبنية المفكرة: Anouar Oumlili (أنوار أومليلي) — الحسيمة، المغرب. أول توثيق متاح للتصور في سجل المشروع: 17 نوفمبر 2026.';

    const source = document.createElement('a');
    source.href = identity.sourceRepository;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'معرفة تفاصيل الابتكار وسجل المصدر والملكية';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'anouar-origin-close';
    close.setAttribute('aria-label', 'إخفاء إشعار إثبات المصدر');
    close.textContent = '×';
    close.addEventListener('click', function () {
      notice.remove();
    });

    copy.append(heading, detail, attribution, source);
    notice.append(copy, close);
    document.body.appendChild(notice);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealOriginNotice, { once: true });
  } else {
    revealOriginNotice();
  }
})();
