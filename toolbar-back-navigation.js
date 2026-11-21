(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const app = byId('app');
  const gate = byId('vaultGate');
  const palettePanel = byId('palettePanel');
  const paletteButton = byId('paletteBtn');
  const radioButton = byId('rb');

  const isOpen = (id, className) => {
    const el = byId(id);
    return !!el && (className ? el.classList.contains(className) : !el.hidden);
  };

  const hasBackContext = () => {
    if (gate && !gate.hidden) return false;

    return !!(
      document.querySelector('dialog[open]') ||
      isOpen('palettePanel', 'open') ||
      isOpen('fm', 'o') ||
      isOpen('rd', 'o') ||
      isOpen('paperStylePanel') ||
      isOpen('reciterCountryModal') ||
      isOpen('surahPickerModal') ||
      isOpen('lessonSeriesModal') ||
      app?.classList.contains('ed') ||
      app?.classList.contains('focus')
    );
  };

  const syncBackButton = () => {
    document.documentElement.classList.toggle('anwar-back-visible', hasBackContext());

    if (palettePanel && paletteButton) {
      paletteButton.setAttribute('aria-expanded', String(palettePanel.classList.contains('open')));
    }

    if (radioButton) {
      const playing = radioButton.dataset.playing === 'true' || /[⏸Ⅱ]/.test(radioButton.textContent);
      radioButton.setAttribute('aria-pressed', String(playing));
      radioButton.setAttribute('aria-label', playing ? 'إيقاف إذاعة القرآن مؤقتًا' : 'تشغيل إذاعة القرآن');
      radioButton.title = playing ? 'إيقاف إذاعة القرآن مؤقتًا' : 'تشغيل إذاعة القرآن الكريم';
    }
  };

  const observer = new MutationObserver(syncBackButton);
  const observed = document.querySelectorAll(
    '#app, dialog, #vaultGate, #palettePanel, #fm, #rd, #paperStylePanel, ' +
    '#reciterCountryModal, #surahPickerModal, #lessonSeriesModal, #rb'
  );
  observed.forEach((el) => {
    const isRadioButton = el === radioButton;
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['class', 'open', 'hidden', 'data-playing'],
      childList: isRadioButton,
      characterData: isRadioButton,
      subtree: isRadioButton
    });
  });

  const closeByButton = (id) => {
    const button = byId(id);
    if (!button) return false;
    button.click();
    return true;
  };

  document.addEventListener('click', (event) => {
    const backButton = event.target.closest('#bk');
    if (!backButton) return;

    // The encrypted-vault gate must never be dismissed by navigation.
    if (gate && !gate.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const dialogs = [...document.querySelectorAll('dialog[open]')];
    const activeDialog = dialogs[dialogs.length - 1];
    if (activeDialog) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeDialog.close();
      syncBackButton();
      return;
    }

    const closeActions = [
      ['reciterCountryModal', 'countryModalClose'],
      ['surahPickerModal', 'surahPickerClose'],
      ['lessonSeriesModal', 'lessonSeriesClose']
    ];

    for (const [modalId, closeId] of closeActions) {
      const modal = byId(modalId);
      if (modal && !modal.hidden) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeByButton(closeId);
        syncBackButton();
        return;
      }
    }

    const liveStationModal = byId('liveStationModal');
    if (liveStationModal && !liveStationModal.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      liveStationModal.querySelector('.live-station-modal-close')?.click();
      syncBackButton();
      return;
    }

    const prayerSettings = document.querySelector('#anwarPrayerCard .anwar-prayer-settings');
    if (prayerSettings?.open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      prayerSettings.open = false;
      document.querySelector('[data-anwar-service="adhan"]')?.setAttribute('aria-expanded', 'false');
      syncBackButton();
      return;
    }

    // Back inside a religious service must stay within the service dashboard.
    // Cancel an active adhkar edit first; only the next back returns to the
    // religious sections grid.
    const servicePage = document.querySelector('#rd .anwar-service-page:not([hidden])');
    if (servicePage) {
      const editingForm = servicePage.querySelector('#adhkarContent .protective-personal-form[data-edit-id]');
      const cancelEdit = editingForm?.querySelector('.adhkar-dialog-actions button[type="button"]');
      if (cancelEdit && !cancelEdit.hidden) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelEdit.click();
        syncBackButton();
        return;
      }

      const serviceBack = servicePage.querySelector('[data-anwar-service-back]');
      if (serviceBack) {
        event.preventDefault();
        event.stopImmediatePropagation();
        serviceBack.click();
        syncBackButton();
        return;
      }
    }

    const paperStyle = byId('paperStylePanel');
    if (paperStyle && !paperStyle.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      paperStyle.hidden = true;
      byId('paperStyleBtn')?.setAttribute('aria-expanded', 'false');
      syncBackButton();
      return;
    }

    const radio = byId('rd');
    if (radio?.classList.contains('o')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      radio.classList.remove('o');
      document.body.classList.remove('radio-open');
      byId('rg')?.setAttribute('aria-expanded', 'false');
      syncBackButton();
      return;
    }

    const palette = byId('palettePanel');
    if (palette?.classList.contains('open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      palette.classList.remove('open');
      byId('paletteBtn')?.setAttribute('aria-expanded', 'false');
      syncBackButton();
      return;
    }

    const fontMenu = byId('fm');
    if (fontMenu?.classList.contains('o')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      fontMenu.classList.remove('o');
      syncBackButton();
      return;
    }

    if (app?.classList.contains('focus')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      app.classList.remove('focus');
      syncBackButton();
      return;
    }

    // In the editor, let the notebook's existing back action return to the list.
  }, true);

  syncBackButton();
})();