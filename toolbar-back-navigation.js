(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const app = byId('app');
  const gate = byId('vaultGate');

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
  };

  const observer = new MutationObserver(syncBackButton);
  const observed = document.querySelectorAll(
    '#app, dialog, #vaultGate, #palettePanel, #fm, #rd, #paperStylePanel, ' +
    '#reciterCountryModal, #surahPickerModal, #lessonSeriesModal'
  );
  observed.forEach((el) => {
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['class', 'open', 'hidden']
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