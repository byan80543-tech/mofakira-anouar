/* Owner-only shared adhkar library management.
 * The admin bearer token exists only in this page's memory and is never persisted.
 */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const apiBase = (() => {
  const raw = String(window.ANWAR_API_GATEWAY_BASE || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
   const url = new URL(raw);
   return url.protocol === 'https:' ? url.href.replace(/\/+$/, '') : '';
  } catch {
   return '';
  }
 })();

 const adminDialog = $('adhkarAdminDialog');
 const loginForm = $('adhkarAdminLogin');
 const adminWorkspace = $('adhkarAdminWorkspace');
 const officialForm = $('adhkarOfficialForm');
 const syncStatus = $('adhkarSyncStatus');
 let adminToken = null;
 let sessionTimer = null;
 let officialEntries = [];
 let libraryInitialized = false;

 function status(node, message) {
  if (node) node.textContent = String(message || '');
 }

 function requireApi() {
  if (apiBase) return true;
  status(syncStatus, 'المكتبة المشتركة لم تُفعّل بعد على الخادم. تعمل القائمة المحلية حاليًا.');
  return false;
 }

 async function api(path, options = {}) {
  if (!apiBase) throw new Error('بوابة المكتبة المشتركة غير مهيأة بعد.');
  const headers = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = 'Bearer ' + options.token;
  const response = await fetch(apiBase + path, {
   method: options.method || 'GET',
   headers,
   body: options.body === undefined ? undefined : JSON.stringify(options.body),
   credentials: 'omit',
   cache: 'no-store',
   redirect: 'error',
   referrerPolicy: 'no-referrer'
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
   if (response.status === 401 && options.token) clearAdminSession();
   const messages = {
    already_initialized: 'تم تهيئة المكتبة من قبل.',
    initialize_library_first: 'ابدأ بتهيئة القائمة الحالية قبل تعديلها.'
   };
   throw new Error(data.message || messages[data.error] || 'تعذّر إكمال الطلب (' + response.status + ').');
  }
  return data;
 }

 function setEntries(items) {
  if (!Array.isArray(items)) return false;
  if (typeof window.AnwarSetProtectiveAdhkar !== 'function') return false;
  return window.AnwarSetProtectiveAdhkar(items);
 }

 async function refreshPublicLibrary() {
  if (!apiBase) return;
  try {
   const data = await api('/v1/adhkar');
   if (data.initialized && Array.isArray(data.entries) && data.entries.length) {
    if (setEntries(data.entries)) {
     status(syncStatus, 'تُعرض الأذكار الرسمية المشتركة لجميع الزوار.');
    }
   } else {
    status(syncStatus, 'تُعرض القائمة المحلية. تكتمل مزامنة المكتبة بعد تهيئتها من لوحة الإدارة.');
   }
  } catch (error) {
   status(syncStatus, 'تعذرت مزامنة المكتبة الآن؛ تُعرض النسخة المحلية دون فقدانها.');
   console.warn('Adhkar library sync unavailable:', error);
  }
 }

 function formData(form) {
  const data = new FormData(form);
  const countText = String(data.get('count') || '').trim();
  return {
   id: String(data.get('id') || '').trim() || undefined,
   group: String(data.get('group') || '').trim(),
   title: String(data.get('title') || '').trim(),
   text: String(data.get('text') || '').trim(),
   count: countText ? Number(countText) : null,
   occasion: String(data.get('occasion') || '').trim(),
   source: String(data.get('source') || '').trim(),
   sourceUrl: String(data.get('sourceUrl') || '').trim(),
   kind: String(data.get('kind') || 'dhikr')
  };
 }

 function appendText(parent, tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = String(text || '');
  if (className) node.className = className;
  parent.append(node);
  return node;
 }

 function createAction(label, action, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
 }

 function sourceLink(parent, source, url) {
  if (source) appendText(parent, 'p', 'المصدر: ' + source);
  if (url) {
   const link = document.createElement('a');
   link.href = url;
   link.target = '_blank';
   link.rel = 'noopener noreferrer';
   link.textContent = 'فتح المرجع';
   parent.append(link);
  }
 }

 function renderOfficialEntries() {
  const host = $('adhkarOfficialList');
  if (!host) return;
  host.replaceChildren();
  if (!libraryInitialized) {
   appendText(host, 'p', 'لم تُهيأ قاعدة المكتبة بعد. استورد القائمة الحالية أولًا.');
   return;
  }
  if (!officialEntries.length) {
   appendText(host, 'p', 'لا توجد أذكار منشورة حاليًا.');
   return;
  }
  officialEntries.forEach(item => {
   const card = document.createElement('article');
   card.className = 'adhkar-admin-entry';
   appendText(card, 'strong', item.title);
   appendText(card, 'small', item.group + ' · ' + (item.count == null ? 'دون عدد محدد' : item.count + ' مرات'));
   appendText(card, 'p', item.text);
   if (item.occasion) appendText(card, 'small', item.occasion);
   sourceLink(card, item.source, item.sourceUrl);
   const actions = document.createElement('div');
   actions.className = 'adhkar-admin-item-actions';
   actions.append(
    createAction('تعديل', 'edit', item.id),
    createAction('حذف من المكتبة العامة', 'delete', item.id)
   );
   card.append(actions);
   host.append(card);
  });
 }

 async function loadAdminData() {
  const library = await api('/v1/admin/adhkar', { token: adminToken });
  libraryInitialized = Boolean(library.initialized);
  officialEntries = Array.isArray(library.entries) ? library.entries : [];
  const initialize = $('adhkarInitialize');
  if (initialize) initialize.hidden = libraryInitialized;
  renderOfficialEntries();
  if (libraryInitialized) setEntries(officialEntries);
  else status($('adhkarAdminStatus'), 'المكتبة المشتركة فارغة. اضغط «تهيئة القائمة الحالية» لنقل الأذكار الحالية إلى المكتبة مرة واحدة.');
 }

 function clearAdminSession() {
  adminToken = null;
  if (sessionTimer !== null) window.clearTimeout(sessionTimer);
  sessionTimer = null;
  if (loginForm) loginForm.hidden = false;
  if (adminWorkspace) adminWorkspace.hidden = true;
  if ($('adhkarOfficialList')) $('adhkarOfficialList').replaceChildren();
  officialEntries = [];
  libraryInitialized = false;
 }

 function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
 }

 $('adhkarAdminOpen')?.addEventListener('click', () => {
  if (!requireApi()) return;
  status($('adhkarLoginStatus'), '');
  openDialog(adminDialog);
 });

 document.querySelectorAll('[data-adhkar-close]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog')?.close());
 });

 loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!requireApi()) return;
  const password = String(new FormData(loginForm).get('password') || '');
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  status($('adhkarLoginStatus'), 'جارٍ التحقق...');
  try {
   const data = await api('/v1/admin/session', { method: 'POST', body: { password } });
   adminToken = data.token;
   loginForm.reset();
   loginForm.hidden = true;
   adminWorkspace.hidden = false;
   sessionTimer = window.setTimeout(() => {
    clearAdminSession();
    status($('adhkarLoginStatus'), 'انتهت جلسة الإدارة. سجّل الدخول مجددًا.');
   }, Math.max(1, Number(data.expiresIn) || 1200) * 1000);
   await loadAdminData();
   status($('adhkarAdminStatus'), 'تم الدخول. يمكنك إضافة الأذكار الرسمية أو تعديلها أو حذفها.');
  } catch (error) {
   status($('adhkarLoginStatus'), error.message);
  } finally {
   submit.disabled = false;
  }
 });

 $('adhkarAdminLogout')?.addEventListener('click', () => {
  clearAdminSession();
  adminDialog?.close();
 });
 adminDialog?.addEventListener('close', clearAdminSession);

 $('adhkarInitialize')?.addEventListener('click', async () => {
  if (!adminToken) return;
  const entries = typeof window.AnwarGetProtectiveAdhkar === 'function'
   ? window.AnwarGetProtectiveAdhkar()
   : [];
  if (!entries.length) {
   status($('adhkarAdminStatus'), 'تعذر قراءة القائمة المحلية لتهيئة المكتبة.');
   return;
  }
  const button = $('adhkarInitialize');
  button.disabled = true;
  try {
   await api('/v1/admin/adhkar/initialize', { method: 'POST', token: adminToken, body: { entries } });
   await loadAdminData();
   status($('adhkarAdminStatus'), 'تم نقل القائمة الحالية إلى المكتبة المشتركة.');
   await refreshPublicLibrary();
  } catch (error) {
   status($('adhkarAdminStatus'), error.message);
  } finally {
   button.disabled = false;
  }
 });

 officialForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!adminToken || !libraryInitialized) {
   status($('adhkarAdminStatus'), 'هيّئ المكتبة الحالية أولًا.');
   return;
  }
  const payload = formData(officialForm);
  const isEdit = Boolean(payload.id);
  const submit = officialForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
   await api('/v1/admin/adhkar', {
    method: isEdit ? 'PUT' : 'POST',
    token: adminToken,
    body: payload
   });
   officialForm.reset();
   await loadAdminData();
   await refreshPublicLibrary();
   status($('adhkarAdminStatus'), isEdit ? 'تم تحديث الذكر في المكتبة العامة.' : 'تمت إضافة الذكر إلى المكتبة العامة.');
  } catch (error) {
   status($('adhkarAdminStatus'), error.message);
  } finally {
   submit.disabled = false;
  }
 });

 $('adhkarOfficialList')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || !adminToken) return;
  const item = officialEntries.find(entry => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === 'edit') {
   for (const key of ['id','group','title','text','count','occasion','source','sourceUrl','kind']) {
    const field = officialForm.elements.namedItem(key);
    if (field) field.value = item[key] == null ? '' : String(item[key]);
   }
   officialForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
   return;
  }
  if (button.dataset.action === 'delete') {
   if (!window.confirm('حذف هذا الذكر من المكتبة العامة لدى جميع الزوار؟')) return;
   button.disabled = true;
   try {
    await api('/v1/admin/adhkar/' + encodeURIComponent(item.id), { method: 'DELETE', token: adminToken });
    await loadAdminData();
    await refreshPublicLibrary();
    status($('adhkarAdminStatus'), 'تم حذف الذكر من المكتبة العامة.');
   } catch (error) {
    status($('adhkarAdminStatus'), error.message);
   } finally {
    button.disabled = false;
   }
  }
 });

 refreshPublicLibrary();
   status($('adhkarAdminStatus'), action === 'approve'
    ? 'تم الاعتماد والنشر دون إظهار هوية صاحب الاقتراح.'
    : 'تم رفض الاقتراح وحذفه من صندوق المراجعة.');
  } catch (error) {
   status($('adhkarAdminStatus'), error.message);
  } finally {
   button.disabled = false;
  }
 });

 refreshPublicLibrary();
})();
