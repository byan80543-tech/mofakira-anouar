/* ANWAR EDITOR DOM SANITIZER
 * Removes active markup and unsafe attributes from the live rich-text editor.
 * This is a browser-side defense-in-depth layer, not a replacement for CSP or
 * server-side authorization. The saved-note sanitizer remains in app-core.js.
 */
(function installAnwarEditorDomSanitizer(root) {
  'use strict';

  const ALLOWED_TAGS = new Set([
    'DIV', 'P', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'FONT', 'H1', 'H2', 'H3', 'H4', 'HR'
  ]);
  const SAFE_STYLES = new Set([
    'color', 'background-color', 'font-size', 'font-family', 'font-weight',
    'font-style', 'text-decoration', 'text-align', 'line-height'
  ]);
  const UNSAFE_STYLE_VALUE =
    /(url\s*\(|expression|javascript:|@import|behavior|-moz-binding|\\|[{}<>])/i;

  function sanitizeStyle(element, rawValue) {
    const kept = [];
    for (const declaration of String(rawValue || '').split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 1) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!SAFE_STYLES.has(property) || !value || UNSAFE_STYLE_VALUE.test(value)) continue;
      kept.push(property + ':' + value);
    }
    const normalized = kept.join(';');
    if (normalized) {
      if (element.getAttribute('style') !== normalized) element.setAttribute('style', normalized);
    } else {
      element.removeAttribute('style');
    }
  }

  function sanitizeNode(node) {
    if (!node) return;
    if (node.nodeType === 8) {
      node.remove();
      return;
    }
    if (node.nodeType !== 1) return;

    if (!ALLOWED_TAGS.has(node.tagName)) {
      const children = Array.from(node.childNodes || []);
      children.forEach(sanitizeNode);
      node.replaceWith(...children);
      return;
    }

    for (const attribute of Array.from(node.attributes || [])) {
      const name = String(attribute.name || '').toLowerCase();
      if (name === 'style') {
        sanitizeStyle(node, attribute.value);
      } else if (node.tagName === 'DIV' && name === 'class' && attribute.value === 'v') {
        // The poetry verse-row class is the only retained class.
      } else if (node.tagName === 'FONT' && (name === 'color' || name === 'face')) {
        // Legacy FONT formatting remains supported by the existing editor.
      } else if (node.tagName === 'FONT' && name === 'size' && /^[1-7]$/.test(attribute.value)) {
        // Keep only the historical numeric FONT size values.
      } else {
        node.removeAttribute(attribute.name);
      }
    }

    for (const child of Array.from(node.childNodes || [])) sanitizeNode(child);
  }

  function sanitizeHtml(value) {
    const template = root.document.createElement('template');
    template.innerHTML = String(value == null ? '' : value);
    for (const child of Array.from(template.content.childNodes || [])) sanitizeNode(child);
    return template.innerHTML;
  }

  function observe(editor) {
    if (!editor || editor.nodeType !== 1 || typeof root.MutationObserver !== 'function') {
      return Object.freeze({ disconnect() {} });
    }

    let cleaning = false;
    const clean = records => {
      if (cleaning) return;
      cleaning = true;
      try {
        for (const record of records) {
          if (record.type === 'attributes') {
            const target = record.target;
            if (target && target !== editor && editor.contains(target)) sanitizeNode(target);
            continue;
          }
          if (record.type === 'childList') {
            for (const node of Array.from(record.addedNodes || [])) {
              if (node === editor || editor.contains(node)) sanitizeNode(node);
            }
          }
        }
      } finally {
        cleaning = false;
      }
    };

    for (const child of Array.from(editor.childNodes || [])) sanitizeNode(child);
    const observer = new root.MutationObserver(clean);
    observer.observe(editor, { childList: true, subtree: true, attributes: true });
    return observer;
  }

  root.AnwarEditorDomSanitizer = Object.freeze({ sanitizeHtml, observe });
})(globalThis);
