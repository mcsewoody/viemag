/* VIEMAG Admin — generic table editor. Vanilla JS, no build step,
   matching the rest of this repo's front-end style. */
(function () {
  'use strict';

  var CFG = window.VIEMAG_ADMIN_CONFIG;
  var SCHEMA = window.VIEMAG_SCHEMA;
  var TABLE_ORDER = window.VIEMAG_TABLE_ORDER;
  var I18N = window.VIEMAG_ADMIN_I18N;
  var LANGS = window.VIEMAG_ADMIN_LANGS;
  var FIELD_I18N = window.VIEMAG_FIELD_I18N || {};
  var OPTION_I18N = window.VIEMAG_OPTION_I18N || {};

  /* Admin panel version, shown after the brand label top-left (e.g. "VIEMAG
     後台管理 v1.01"). Bump by 0.01 on every change shipped to /admin — this
     is the only place to edit; showApp() reads it on every render/lang switch. */
  var ADMIN_VERSION = '1.14';

  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

  /* The account panel is not a Postgres table, so it rides in view.table as a
     sentinel that can never collide with a real table name. */
  var ACCOUNTS_VIEW = '__accounts';
  var MIN_PASSWORD = 10; // must match MIN_PASSWORD in supabase/functions/manage-admins

  var state = {
    lang: localStorage.getItem('viemag-admin-lang') || 'en',
    session: null,
    view: { table: TABLE_ORDER[0], mode: 'list', id: null },
    relationCache: {},
    myRole: 'editor', // re-read from admin_users on every showApp(); never trusted for enforcement
    formDirty: false, // set by any input in the open form; gates the "leave anyway?" prompt
  };

  /* Tables that actually feed js/data.js (see supabase/functions/export-site-data).
     Saving/deleting a row in one of these triggers a re-export + GitHub commit.
     test_reports and guides joined this list on 2026-07-29 when they were wired
     to the product pages and the Insights section — without that, editing an
     article would save to Postgres and never reach the site, which is exactly
     the "I saved it but nothing happened" trap. */
  var EXPORT_TRIGGER_TABLES = ['products', 'categories', 'scenarios', 'faq', 'test_reports', 'guides'];

  function callExportFunction() {
    /* Raw fetch with keepalive:true instead of sb.functions.invoke(), which
       does NOT set keepalive — without it, closing the tab or navigating
       away right after Save can cancel the in-flight request before the
       export ever runs, even though the DB save itself already succeeded.
       keepalive lets the browser finish sending it after the page unloads
       (subject to the ~64KB keepalive body-size limit, fine for this — the
       request body here is empty). */
    return sb.auth.getSession().then(function (sessionRes) {
      var token = (sessionRes.data.session && sessionRes.data.session.access_token) || CFG.supabaseAnonKey;
      return fetch(CFG.supabaseUrl + '/functions/v1/export-site-data', {
        method: 'POST',
        keepalive: true,
        headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + token },
      }).then(function (res) {
        return res.json().then(function (data) { return { httpOk: res.ok, data: data }; });
      });
    });
  }

  /* Calls translate-text with the CURRENT text of one language cell and gets
     the other three back. No keepalive here (unlike callExportFunction) — the
     operator is actively waiting on this result to fill the form, not
     navigating away, so there is nothing to protect against a page unload. */
  function callTranslateFunction(text, source) {
    return sb.auth.getSession().then(function (sessionRes) {
      var token = (sessionRes.data.session && sessionRes.data.session.access_token) || CFG.supabaseAnonKey;
      return fetch(CFG.supabaseUrl + '/functions/v1/translate-text', {
        method: 'POST',
        headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, source: source }),
      }).then(function (res) {
        return res.json().then(function (data) { return { httpOk: res.ok, data: data }; });
      });
    });
  }

  function triggerExportIfNeeded(tableName, statusEl) {
    if (EXPORT_TRIGGER_TABLES.indexOf(tableName) === -1) return;
    callExportFunction().then(function (result) {
      if (!statusEl) return;
      /* SET, never append. statusEl is the topbar's persistent syncStatus, which
         is never cleared between saves — the previous code used += so a second
         save in the same session left the FIRST save's "已同步到網站" message
         sitting there and appended a second copy after it (" · 已同步到網站... ·
         已同步到網站..."), compounding with every subsequent save. This is
         unrelated to i18n: the string already goes through t() and is correct in
         all four admin languages — the bug was purely the += accumulating raw
         text objects, regardless of which language it was in. */
      if (!result.httpOk) { statusEl.textContent = t('exportFailed') + (result.data.error || 'HTTP error'); return; }
      statusEl.textContent = result.data.committed ? t('exported') : '';
    }).catch(function (err) {
      if (statusEl) statusEl.textContent = t('exportFailed') + err.message;
    });
  }

  function t(key) {
    var dict = I18N[state.lang] || I18N.en;
    return dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
  }
  /* t() with {placeholder} substitution. Values are substituted into the raw
     string, so every caller must esc() the result before inserting it as HTML. */
  function tf(key, vars) {
    return String(t(key)).replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] !== undefined ? String(vars[k]) : m;
    });
  }
  function tTable(name) {
    var dict = I18N[state.lang] || I18N.en;
    return (dict.tables && dict.tables[name]) || name;
  }
  /* hero_image_url holds two shapes: an absolute Supabase Storage URL (anything
     uploaded through this admin) and, for content migrated from Notion, a
     repo-relative path like "assets/products/X.png". A relative path would
     resolve against /admin/ and 404, so send those to the site root. */
  function mediaUrl(v) {
    if (!v) return null;
    if (/^(https?:)?\/\//.test(v) || v.charAt(0) === '/') return v;
    return '../' + v.replace(/^\.?\//, '');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* English lives on the field itself (f.desc, the master copy in schema.js).
     Other languages are a translation OVERLAY in field-i18n.js, keyed by
     table + field name; a language missing a given key falls back to the
     English desc rather than showing nothing. */
  function fieldDesc(table, f) {
    if (state.lang !== 'en') {
      var dict = FIELD_I18N[state.lang] && FIELD_I18N[state.lang][table];
      if (dict && dict[f.name]) return dict[f.name];
    }
    return f.desc || '';
  }

  /* Same overlay-with-fallback discipline as fieldDesc(), one level deeper: a
     SELECT/MULTISELECT's option VALUES (the literal strings stored in
     Postgres, e.g. 'Draft', 'Vent', 'bestseller') had no translation layer at
     all until 2026-08-06 — renderFieldInput showed esc(o) directly, so every
     dropdown and checkbox list was English regardless of admin UI language
     even though labels and descriptions were fully translated. option-i18n.js
     supplies the overlay; falling back to the raw value here is exactly the
     English case, since the raw stored value already IS the English label. */
  function optionLabel(table, fieldName, value) {
    var dict = OPTION_I18N[state.lang] && OPTION_I18N[state.lang][table] && OPTION_I18N[state.lang][table][fieldName];
    return (dict && dict[value]) || value;
  }

  /* Escape FIRST, then apply a fixed, safe set of markers — same discipline as
     the public site's richText(): this text is staff-authored prose, but
     "trusted" is not a reason to hand a stray `<` or `>` a way into the DOM.
     Backtick spans are pulled out to an ASCII placeholder before **bold** runs,
     and restored after, so a literal example like `**bold**` (used in the
     guides.body_* description to show the syntax it supports) renders as code,
     not as actual bold. */
  function fieldDescHtml(table, f) {
    var raw = fieldDesc(table, f);
    if (!raw) return '';
    var codes = [];
    var withCodes = esc(raw).replace(/`([^`]+)`/g, function (m, inner) {
      return '@@CODE' + (codes.push(inner) - 1) + '@@';
    });
    var withBold = withCodes.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return withBold.replace(/@@CODE(\d+)@@/g, function (m, i) {
      return '<code>' + codes[+i] + '</code>';
    });
  }

  /* ---------------- language pickers ---------------- */
  function buildLangPicker(select) {
    select.innerHTML = LANGS.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === state.lang ? ' selected' : '') + '>' + esc(l.label) + '</option>';
    }).join('');
    select.onchange = function () {
      state.lang = select.value;
      localStorage.setItem('viemag-admin-lang', state.lang);
      renderAll();
    };
  }

  /* ---------------- auth ---------------- */
  function showLogin(notice) {
    document.getElementById('app').style.display = 'none';
    var el = document.getElementById('loginScreen');
    el.style.display = 'flex';
    var errEl = document.getElementById('loginError');
    errEl.className = notice ? 'login-error info' : 'login-error';
    errEl.textContent = notice || '';
    document.getElementById('loginTitle').textContent = t('loginTitle');
    document.getElementById('loginEmailLabel').textContent = t('email');
    document.getElementById('loginPasswordLabel').textContent = t('password');
    document.getElementById('loginSubmit').textContent = t('signIn');
    buildLangPicker(document.getElementById('loginLangPicker'));
  }

  function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'grid';
    document.getElementById('brandLabel').textContent = t('appTitle') + ' v' + ADMIN_VERSION;
    document.getElementById('userEmail').textContent = state.session.user.email;
    document.getElementById('signOutBtn').textContent = t('signOut');
    document.getElementById('syncNowBtn').textContent = t('syncNow');
    buildLangPicker(document.getElementById('langPicker'));
    renderSidebar();
    renderContent();
    /* Refresh the cached role on every render of the shell, so a promotion or
       demotion made by someone else takes effect on the next navigation rather
       than only after a re-login. This only decides what the UI OFFERS — the
       manage-admins function re-checks the role server-side on every call. */
    var before = state.myRole;
    fetchMyRole().then(function (role) {
      if (role === before) return;
      if (state.view.table === ACCOUNTS_VIEW) renderContent();
    });
  }

  /* Always queries rather than reading state.myRole, because showApp() fetches
     the role AFTER its first renderContent(): a form opened on that first paint
     would otherwise be built with the 'editor' default and show an owner the
     locked panel on their own data. One indexed row per form open.
     This governs the UI only. Enforcement is the RLS policy on
     product_development (supabase/migrations/20260730120000). */
  function fetchMyRole() {
    return sb.from('admin_users').select('role').eq('user_id', state.session.user.id).maybeSingle()
      .then(function (res) {
        state.myRole = (res.data && res.data.role) === 'owner' ? 'owner' : 'editor';
        return state.myRole;
      });
  }

  document.getElementById('syncNowBtn').addEventListener('click', function () {
    var btn = document.getElementById('syncNowBtn');
    var statusEl = document.getElementById('syncStatus');
    btn.disabled = true;
    statusEl.className = 'sync-status';
    statusEl.textContent = t('syncing');
    callExportFunction().then(function (result) {
      btn.disabled = false;
      if (!result.httpOk) { statusEl.className = 'sync-status error'; statusEl.textContent = t('exportFailed') + (result.data.error || 'HTTP error'); return; }
      statusEl.textContent = result.data.committed ? t('exported') : t('exportNoChange');
    }).catch(function (err) {
      btn.disabled = false;
      statusEl.className = 'sync-status error';
      statusEl.textContent = t('exportFailed') + err.message;
    });
  });

  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginError');
    errEl.textContent = '';
    sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) { errEl.textContent = t('loginError'); return; }
      state.session = res.data.session;
      showApp();
    });
  });

  document.getElementById('signOutBtn').addEventListener('click', function () {
    sb.auth.signOut().then(function () {
      state.session = null;
      showLogin();
    });
  });

  /* ---------------- sidebar / navigation ---------------- */
  function renderSidebar() {
    var nav = document.getElementById('sidebarNav');
    nav.innerHTML = TABLE_ORDER.map(function (name) {
      var active = state.view.table === name ? ' class="active"' : '';
      return '<a' + active + ' data-table="' + name + '">' + esc(tTable(name)) + '</a>';
    }).join('')
      + '<div class="nav-sep"></div>'
      + '<a' + (state.view.table === ACCOUNTS_VIEW ? ' class="active"' : '')
      + ' data-table="' + ACCOUNTS_VIEW + '">' + esc(t('accounts')) + '</a>';
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () {
        state.view = { table: a.dataset.table, mode: 'list', id: null };
        renderAll();
      });
    });
  }

  function renderAll() {
    if (!state.session) { showLogin(); return; }
    showApp();
  }

  function renderContent() {
    var root = document.getElementById('content');
    root.innerHTML = '<p>' + esc(t('loading')) + '</p>';
    if (state.view.table === ACCOUNTS_VIEW) renderAccounts(root);
    else if (state.view.mode === 'list') renderList(root);
    else renderForm(root);
  }

  /* ---------------- accounts panel ----------------
     Two halves with deliberately different trust levels:
       - "My account": changes the caller's OWN password through their own
         session (supabase.auth.updateUser). No elevated key involved.
       - "Staff accounts": every mutation is a POST to the manage-admins Edge
         Function, which is the only holder of the service_role key. The
         buttons below are convenience, not security — hiding them from an
         editor does not protect anything; the function's own owner check does.
  */
  function callManageAdmins(payload) {
    return sb.auth.getSession().then(function (sessionRes) {
      var session = sessionRes.data.session;
      if (!session) throw new Error('session expired');
      return fetch(CFG.supabaseUrl + '/functions/v1/manage-admins', {
        method: 'POST',
        headers: {
          apikey: CFG.supabaseAnonKey,
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function fmtDate(iso) {
    if (!iso) return t('never');
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
  }

  /* Password rules, mirrored from passwordProblems() in
     supabase/functions/manage-admins/index.ts. This copy exists to give live
     feedback while typing; the function's copy is the one that actually decides. */
  var PW_RULES = [
    { key: 'too_short',      label: 'pwRuleLength',   test: function (v) { return v.length >= MIN_PASSWORD; } },
    { key: 'no_lower',       label: 'pwRuleLower',    test: function (v) { return /[a-z]/.test(v); } },
    { key: 'no_upper',       label: 'pwRuleUpper',    test: function (v) { return /[A-Z]/.test(v); } },
    { key: 'no_digit',       label: 'pwRuleDigit',    test: function (v) { return /[0-9]/.test(v); } },
    { key: 'whitespace',     label: 'pwRuleNoSpace',  test: function (v) { return !/\s/.test(v); } },
    { key: 'contains_email', label: 'pwRuleNotEmail', test: function (v, email) {
        var local = String(email || '').split('@')[0].toLowerCase();
        return !(local.length >= 4 && v.toLowerCase().indexOf(local) !== -1);
      } },
  ];
  function pwProblems(v, email) {
    return PW_RULES.filter(function (r) { return !r.test(v, email); }).map(function (r) { return r.key; });
  }
  /* The function reports failures as "weak_password:too_short,too_simple" so the
     operator sees which rule failed rather than a bare rejection. */
  function describePwError(msg) {
    var m = /^weak_password:(.*)$/.exec(msg);
    if (!m) return msg;
    return t('pwWeak') + ' ' + m[1].split(',').map(function (key) {
      var rule = PW_RULES.filter(function (r) { return r.key === key; })[0];
      return rule ? tf(rule.label, { n: MIN_PASSWORD }) : key;
    }).join('; ');
  }

  function callManageAdmins(payload) {
    return sb.auth.getSession().then(function (sessionRes) {
      var session = sessionRes.data.session;
      if (!session) throw new Error('session expired');
      return fetch(CFG.supabaseUrl + '/functions/v1/manage-admins', {
        method: 'POST',
        headers: {
          apikey: CFG.supabaseAnonKey,
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function fmtDate(iso) {
    if (!iso) return t('never');
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
  }

  /* ---------------- accounts: list ---------------- */
  function renderAccounts(root) {
    if (state.view.mode === 'edit') renderAccountForm(root);
    else renderAccountList(root);
  }

  function renderAccountList(root) {
    var isOwner = state.myRole === 'owner';
    var myId = state.session.user.id;

    callManageAdmins({ action: 'list' }).then(function (data) {
      var users = data.users || [];
      /* Kept so the edit form can open instantly from the row the operator
         clicked, instead of making them wait for a second round-trip. */
      state.accountRoster = users;

      var html = '';
      html += '<h2>' + esc(t('accounts')) + '</h2>';
      html += '<p class="panel-note">' + esc(t('accountsNote')) + '</p>';
      if (!isOwner) html += '<p class="panel-note">' + esc(t('editorCannotManage')) + '</p>';
      html += '<div class="toolbar">';
      html += '<input type="search" id="listSearch" placeholder="' + esc(t('search')) + '">';
      if (isOwner) html += '<button class="btn btn-primary" id="addNewBtn">+ ' + esc(t('addAccount')) + '</button>';
      html += '</div>';

      html += '<table class="grid"><thead><tr>';
      html += '<th>' + esc(t('email')) + '</th><th>' + esc(t('colName')) + '</th>';
      html += '<th>' + esc(t('colRole')) + '</th><th>' + esc(t('colLastSignIn')) + '</th>';
      html += '<th></th></tr></thead><tbody id="listBody">';
      users.forEach(function (u) {
        var self = u.user_id === myId;
        html += '<tr data-uid="' + esc(u.user_id) + '">';
        html += '<td>' + esc(u.email) + (self ? '<span class="hint">' + esc(t('youTag')) + '</span>' : '') + '</td>';
        html += '<td>' + esc(u.display_name || '—') + '</td>';
        html += '<td><span class="badge-status">' + esc(u.role === 'owner' ? t('roleOwner') : t('roleEditor')) + '</span></td>';
        html += '<td>' + esc(fmtDate(u.last_sign_in_at)) + '</td>';
        html += '<td class="row-actions">';
        if (isOwner) {
          html += '<button class="btn edit-btn">' + esc(t('edit')) + '</button>';
          /* Deleting yourself is the lock-out case the function refuses, so the
             button is absent rather than present-and-failing. */
          if (!self) html += '<button class="btn btn-danger del-btn">' + esc(t('delete')) + '</button>';
        }
        html += '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<p class="row-count">' + t('rowCount')(users.length) + '</p>';
      html += '<span class="save-status" id="rosterStatus"></span>';
      root.innerHTML = html;

      var status = document.getElementById('rosterStatus');
      var addBtn = document.getElementById('addNewBtn');
      if (addBtn) addBtn.addEventListener('click', function () {
        state.view = { table: ACCOUNTS_VIEW, mode: 'edit', id: null };
        renderContent();
      });

      var search = document.getElementById('listSearch');
      search.addEventListener('input', function () {
        var q = search.value.toLowerCase();
        Array.prototype.forEach.call(document.querySelectorAll('#listBody tr'), function (tr) {
          tr.style.display = tr.textContent.toLowerCase().indexOf(q) === -1 ? 'none' : '';
        });
      });

      Array.prototype.forEach.call(document.querySelectorAll('#listBody tr'), function (tr) {
        var uid = tr.dataset.uid;
        var u = users.filter(function (x) { return x.user_id === uid; })[0];
        var editBtn = tr.querySelector('.edit-btn');
        var delBtn = tr.querySelector('.del-btn');
        if (editBtn) editBtn.addEventListener('click', function () {
          state.view = { table: ACCOUNTS_VIEW, mode: 'edit', id: uid };
          renderContent();
        });
        if (delBtn) delBtn.addEventListener('click', function () {
          if (!window.confirm(tf('confirmDeleteAccount', { email: u.email }))) return;
          delBtn.disabled = true;
          status.className = 'save-status';
          callManageAdmins({ action: 'delete', user_id: uid }).then(function () {
            renderContent();
          }).catch(function (err) {
            delBtn.disabled = false;
            status.className = 'save-status error';
            status.textContent = t('accountActionFailed') + err.message;
          });
        });
      });
    }).catch(function (err) {
      root.innerHTML = '<h2>' + esc(t('accounts')) + '</h2>'
        + '<p class="save-status error">' + esc(t('loadFailed') + err.message) + '</p>';
    });
  }

  /* ---------------- accounts: edit form ---------------- */
  function renderAccountForm(root) {
    var isNew = !state.view.id;
    var u = isNew ? null : (state.accountRoster || []).filter(function (x) {
      return x.user_id === state.view.id;
    })[0];
    if (!isNew && !u) { // roster cache lost (e.g. language switch) — go back and refetch
      state.view = { table: ACCOUNTS_VIEW, mode: 'list', id: null };
      renderContent();
      return;
    }
    var isSelf = !isNew && u.user_id === state.session.user.id;

    var html = '';
    html += '<h2>' + esc(isNew ? t('addAccount') : t('editAccount')) + '</h2>';
    html += '<form class="form-card" id="accForm" autocomplete="off"><div class="form-grid">';

    html += '<div class="field wide"><label for="accEmail">' + esc(t('email')) + '</label>';
    if (isNew) {
      html += '<input id="accEmail" type="email" required>';
    } else {
      /* Changing a login email is a different operation from editing a profile
         (it needs a confirmation flow), so it is not offered here. */
      html += '<input id="accEmail" type="email" value="' + esc(u.email) + '" disabled>';
      html += '<span class="hint">' + esc(t('emailReadOnlyNote')) + '</span>';
    }
    html += '</div>';

    html += '<div class="field"><label for="accName">' + esc(t('displayName'))
         + ' <span class="hint">(' + esc(t('optional')) + ')</span></label>';
    html += '<input id="accName" type="text" value="' + esc((u && u.display_name) || '') + '"></div>';

    html += '<div class="field"><label for="accRole">' + esc(t('colRole')) + '</label>';
    var role = isNew ? 'editor' : u.role;
    html += '<select id="accRole"' + (isSelf ? ' disabled' : '') + '>';
    html += '<option value="editor"' + (role === 'editor' ? ' selected' : '') + '>' + esc(t('roleEditor')) + '</option>';
    html += '<option value="owner"' + (role === 'owner' ? ' selected' : '') + '>' + esc(t('roleOwner')) + '</option>';
    html += '</select>';
    if (isSelf) html += '<span class="hint">' + esc(t('cannotEditOwnRole')) + '</span>';
    html += '</div>';

    html += '<div class="field wide"><label for="accPw">'
         + esc(isNew ? t('initialPassword') : t('newPassword'))
         + (isNew ? '' : ' <span class="hint">(' + esc(t('leaveBlankToKeep')) + ')</span>') + '</label>';
    /* type=text on purpose: the owner is typing a password FOR someone else and
       has to read it back to them, so masking it only invites typos. */
    html += '<input id="accPw" type="text" autocomplete="off"' + (isNew ? ' required' : '') + '>';
    html += '<ul class="pw-rules" id="pwRules">';
    PW_RULES.forEach(function (r) {
      html += '<li data-rule="' + r.key + '">' + esc(tf(r.label, { n: MIN_PASSWORD })) + '</li>';
    });
    html += '</ul></div>';

    html += '</div><div class="form-actions">';
    html += '<button type="submit" class="btn btn-primary" id="accSaveBtn">' + esc(isNew ? t('create') : t('save')) + '</button>';
    html += '<button type="button" class="btn" id="accCancelBtn">' + esc(t('cancel')) + '</button>';
    if (!isNew && !isSelf) html += '<button type="button" class="btn btn-danger" id="accDelBtn">' + esc(t('delete')) + '</button>';
    html += '<span class="save-status" id="accStatus"></span>';
    html += '</div></form>';
    root.innerHTML = html;

    var pwInput = document.getElementById('accPw');
    var emailInput = document.getElementById('accEmail');
    var status = document.getElementById('accStatus');
    var saveBtn = document.getElementById('accSaveBtn');

    function refreshRules() {
      var v = pwInput.value;
      var email = isNew ? emailInput.value : u.email;
      /* Blank on an existing account means "keep the current password", so the
         rules are shown as neutral rather than failing. */
      var neutral = !isNew && v === '';
      var bad = neutral ? [] : pwProblems(v, email);
      Array.prototype.forEach.call(document.querySelectorAll('#pwRules li'), function (li) {
        li.className = neutral ? '' : (bad.indexOf(li.dataset.rule) === -1 ? 'ok' : 'bad');
      });
    }
    pwInput.addEventListener('input', refreshRules);
    if (isNew) emailInput.addEventListener('input', refreshRules);
    refreshRules();

    document.getElementById('accCancelBtn').addEventListener('click', function () {
      state.view = { table: ACCOUNTS_VIEW, mode: 'list', id: null };
      renderContent();
    });

    var delBtn = document.getElementById('accDelBtn');
    if (delBtn) delBtn.addEventListener('click', function () {
      if (!window.confirm(tf('confirmDeleteAccount', { email: u.email }))) return;
      delBtn.disabled = true;
      callManageAdmins({ action: 'delete', user_id: u.user_id }).then(function () {
        state.view = { table: ACCOUNTS_VIEW, mode: 'list', id: null };
        renderContent();
      }).catch(function (err) {
        delBtn.disabled = false;
        status.className = 'save-status error';
        status.textContent = t('accountActionFailed') + err.message;
      });
    });

    document.getElementById('accForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = pwInput.value;
      var email = isNew ? emailInput.value.trim() : u.email;
      status.className = 'save-status';
      status.textContent = '';

      if (isNew || pw !== '') {
        var bad = pwProblems(pw, email);
        if (bad.length) {
          status.className = 'save-status error';
          status.textContent = describePwError('weak_password:' + bad.join(','));
          return;
        }
      }

      saveBtn.disabled = true;
      var payload = isNew
        ? { action: 'invite', email: email, password: pw,
            display_name: document.getElementById('accName').value.trim() || null,
            role: document.getElementById('accRole').value }
        : { action: 'update', user_id: u.user_id,
            display_name: document.getElementById('accName').value.trim() || null,
            role: document.getElementById('accRole').value,
            password: pw };

      callManageAdmins(payload).then(function () {
        /* Supabase revokes every session when a user's password changes, so once
           an owner resets their OWN password the token in this tab is already
           dead — the next action would fail with a bare 401. Verified against the
           live project. Log out deliberately and say why, instead. */
        if (!isNew && isSelf && pw !== '') {
          return sb.auth.signOut().then(function () {
            state.session = null;
            state.accountRoster = null;
            showLogin(t('ownPasswordChangedSignInAgain'));
          });
        }
        status.textContent = isNew ? tf('accountCreated', { email: email }) : t('saved');
        setTimeout(function () {
          state.view = { table: ACCOUNTS_VIEW, mode: 'list', id: null };
          renderContent();
        }, 600);
      }).catch(function (err) {
        saveBtn.disabled = false;
        status.className = 'save-status error';
        status.textContent = t('accountActionFailed') + describePwError(err.message);
      });
    });
  }
  /* ---------------- delete confirmation ----------------
     Deleting a row is unrecoverable — there is no trash and no undo — so it
     asks for the account password, not just an OK.

     What this actually buys: it stops an unattended, already-logged-in session
     from being used to wipe records, and it makes the action deliberate. It is
     NOT the permission boundary. The boundary is the RLS policy that only
     grants DELETE to owners; this dialog runs in the browser and anyone who
     can edit the page can skip it. Both layers exist because they stop
     different things — the policy stops the wrong person, the password stops
     the right person acting carelessly.

     Verification is a signInWithPassword() against the session's own email:
     Supabase has no "check this password" endpoint, and re-authenticating is
     the standard substitute. It refreshes the tokens for this tab, which is
     harmless here — onAuthStateChange only stores the new session and does not
     re-render, so the open dialog survives it. */
  function confirmWithPassword(opts) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      var h = '';
      h += '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="pwTitle">';
      h += '<h3 id="pwTitle">' + esc(t('confirmDeleteTitle')) + '</h3>';
      h += '<p class="modal-target">' + esc(opts.what || '') + '</p>';
      h += '<p>' + esc(t('confirmDelete')) + '</p>';
      if (opts.warn) h += '<p class="modal-warn">' + esc(opts.warn) + '</p>';
      h += '<label for="pwInput">' + esc(t('reenterPassword')) + '</label>';
      // type=password, and autocomplete off: this is a re-auth check, not a login,
      // and offering to save it here would be nonsense.
      h += '<input type="password" id="pwInput" autocomplete="current-password">';
      h += '<p class="modal-error" id="pwError" hidden></p>';
      h += '<div class="modal-actions">';
      h += '<button type="button" class="btn" id="pwCancel">' + esc(t('cancel')) + '</button>';
      h += '<button type="button" class="btn btn-danger" id="pwOk">' + esc(t('confirmDeleteBtn')) + '</button>';
      h += '</div></div>';
      wrap.innerHTML = h;
      document.body.appendChild(wrap);

      var input = wrap.querySelector('#pwInput');
      var okBtn = wrap.querySelector('#pwOk');
      var errEl = wrap.querySelector('#pwError');
      input.focus();

      function close(result) { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(result); }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter' && document.activeElement === input) submit();
      }
      function fail(msg) {
        errEl.textContent = msg;
        errEl.hidden = false;
        okBtn.disabled = false;
        input.value = '';
        input.focus();
      }
      function submit() {
        var pw = input.value;
        if (!pw) { fail(t('passwordRequired')); return; }
        okBtn.disabled = true;
        errEl.hidden = true;
        sb.auth.signInWithPassword({ email: state.session.user.email, password: pw })
          .then(function (res) {
            if (res.error) {
              /* Only a credential rejection means "wrong password". Rate
                 limiting and network failures also land here, and reporting
                 those as a bad password sends the operator off to reset a
                 password that was never the problem. */
              var m = res.error.message || '';
              fail(/invalid login credentials/i.test(m) ? t('passwordWrong') : m);
              return;
            }
            close(true);
          })
          .catch(function (e) { fail((e && e.message) || t('passwordWrong')); });
      }
      okBtn.addEventListener('click', submit);
      wrap.querySelector('#pwCancel').addEventListener('click', function () { close(false); });
      // Click the backdrop (not the panel) to cancel.
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(false); });
      document.addEventListener('keydown', onKey);
    });
  }

  /* ---------------- list view ---------------- */
  function renderList(root) {
    var tableName = state.view.table;
    var def = SCHEMA[tableName];
    var orderCol = def.order || def.title;
    /* Some list columns do not live on the table being listed. products shows
       sales_cost_usd, which is a column of the product_sales_cost view. Fetch
       each extra source once and index it by its key, rather than issuing one
       request per row.
       A failed extra must NOT take the list down with it: the rows themselves
       are the point, and an extra column that renders blank is a far better
       outcome than an empty screen. So these resolve to {} on error. */
    var extras = def.listExtras || [];
    var extraPromise = Promise.all(extras.map(function (x) {
      return sb.from(x.table).select([x.key].concat(x.cols).join(',')).then(function (r) {
        var byKey = {};
        if (!r.error) (r.data || []).forEach(function (row) { byKey[row[x.key]] = row; });
        return byKey;
      });
    }));
    /* Ask the server for the role rather than reading state.myRole: on the very
       first paint after login the cached value is still the 'editor' default,
       and an owner would get a list with no delete buttons until something
       happened to re-render it. renderForm() resolves the same race the same
       way. */
    Promise.all([
      sb.from(tableName).select('*').order(orderCol, { ascending: true }),
      extraPromise,
      fetchMyRole(),
    ]).then(function (both) {
      var res = both[0];
      var extraMaps = both[1];
      var canDelete = both[2] === 'owner';
      if (res.error) { root.innerHTML = '<p class="save-status error">' + esc(res.error.message) + '</p>'; return; }
      var rows = res.data || [];
      // Fold the extra sources onto each row so the column loop below stays uniform.
      rows.forEach(function (r) {
        extras.forEach(function (x, i) {
          var hit = extraMaps[i][r.id];
          x.cols.forEach(function (c) { r[c] = hit ? hit[c] : null; });
        });
      });
      var statusField = def.fields.find(function (f) { return f.name === 'status'; });
      var html = '';
      html += '<h2>' + esc(tTable(tableName)) + '</h2>';
      /* Per-table explanation of what this table IS. Three kinds of table exist
         and they behave completely differently; without saying so, an editor
         reasonably assumes everything they type appears on the site.
           (no note) = catalogue content, published on save
           inbox     = filled by a public form, triaged here, never published
           notWired  = the editor exists but nothing consumes it yet */
      if (def.note) html += '<p class="panel-note">' + esc(t(def.note)) + '</p>';
      html += '<div class="toolbar">';
      html += '<input type="search" id="listSearch" placeholder="' + esc(t('search')) + '">';
      html += '<button class="btn btn-primary" id="addNewBtn">+ ' + esc(t('addNew')) + '</button>';
      html += '</div>';
      /* Status filter (products only, via def.statusFilter). products.status now
         also marks pipeline items — 'Development' means the product does not
         exist yet — so this list mixes shipped SKUs with projects and needs
         filtering. Counts are shown for EVERY option, including the zeroes: "0"
         is information ("nothing is in review"), and an option that vanishes
         when empty is an option nobody remembers exists.
         Default is All, deliberately. Filtering to Published by default would
         hide exactly the rows someone is about to add. */
      if (statusField && def.statusFilter) {
        var counts = {};
        rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
        html += '<div class="status-filter">';
        html += '<button class="chip active" data-status="">' + esc(t('statusAll')) + ' ' + rows.length + '</button>';
        statusField.options.forEach(function (o) {
          // data-status stays the raw value (that's what applyFilters() compares
          // against); only the visible label is translated.
          html += '<button class="chip" data-status="' + esc(o) + '">' + esc(optionLabel(tableName, statusField.name, o)) + ' ' + (counts[o] || 0) + '</button>';
        });
        html += '</div>';
      }
      if (!rows.length) {
        html += '<div class="empty-state">' + esc(t('noRecords')) + '</div>';
      } else {
        var listCols = def.listCols || [];
        /* Which of those columns are money, so the cell can be right-aligned
           and formatted to two decimals. A cost of null means "nothing entered
           yet", which must read as "—" and never as 0.00 — a zero cost is a
           claim about the product, an em dash is an admission about the data. */
        var moneyCols = {};
        extras.forEach(function (x) { if (x.money) x.cols.forEach(function (c) { moneyCols[c] = true; }); });
        function cellText(c, v) {
          if (!moneyCols[c]) return v;
          if (v == null || v === '') return '—';
          return Number(v).toFixed(2);
        }
        html += '<table class="grid"><thead><tr>';
        if (def.thumb || def.thumbFallback) html += '<th class="thumb-col"></th>';
        html += '<th>' + esc(def.title) + '</th>';
        listCols.forEach(function (c) { html += '<th>' + esc(c) + '</th>'; });
        if (statusField) html += '<th>status</th>';
        html += '<th></th></tr></thead><tbody id="listBody">';
        rows.forEach(function (r) {
          html += '<tr data-id="' + esc(r.id) + '" data-status="' + esc(r.status || '') + '">';
          if (def.thumb || def.thumbFallback) {
            var img = mediaUrl(def.thumb ? r[def.thumb] : null);
            var fb = def.thumbFallback ? r[def.thumbFallback] : null;
            html += '<td class="thumb-col">';
            if (img) {
              html += '<img class="row-thumb" src="' + esc(img) + '" alt="" loading="lazy">';
            } else if (fb) {
              // No photo uploaded yet — show which front-end illustration this row uses.
              html += '<span class="row-thumb row-thumb-ph" title="' + esc(t('noPhotoUsesArt')) + '">' + esc(fb) + '</span>';
            } else {
              html += '<span class="row-thumb row-thumb-ph">—</span>';
            }
            html += '</td>';
          }
          html += '<td>' + esc(r[def.title]) + '</td>';
          listCols.forEach(function (c) { html += '<td' + (moneyCols[c] ? ' class="num-col"' : '') + '>' + esc(cellText(c, r[c])) + '</td>'; });
          if (statusField) html += '<td><span class="badge-status">' + esc(r.status ? optionLabel(tableName, statusField.name, r.status) : '—') + '</span></td>';
          html += '<td class="row-actions">';
          html += '<button class="btn edit-btn">' + esc(t('edit')) + '</button>';
          /* Delete is owner-only. Hiding the button is courtesy, not the
             control: the real gate is the RLS policy added in
             20260809*_owner_only_deletes.sql, which rejects an editor's DELETE
             even if they reach past this UI. */
          if (canDelete) html += '<button class="btn btn-danger del-btn">' + esc(t('delete')) + '</button>';
          html += '</td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="row-count">' + t('rowCount')(rows.length) + '</p>';
        /* An editor sees no delete buttons. Say why — a control that silently
           is not there reads as a bug, and the first guess is "the page is
           broken", not "I am not allowed". */
        if (!canDelete) html += '<p class="panel-note">' + esc(t('editorCannotDelete')) + '</p>';
      }
      root.innerHTML = html;

      document.getElementById('addNewBtn').addEventListener('click', function () {
        state.view = { table: tableName, mode: 'edit', id: null };
        renderContent();
      });
      /* Search and the status filter both hide rows, so they share one pass —
         applying them independently would let whichever ran last un-hide rows
         the other had just excluded. */
      var search = document.getElementById('listSearch');
      var activeStatus = '';
      function applyFilters() {
        var q = search.value.toLowerCase();
        Array.prototype.forEach.call(document.querySelectorAll('#listBody tr'), function (tr) {
          var matchesText = tr.textContent.toLowerCase().indexOf(q) !== -1;
          var matchesStatus = !activeStatus || tr.dataset.status === activeStatus;
          tr.style.display = (matchesText && matchesStatus) ? '' : 'none';
        });
      }
      search.addEventListener('input', applyFilters);
      Array.prototype.forEach.call(root.querySelectorAll('.status-filter .chip'), function (btn) {
        btn.addEventListener('click', function () {
          activeStatus = btn.dataset.status;
          Array.prototype.forEach.call(root.querySelectorAll('.status-filter .chip'), function (b) {
            b.classList.toggle('active', b === btn);
          });
          applyFilters();
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll('.edit-btn'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('tr').dataset.id;
          state.view = { table: tableName, mode: 'edit', id: id };
          renderContent();
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll('.del-btn'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('tr').dataset.id;
          /* Deleting a category sets category_id = NULL on every product in it
             (FK is ON DELETE SET NULL), which silently pulls those products off
             the category pages. Say how many will be affected before asking. */
          var preflight = tableName === 'categories'
            ? sb.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id)
                .then(function (r) { return r.count || 0; })
            : Promise.resolve(0);

          preflight.then(function (affected) {
            var warn = affected > 0 ? t('confirmDeleteCategory').replace('{n}', affected) : '';
            var label = btn.closest('tr').children[def.thumb || def.thumbFallback ? 1 : 0].textContent;
            /* Not confirm(): the operator has to type their password, and a
               browser prompt() would render it in clear text. */
            confirmWithPassword({ what: label, warn: warn }).then(function (ok) {
              if (!ok) return;
              sb.from(tableName).delete().eq('id', id).then(function (res) {
                if (res.error) { alert(t('deleteFailed') + res.error.message); return; }
                // Labels/options may have changed — don't serve them from a stale cache.
                state.relationCache = {};
                triggerExportIfNeeded(tableName, document.getElementById('syncStatus'));
                renderContent();
              });
            });
          });
        });
      });
    });
  }

  /* ---------------- edit / create form ----------------
     Every read below REJECTS on error instead of falling back to empty.
     Reason: this form is also what Save writes back. If a read silently
     yielded [] the form would render "nothing selected", and saving would
     then delete the real relations / null the real category — losing data the
     operator never touched, while the UI said "Saved". */
  function must(promise, what) {
    return promise.then(function (res) {
      if (res.error) throw new Error(what + ': ' + res.error.message);
      return res.data;
    });
  }

  function fetchRelationOptions(tableName, labelField) {
    var cacheKey = tableName + ':' + labelField;
    if (state.relationCache[cacheKey]) return Promise.resolve(state.relationCache[cacheKey]);
    return must(sb.from(tableName).select('id,' + labelField).order(labelField), 'load ' + tableName)
      .then(function (data) {
        var opts = (data || []).map(function (r) { return { id: r.id, label: r[labelField] }; });
        // Only cache a successful, non-empty-by-error result.
        state.relationCache[cacheKey] = opts;
        return opts;
      });
  }

  function renderForm(root) {
    var tableName = state.view.table;
    var id = state.view.id;
    var def = SCHEMA[tableName];
    var isNew = !id;

    var rowPromise = isNew
      ? Promise.resolve({})
      : must(sb.from(tableName).select('*').eq('id', id).single(), 'load record');

    var relFields = def.fields.filter(function (f) { return f.type === 'relation' || f.type === 'relation_many'; });
    var relOptionsPromise = Promise.all(relFields.map(function (f) { return fetchRelationOptions(f.table, f.labelField); }))
      .then(function (results) {
        var map = {};
        relFields.forEach(function (f, i) { map[f.name] = results[i]; });
        return map;
      });

    var joinFields = def.fields.filter(function (f) { return f.type === 'relation_many'; });
    var joinValuesPromise = isNew || !joinFields.length
      ? Promise.resolve({})
      : Promise.all(joinFields.map(function (f) {
          return must(sb.from(f.joinTable).select(f.joinTargetKey).eq(f.joinKey, id), 'load ' + f.joinTable)
            .then(function (data) { return (data || []).map(function (r) { return r[f.joinTargetKey]; }); });
        })).then(function (results) {
          var map = {};
          joinFields.forEach(function (f, i) { map[f.name] = results[i]; });
          return map;
        });

    /* The owner-only sub-record behind the third tab, plus the single number
       that is allowed across the wall. The VIEW is read for both roles: an
       editor cannot touch product_development at all, and product_sales_cost is
       how the sales tab still gets a cost basis to compute margin against. */
    var subTab = (def.tabs || []).filter(function (tb) { return tb.table; })[0] || null;
    var rolePromise = subTab ? fetchMyRole() : Promise.resolve(state.myRole);
    var subPromise = rolePromise.then(function (role) {
      if (!subTab || isNew || role !== 'owner') return null;
      return must(sb.from(subTab.table).select('*').eq('product_id', id).maybeSingle(), 'load ' + subTab.table);
    });
    var costPromise = (!subTab || isNew)
      ? Promise.resolve(null)
      : must(sb.from('product_sales_cost').select('sales_cost_usd').eq('product_id', id).maybeSingle(), 'load sales cost')
          .then(function (r) { return r ? r.sales_cost_usd : null; });

    Promise.all([rowPromise, relOptionsPromise, joinValuesPromise, subPromise, costPromise, rolePromise])
      .catch(function (err) {
        // Never render a half-loaded form — it would be a loaded gun for Save.
        root.innerHTML = '<div class="empty-state"><p class="save-status error">' + esc(t('loadFailed') + err.message) + '</p>' +
          '<button class="btn" id="backBtn">&larr; ' + esc(t('backToList')) + '</button></div>';
        var b = document.getElementById('backBtn');
        if (b) b.addEventListener('click', function () {
          state.view = { table: tableName, mode: 'list', id: null };
          renderContent();
        });
        return null;
      }).then(function (results) {
        if (!results) return;
        var ctx = {
          tableName: tableName, def: def, isNew: isNew, subTab: subTab,
          row: results[0], relOptions: results[1], joinValues: results[2],
          subRow: results[3], viewCost: results[4], role: results[5],
        };
        root.innerHTML = buildFormHtml(ctx);
        wireFormEvents(ctx, id, joinFields);
      });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function formActionsHtml() {
    return '<div class="form-actions">'
      + '<button class="btn btn-primary" id="saveBtn">' + esc(t('save')) + '</button>'
      + '<button class="btn" id="cancelBtn">' + esc(t('cancel')) + '</button>'
      + '<span id="saveStatus" class="save-status"></span>'
      + '</div>';
  }

  /* Inner markup of the header thumbnail. Shared by the initial render and by
     the live refresh in wireImageField(), so an upload cannot leave the header
     showing one photo while the field below shows another. */
  function formThumbInner(url, fallback) {
    var img = mediaUrl(url);
    if (img) return '<img src="' + esc(img) + '" alt="" loading="lazy">';
    // No photo yet — name the illustration the site will use, exactly as the list does.
    if (fallback) return '<span class="form-thumb-ph" title="' + esc(t('noPhotoUsesArt')) + '">' + esc(fallback) + '</span>';
    return '<span class="form-thumb-ph">—</span>';
  }

  function buildFormHtml(ctx) {
    var def = ctx.def;
    /* Which record am I editing? The form is long enough that the answer scrolls
       away, and product_id alone ("VB004DSH-SV") does not distinguish two colours
       of the same mount at a glance. Driven by def.thumb, so every table that
       shows a thumbnail in its list shows the same one here — nothing is
       products-specific about wanting to see what you opened.
       Not rendered when adding: there is no record to picture yet. */
    var head = '<h2>' + esc(tTable(ctx.tableName)) + ' — ' + (ctx.isNew ? esc(t('addNew')) : esc(ctx.row[def.title] || '')) + '</h2>';
    /* Title and the back button share a left COLUMN, with the picture beside it.
       The button has to live inside the header rather than after it: a 150-190px
       photo makes the header that tall, and a button below the whole block gets
       pushed down past the bottom of the photo with nothing beside it.
       Title first, picture second in the DOM, matching the order the CSS lays
       them out, so a screen reader and the screen agree. The refresh in
       wireImageField() finds the box by id, not by position. */
    var html = '<div class="form-head"><div class="form-head-main">' + head
      + '<button class="btn" id="backBtn">&larr; ' + esc(t('backToList')) + '</button></div>';
    if (!ctx.isNew && (def.thumb || def.thumbFallback)) {
      html += '<div class="form-thumb" id="formHeadThumb">'
        + formThumbInner(def.thumb ? ctx.row[def.thumb] : null, def.thumbFallback ? ctx.row[def.thumbFallback] : null)
        + '</div>';
    }
    html += '</div>';

    // Every table except products: one flat grid, exactly as before.
    if (!def.tabs) {
      html += '<div class="form-card" style="margin-top:14px"><div class="form-grid">';
      def.fields.forEach(function (f) { html += fieldBlockHtml(ctx, ctx.tableName, ctx.row, f); });
      html += '</div>' + formActionsHtml() + '</div>';
      return html;
    }

    var dict = I18N[state.lang] || I18N.en;
    html += '<div class="tabbar">' + def.tabs.map(function (tb, i) {
      return '<button type="button" class="tab-btn' + (i === 0 ? ' active' : '') + '" data-tab="' + esc(tb.key) + '">'
        + esc((dict.productTabs && dict.productTabs[tb.key]) || tb.key) + '</button>';
    }).join('') + '</div>';

    html += '<div class="form-card">';
    def.tabs.forEach(function (tb, i) {
      /* All panels stay in the DOM; switching tabs only toggles `hidden`. That is
         why a tab switch cannot lose what was typed on another tab — there is no
         re-render to lose it in, so no "unsaved changes" warning is needed here. */
      html += '<div class="tab-panel" data-tab="' + esc(tb.key) + '"' + (i === 0 ? '' : ' hidden') + '>';
      html += '<p class="tab-note' + (tb.ownerOnly ? ' owner' : '') + '">' + esc(t('tabNote' + cap(tb.key))) + '</p>';
      if (tb.ownerOnly && ctx.role !== 'owner') {
        /* No inputs at all — not even disabled ones. Rendering the fields and
           letting RLS hand back nothing would show an editor a page of blank
           boxes, and the first thing they would do is fill them in and press
           Save, losing the typing to a permission error they cannot interpret. */
        html += '<div class="locked-panel">' + esc(t('tabLocked')) + '</div>';
      } else {
        var srcName = tb.table || ctx.tableName;
        var srcRow = tb.table ? (ctx.subRow || {}) : ctx.row;
        tb.groups.forEach(function (g) { html += groupHtml(ctx, srcName, srcRow, g); });
      }
      html += '</div>';
    });
    html += formActionsHtml();
    html += '</div>';
    return html;
  }

  /* Every group folds; the ones marked collapsed in schema.js simply start
     folded. SEO is the only one that does — its eight fields are all optional
     and the site composes a fallback when they are blank, so eight open empty
     boxes only manufacture anxiety. */
  function groupHtml(ctx, srcName, srcRow, g) {
    var dict = I18N[state.lang] || I18N.en;
    var title = (dict.fieldGroups && dict.fieldGroups[g.key]) || g.key;
    var folded = !!g.collapsed;
    var html = '<section class="group' + (folded ? ' collapsed' : '') + '" data-group="' + esc(g.key) + '">';
    html += '<h3 class="group-title"><button type="button" class="group-toggle">' + esc(title)
          + '<span class="group-caret">' + (folded ? '+' : '−') + '</span></button></h3>';
    html += '<div class="form-grid group-body"' + (folded ? ' hidden' : '') + '>';
    var srcDef = SCHEMA[srcName];
    g.fields.forEach(function (entry) {
      if (Array.isArray(entry)) { html += langRowHtml(ctx, srcName, srcRow, entry); return; }
      var f = srcDef.fields.filter(function (x) { return x.name === entry; })[0];
      if (f) html += fieldBlockHtml(ctx, srcName, srcRow, f);
    });
    html += '</div></section>';
    return html;
  }

  /* One row of side-by-side language inputs sharing the first field's
     description. Stacked vertically you had to scroll to notice name_id was
     empty; side by side the gap sits next to its filled siblings, which for a
     five-language site is a working difference, not a cosmetic one.

     Not every four-language row gets a translate button — TRANSLATABLE_PREFIXES
     (in this file, further down) lists the ones that do, rather than turning it
     on site-wide. */
  function langRowHtml(ctx, srcName, srcRow, names) {
    var srcDef = SCHEMA[srcName];
    var fields = names.map(function (n) {
      return srcDef.fields.filter(function (x) { return x.name === n; })[0];
    }).filter(Boolean);
    if (!fields.length) return '';
    var prefix = fields[0].name.replace(/_(en|vi|id|zh)$/, '');
    var canTranslate = TRANSLATABLE_PREFIXES.indexOf(prefix) !== -1;
    var html = '<div class="field wide lang-row" data-field="' + esc(prefix) + '">';
    html += '<label>' + esc(prefix) + '_*</label>';
    var descHtml = fieldDescHtml(srcName, fields[0]);
    if (descHtml) html += '<p class="field-desc">' + descHtml + '</p>';
    html += '<div class="lang-inputs">';
    fields.forEach(function (f) {
      var code = (f.name.match(/_(en|vi|id|zh)$/) || ['', ''])[1].toUpperCase();
      var v = srcRow[f.name];
      html += '<div class="lang-cell' + (v ? '' : ' empty') + '">';
      html += '<div class="lang-cell-head"><span class="lang-tag">' + esc(code) + '</span>';
      if (canTranslate) {
        /* data-target, NOT data-name: collectFormValues() and every other form
           reader select real fields by [data-name="..."]. Giving this button
           the same attribute made it a second match for that selector — and
           because it renders BEFORE the <input> in the DOM, querySelector
           picked the BUTTON (value always '') over the real field on every
           read, including at Save. That would have silently blanked
           name_en/claim_en (and vi/id/zh) on every save. Caught by an actual
           browser round-trip, not the API-only test — worth remembering: a
           feature that only touches the DOM needs a DOM test. */
        html += '<button type="button" class="lang-translate-btn" data-target="' + esc(f.name) + '" data-lang="' + esc(code.toLowerCase()) + '" title="' + esc(t('translateHint')) + '">' + esc(t('translateBtn')) + '</button>';
      }
      html += '</div>';
      /* A four-language row honours schema's `large` flag just like a standalone
         field does. It did not before, so claim_* — where staff write one selling
         point per line, eight of them on P01 — was stuck at the same three rows as
         a one-line field, and you edited the eighth line through a scrollbar. */
      html += f.type === 'textarea'
        ? textareaHtml(f, v, f.large ? 8 : 3)
        : '<input type="text" data-name="' + f.name + '" value="' + esc(v) + '">';
      html += '</div>';
    });
    html += '</div>';
    if (canTranslate) html += '<span class="translate-status" data-translate-status="' + esc(prefix) + '"></span>';
    html += '</div>';
    return html;
  }
  /* Which four-language rows get a translate button. Not every such row: the
     seo_* pair is deliberately excluded because the site already composes those
     from name/claim when they are blank, so translating them solves a problem
     that does not exist.
     accessories joined on 2026-08-11. It is the first MULTI-LINE field here, and
     the Edge Function had to learn to translate line by line before this was
     safe — the line breaks are what make it a list on the product page. */
  var TRANSLATABLE_PREFIXES = ['name', 'claim', 'accessories', 'product_article'];

  function fieldBlockHtml(ctx, srcName, srcRow, f) {
    var value = srcRow[f.name];
    var wideTypes = ['textarea', 'multiselect', 'relation_many', 'image', 'images', 'files_private'];
    var html = '<div class="field' + (wideTypes.indexOf(f.type) !== -1 ? ' wide' : '') + '" data-field="' + f.name + '">';
    html += '<label>' + esc(f.name);
    /* products states the internal/visibility rule once per TAB instead of once
       per field: every field on two of its three tabs is internal, so the
       per-field tag stopped distinguishing anything — a marker that appears on
       everything marks nothing. Other tables are genuinely mixed and keep it. */
    if (f.internal && !ctx.def.tabs) html += ' <span class="internal-tag">' + esc(t('internalField')) + '</span>';
    if (f.type === 'computed' || f.readOnly) html += ' <span class="calc-tag">' + esc(t('calculated')) + '</span>';
    html += '</label>';
    var descHtml = fieldDescHtml(srcName, f);
    if (descHtml) html += '<p class="field-desc">' + descHtml + '</p>';
    html += renderFieldInput(f, value, ctx.relOptions, ctx.joinValues, srcName);
    html += '</div>';
    return html;
  }

  function renderFieldInput(f, value, relOptions, joinValues, tableName) {
    /* Read-only because the DATABASE computes it (a generated column). It gets
       data-readonly-name, never data-name, so collectFormValues cannot pick it up
       and try to write a value Postgres would reject. */
    if (f.readOnly) {
      return '<input type="number" disabled data-readonly-name="' + f.name + '" value="' + (value == null ? '' : esc(value)) + '">';
    }
    switch (f.type) {
      /* Not a column at all — calculated in the browser and stored nowhere, so it
         cannot go stale. refreshComputed() fills these in. */
      case 'computed':
        return '<div class="computed-value muted" data-compute="' + esc(f.compute) + '">—</div>';
      case 'textarea':
        return textareaHtml(f, value);
      case 'number':
        return '<div class="num-wrap"><input type="number" step="any" data-name="' + f.name + '" value="' + (value == null ? '' : esc(value)) + '">'
          + (f.unit ? '<span class="num-unit">' + esc(f.unit) + '</span>' : '') + '</div>';
      case 'date':
        return '<input type="date" data-name="' + f.name + '" value="' + esc(value || '') + '">';
      case 'boolean':
        return '<div class="field checkbox"><input type="checkbox" data-name="' + f.name + '" ' + (value ? 'checked' : '') + '></div>';
      case 'select':
        /* value= is always the raw stored string (required for save/compare);
           only the VISIBLE label is translated, via optionLabel(). */
        return '<select data-name="' + f.name + '"><option value="">—</option>' + f.options.map(function (o) {
          return '<option value="' + esc(o) + '"' + (value === o ? ' selected' : '') + '>' + esc(optionLabel(tableName, f.name, o)) + '</option>';
        }).join('') + '</select>';
      case 'multiselect': {
        var arr = value || [];
        return '<div class="multiselect-options">' + f.options.map(function (o) {
          var checked = arr.indexOf(o) !== -1 ? ' checked' : '';
          return '<label><input type="checkbox" data-name="' + f.name + '" data-multi-value="' + esc(o) + '"' + checked + '>' + esc(optionLabel(tableName, f.name, o)) + '</label>';
        }).join('') + '</div>';
      }
      case 'relation': {
        var opts = relOptions[f.name] || [];
        return '<select data-name="' + f.name + '"><option value="">—</option>' + opts.map(function (o) {
          return '<option value="' + esc(o.id) + '"' + (value === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>';
      }
      case 'relation_many': {
        var mopts = relOptions[f.name] || [];
        var selectedIds = joinValues[f.name] || [];
        return '<div class="relation-many-options">' + mopts.map(function (o) {
          var checked = selectedIds.indexOf(o.id) !== -1 ? ' checked' : '';
          return '<label><input type="checkbox" data-name="' + f.name + '" data-rel-id="' + esc(o.id) + '"' + checked + '>' + esc(o.label) + '</label>';
        }).join('') + '</div>';
      }
      case 'image':
        return renderImageField(f.name, value ? [value] : [], false);
      case 'images':
        return renderImageField(f.name, value || [], true);
      case 'files_private':
        return renderPrivateFileField(f.name, value || []);
      default:
        return '<input type="text" data-name="' + f.name + '" value="' + esc(value) + '">';
    }
  }

  function renderImageField(name, urls, multi) {
    var html = '<div class="image-field" data-image-field="' + name + '" data-multi="' + (multi ? '1' : '0') + '">';
    html += '<input type="hidden" data-name="' + name + '" value="' + esc(multi ? JSON.stringify(urls) : (urls[0] || '')) + '">';
    html += '<div class="image-field-preview">' + urls.map(function (u) {
      return '<div class="thumb-wrap"><img src="' + esc(mediaUrl(u)) + '"><button type="button" class="thumb-remove" data-remove-url="' + esc(u) + '">&times;</button></div>';
    }).join('') + '</div>';
    /* Must stay in step with viemag-media's allowed_mime_types
       (supabase/migrations/20260730180000). `image/*` used to be offered here,
       which included svg, gif, bmp and tiff — all of them rejected by the bucket
       now. A dialog that lets someone pick a file the server will refuse is worse
       than no limit, because the failure lands after they have done the work. */
    html += '<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" ' + (multi ? 'multiple' : '') + '>';
    html += '<span class="upload-status" style="font-size:.8rem;color:var(--muted)"></span>';
    html += '</div>';
    return html;
  }

  function textareaHtml(f, value, rows) {
    var attrs = 'class="' + (f.large ? 'large' : '') + '" data-name="' + f.name + '"' + (rows ? ' rows="' + rows + '"' : '');
    var textarea = '<textarea ' + attrs + '>' + esc(value) + '</textarea>';
    if (f.editor !== 'productArticle') return textarea;
    return '<div class="rich-editor" data-rich-editor="' + esc(f.name) + '">'
      + '<div class="rich-toolbar" aria-label="' + esc(t('formatToolbar')) + '">'
      + '<button type="button" data-format="bold" title="' + esc(t('formatBold')) + '"><b>B</b></button>'
      + '<button type="button" data-format="italic" title="' + esc(t('formatItalic')) + '"><i>I</i></button>'
      + '<button type="button" data-format="heading" title="' + esc(t('formatHeading')) + '">H2</button>'
      + '<button type="button" data-format="bullet" title="' + esc(t('formatBullet')) + '">List</button>'
      + '<select class="rich-image-layout" title="' + esc(t('imageLayout')) + '">'
      + '<option value="wide">' + esc(t('imageLayoutWide')) + '</option>'
      + '<option value="left">' + esc(t('imageLayoutLeft')) + '</option>'
      + '<option value="right">' + esc(t('imageLayoutRight')) + '</option>'
      + '</select>'
      + '<input type="text" class="rich-image-url" placeholder="' + esc(t('imageUrl')) + '">'
      + '<button type="button" data-format="image" title="' + esc(t('insertImage')) + '">Img</button>'
      + '</div>'
      + textarea
      + '<p class="rich-help">' + esc(t('formatHelp')) + '</p>'
      + '</div>';
  }

  function wireRichEditor(wrap) {
    var textarea = wrap.querySelector('textarea[data-name]');
    if (!textarea) return;
    function touch() {
      state.formDirty = true;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
    function replaceSelection(text) {
      var start = textarea.selectionStart || 0;
      var end = textarea.selectionEnd || 0;
      textarea.setRangeText(text, start, end, 'end');
      touch();
    }
    function wrapSelection(before, after, fallback) {
      var start = textarea.selectionStart || 0;
      var end = textarea.selectionEnd || 0;
      var selected = textarea.value.slice(start, end) || fallback;
      textarea.setRangeText(before + selected + after, start, end, 'select');
      touch();
    }
    function prefixLines(prefix, fallback) {
      var start = textarea.selectionStart || 0;
      var end = textarea.selectionEnd || 0;
      var selected = textarea.value.slice(start, end) || fallback;
      var next = selected.split(/\r?\n/).map(function (line) {
        return line.trim() ? prefix + line.replace(/^(##\s+|[-*]\s+)/, '') : line;
      }).join('\n');
      textarea.setRangeText(next, start, end, 'select');
      touch();
    }
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-format]'), function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.dataset.format;
        if (kind === 'bold') { wrapSelection('**', '**', t('formatSample')); return; }
        if (kind === 'italic') { wrapSelection('*', '*', t('formatSample')); return; }
        if (kind === 'heading') { prefixLines('## ', t('headingSample')); return; }
        if (kind === 'bullet') { prefixLines('- ', t('bulletSample')); return; }
        if (kind === 'image') {
          var input = wrap.querySelector('.rich-image-url');
          var url = input ? input.value.trim() : '';
          if (!url) { if (input) input.focus(); return; }
          var layoutEl = wrap.querySelector('.rich-image-layout');
          var layout = layoutEl ? layoutEl.value : 'wide';
          replaceSelection('\n![' + t('imageAltSample') + '](' + url + '){' + layout + '}\n');
          if (input) input.value = '';
        }
      });
    });
  }

  /* The eight components summed into product_development.sales_cost_usd, read
     from the schema so adding a ninth fee never needs a second edit here. */
  function costFieldNames() {
    return SCHEMA.product_development.fields
      .filter(function (f) { return /_usd$/.test(f.name) && !f.readOnly; })
      .map(function (f) { return f.name; });
  }

  /* The generated sales cost is stale the moment an owner edits a component, so
     recompute from the inputs when they exist. When they do not, the signed-in
     user is an editor and the only reachable source is the product_sales_cost
     view — which is exactly what that view is for. */
  function refreshComputed(ctx) {
    var inputs = costFieldNames().map(function (n) { return document.querySelector('[data-name="' + n + '"]'); });
    var salesCost = inputs[0]
      ? inputs.reduce(function (sum, el) { return sum + (el && el.value !== '' ? Number(el.value) : 0); }, 0)
      : (ctx.viewCost == null ? null : Number(ctx.viewCost));

    var generatedEl = document.querySelector('[data-readonly-name="sales_cost_usd"]');
    if (generatedEl) generatedEl.value = salesCost == null ? '' : salesCost.toFixed(2);

    var costEl = document.querySelector('[data-compute="salesCost"]');
    if (costEl) {
      costEl.textContent = salesCost ? salesCost.toFixed(2) : '—';
      costEl.className = 'computed-value' + (salesCost ? '' : ' muted');
    }

    var marginEl = document.querySelector('[data-compute="actualMargin"]');
    if (!marginEl) return;
    var priceEl = document.querySelector('[data-name="price_usd"]');
    var price = priceEl && priceEl.value !== '' ? Number(priceEl.value) : null;
    /* A zero cost means "nothing entered", not a free product: all eight
       components coalesce to 0 in the generated column, and today 19 of 19
       products have no cost data at all. Reporting a flattering 100% margin
       would make the default state of the system a lie. */
    if (!salesCost || !price) {
      marginEl.className = 'computed-value muted';
      marginEl.textContent = t('marginNoCost');
      return;
    }
    var pct = (price - salesCost) / price * 100;
    var floorEl = document.querySelector('[data-name="minimum_gross_margin"]');
    var floor = floorEl && floorEl.value !== '' ? Number(floorEl.value) : null;
    var txt = pct.toFixed(1) + '%';
    var cls = 'computed-value';
    if (floor != null) {
      var under = pct < floor;
      txt += ' — ' + tf(under ? 'marginBelowFloor' : 'marginOk', { min: floor });
      cls += under ? ' warn' : ' ok';
    }
    marginEl.className = cls;
    marginEl.textContent = txt;
  }

  function wireFormEvents(ctx, id, joinFields) {
    /* The three tabs make losing work easier, not harder: you can edit the sales
       tab, switch back to the site tab and forget you touched it. The flat form
       never needed this guard; the tabbed one does. */
    function leave() {
      if (state.formDirty && !confirm(t('unsavedLeave'))) return;
      state.formDirty = false;
      state.view = { table: ctx.tableName, mode: 'list', id: null };
      renderContent();
    }
    document.getElementById('backBtn').addEventListener('click', leave);
    document.getElementById('cancelBtn').addEventListener('click', leave);

    Array.prototype.forEach.call(document.querySelectorAll('.image-field'), function (wrap) {
      wireImageField(wrap, ctx.tableName);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.file-field'), function (wrap) {
      wirePrivateFileField(wrap);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.rich-editor'), function (wrap) {
      wireRichEditor(wrap);
    });

    document.getElementById('saveBtn').addEventListener('click', function () {
      saveForm(ctx, id, joinFields);
    });

    // Show/hide only — see the comment on the panels in buildFormHtml.
    var tabBtns = document.querySelectorAll('.tab-btn');
    Array.prototype.forEach.call(tabBtns, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(tabBtns, function (b) { b.classList.toggle('active', b === btn); });
        Array.prototype.forEach.call(document.querySelectorAll('.tab-panel'), function (p) {
          p.hidden = p.dataset.tab !== btn.dataset.tab;
        });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.group-toggle'), function (btn) {
      btn.addEventListener('click', function () {
        var section = btn.parentNode.parentNode;
        var body = section.querySelector('.group-body');
        body.hidden = !body.hidden;
        section.classList.toggle('collapsed', body.hidden);
        btn.querySelector('.group-caret').textContent = body.hidden ? '+' : '−';
      });
    });

    var card = document.querySelector('.form-card');
    state.formDirty = false;
    if (card) {
      card.addEventListener('input', function () { state.formDirty = true; });
      card.addEventListener('change', function () { state.formDirty = true; });
    }

    Array.prototype.forEach.call(document.querySelectorAll('.lang-translate-btn'), function (btn) {
      btn.addEventListener('click', function () { runTranslateButton(btn); });
    });

    if (!ctx.subTab) return;
    refreshComputed(ctx);
    var live = ['price_usd', 'minimum_gross_margin', 'target_gross_margin'].concat(costFieldNames());
    live.forEach(function (n) {
      var el = document.querySelector('[data-name="' + n + '"]');
      if (el) el.addEventListener('input', function () { refreshComputed(ctx); });
    });
  }

  /* Take whichever language cell's button was clicked, send its current text to
     translate-text, and fill the other three fields in the same lang-row. All
     four buttons in the row are disabled for the round trip so a second click
     (on this cell or a sibling) cannot fire a second call while the first is
     still in flight and land results in the wrong order. */
  function runTranslateButton(btn) {
    var name = btn.dataset.target;
    var source = btn.dataset.lang;
    var input = document.querySelector('[data-name="' + name + '"]');
    var row = btn.closest('.lang-row');
    var prefix = row ? row.dataset.field : name.replace(/_(en|vi|id|zh)$/, '');
    var statusEl = row ? row.querySelector('[data-translate-status="' + prefix + '"]') : null;
    var rowBtns = row ? row.querySelectorAll('.lang-translate-btn') : [btn];

    var text = input ? input.value.trim() : '';
    if (!text) {
      if (statusEl) { statusEl.className = 'translate-status error'; statusEl.textContent = t('translateEmpty'); }
      return;
    }

    Array.prototype.forEach.call(rowBtns, function (b) { b.disabled = true; });
    if (statusEl) { statusEl.className = 'translate-status'; statusEl.textContent = t('translating'); }

    callTranslateFunction(text, source).then(function (result) {
      Array.prototype.forEach.call(rowBtns, function (b) { b.disabled = false; });
      if (!result.httpOk) {
        if (statusEl) { statusEl.className = 'translate-status error'; statusEl.textContent = t('translateFailed') + (result.data.error || 'HTTP error'); }
        return;
      }
      var translations = result.data.translations || {};
      Object.keys(translations).forEach(function (lang) {
        var targetEl = document.querySelector('[data-name="' + prefix + '_' + lang + '"]');
        if (!targetEl) return;
        targetEl.value = translations[lang];
        var cell = targetEl.closest('.lang-cell');
        if (cell) cell.classList.toggle('empty', !translations[lang]);
      });
      state.formDirty = true;
      if (statusEl) { statusEl.className = 'translate-status'; statusEl.textContent = ''; }
    }).catch(function (err) {
      Array.prototype.forEach.call(rowBtns, function (b) { b.disabled = false; });
      if (statusEl) { statusEl.className = 'translate-status error'; statusEl.textContent = t('translateFailed') + err.message; }
    });
  }

  /* Private files. Three things differ from renderImageField, all of them on
     purpose:
       1. The hidden input holds storage PATHS, not URLs. A signed URL expires, so
          storing one would rot; the path is the stable identifier.
       2. Nothing is signed at render time. Signing every file on every form open
          would fire N requests and leave live URLs sitting in the DOM; the link is
          minted when someone actually clicks Open.
       3. No <img> preview. These are drawings and PDFs, and an <img> would need a
          signed URL per file for the very reason above. */
  function renderPrivateFileField(name, paths) {
    var html = '<div class="file-field" data-file-field="' + name + '">';
    html += '<p class="private-note">' + esc(t('privateFileNote')) + '</p>';
    html += '<input type="hidden" data-name="' + name + '" value="' + esc(JSON.stringify(paths || [])) + '">';
    html += '<ul class="file-list"></ul>';
    html += '<label class="file-pick">' + esc(t('uploadFiles'))
         +  '<input type="file" multiple></label>';
    html += '<span class="upload-status"></span>';
    html += '</div>';
    return html;
  }

  function wirePrivateFileField(wrap) {
    var hidden = wrap.querySelector('input[type=hidden]');
    var fileInput = wrap.querySelector('input[type=file]');
    var listEl = wrap.querySelector('.file-list');
    var statusEl = wrap.querySelector('.upload-status');

    function paths() {
      try { return JSON.parse(hidden.value || '[]'); } catch (e) { return []; }
    }
    function setPaths(next) {
      hidden.value = JSON.stringify(next);
      listEl.innerHTML = next.map(function (p) {
        // Upload writes "<table>/<stamp>/<original name>", so the last segment is
        // the filename a human recognises.
        var label = p.split('/').pop();
        return '<li><span class="file-name">' + esc(label) + '</span>'
          + '<button type="button" class="btn file-open" data-path="' + esc(p) + '">' + esc(t('openFile')) + '</button>'
          + '<button type="button" class="btn btn-danger file-del" data-path="' + esc(p) + '">' + esc(t('removeFile')) + '</button></li>';
      }).join('');
      Array.prototype.forEach.call(listEl.querySelectorAll('.file-open'), function (btn) {
        btn.addEventListener('click', function () {
          statusEl.textContent = '';
          /* Signed, not public: createSignedUrl checks the caller's storage
             permission at signing time, so an editor cannot mint one even if they
             somehow reached this button. 120s is deliberately short — once signed,
             the URL works for whoever holds it until it expires. */
          sb.storage.from(CFG.privateBucket).createSignedUrl(btn.dataset.path, 120)
            .then(function (res) {
              if (res.error) { statusEl.textContent = t('signFailed') + res.error.message; return; }
              window.open(res.data.signedUrl, '_blank', 'noopener');
            });
        });
      });
      Array.prototype.forEach.call(listEl.querySelectorAll('.file-del'), function (btn) {
        btn.addEventListener('click', function () {
          /* Drops the reference only; the stored object is left alone. Deleting
             here would destroy the file even if the operator then cancelled the
             form, and the bucket is private so an orphan is clutter, not exposure. */
          setPaths(paths().filter(function (p) { return p !== btn.dataset.path; }));
          state.formDirty = true;
        });
      });
    }
    setPaths(paths());

    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      if (!files.length) return;
      statusEl.textContent = t('uploading');
      Promise.all(files.map(function (file) {
        var stamp = Date.now() + '-' + Math.random().toString(36).slice(2);
        var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var path = 'product_development/' + stamp + '/' + safe;
        return sb.storage.from(CFG.privateBucket).upload(path, file).then(function (res) {
          if (res.error) throw res.error;
          return path; // the PATH, never a URL — see renderPrivateFileField
        });
      })).then(function (added) {
        statusEl.textContent = '';
        setPaths(paths().concat(added));
        state.formDirty = true;
        fileInput.value = '';
      }).catch(function (err) {
        statusEl.textContent = err.message || String(err);
      });
    });
  }

  function wireImageField(wrap, tableName) {
    var multi = wrap.dataset.multi === '1';
    var fileInput = wrap.querySelector('input[type=file]');
    var hidden = wrap.querySelector('input[type=hidden]');
    var statusEl = wrap.querySelector('.upload-status');
    var previewEl = wrap.querySelector('.image-field-preview');

    function currentUrls() {
      if (!multi) return hidden.value ? [hidden.value] : [];
      try { return JSON.parse(hidden.value || '[]'); } catch (e) { return []; }
    }
    function setUrls(urls) {
      hidden.value = multi ? JSON.stringify(urls) : (urls[0] || '');
      previewEl.innerHTML = urls.map(function (u) {
        return '<div class="thumb-wrap"><img src="' + esc(mediaUrl(u)) + '"><button type="button" class="thumb-remove" data-remove-url="' + esc(u) + '">&times;</button></div>';
      }).join('');
      Array.prototype.forEach.call(previewEl.querySelectorAll('.thumb-remove'), function (btn) {
        btn.addEventListener('click', function () {
          setUrls(currentUrls().filter(function (u) { return u !== btn.dataset.removeUrl; }));
        });
      });
      /* If this field IS the record's thumbnail, keep the header picture in step.
         Otherwise an upload leaves two pictures of the same product on screen
         disagreeing with each other until the next save-and-reload — and the
         stale one is the bigger, higher-up one.
         Compared against state.view.table rather than the tableName argument:
         the product form's third tab writes to product_development, whose
         images are not this record's thumbnail. */
      var headDef = SCHEMA[state.view.table];
      var headEl = document.getElementById('formHeadThumb');
      if (headEl && headDef && wrap.dataset.imageField === headDef.thumb) {
        var fbInput = headDef.thumbFallback
          ? document.querySelector('[data-name="' + headDef.thumbFallback + '"]') : null;
        headEl.innerHTML = formThumbInner(urls[0] || null, fbInput ? fbInput.value : null);
      }
    }
    setUrls(currentUrls());

    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      if (!files.length) return;
      statusEl.textContent = t('uploading');
      Promise.all(files.map(function (file) {
        var path = tableName + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        return sb.storage.from(CFG.mediaBucket).upload(path, file).then(function (res) {
          if (res.error) throw res.error;
          return sb.storage.from(CFG.mediaBucket).getPublicUrl(path).data.publicUrl;
        });
      })).then(function (newUrls) {
        statusEl.textContent = '';
        var merged = multi ? currentUrls().concat(newUrls) : newUrls.slice(0, 1);
        setUrls(merged);
      }).catch(function (err) {
        statusEl.textContent = err.message || String(err);
      });
    });
  }

  /* omitEmpty=true (INSERT): leave blank fields OUT of the payload entirely so
     the column DEFAULT applies. Sending an explicit null overrides a default in
     SQL, which is how a half-filled new product used to end up with
     launch_tier=NULL — and NULL is not 'Future', so the exporter published it
     to the live site immediately. On UPDATE we DO send null, because there a
     cleared field genuinely means "erase this value". */
  function collectFormValues(def, omitEmpty) {
    var out = {};
    def.fields.forEach(function (f) {
      if (f.type === 'relation_many') return; // handled separately via join tables
      if (f.type === 'computed' || f.readOnly) return; // not columns we may write
      if (f.type === 'multiselect') {
        var checked = document.querySelectorAll('input[data-name="' + f.name + '"][data-multi-value]:checked');
        var vals = Array.prototype.map.call(checked, function (c) { return c.dataset.multiValue; });
        if (omitEmpty && !vals.length) return;
        out[f.name] = vals;
        return;
      }
      var el = document.querySelector('[data-name="' + f.name + '"]');
      if (!el) return;
      if (f.type === 'boolean') { out[f.name] = el.checked; return; }
      if (f.type === 'number') {
        if (el.value === '') { if (!omitEmpty) out[f.name] = null; return; }
        out[f.name] = Number(el.value);
        return;
      }
      if (f.type === 'images' || f.type === 'files_private') {
        var arr = el.value ? JSON.parse(el.value) : [];
        if (omitEmpty && !arr.length) return;
        out[f.name] = arr;
        return;
      }
      if (el.value === '') { if (!omitEmpty) out[f.name] = null; return; }
      out[f.name] = el.value;
    });
    return out;
  }

  /* Tab 3 is a different table, so Save writes twice. There is deliberately ONE
     Save button: the tabs are a view of one record, and three buttons would make
     people believe saving one tab discards the others — a belief that loses real
     work. Skipped entirely for editors, who had no inputs rendered and so have
     nothing of theirs to lose. Resolves to null on success, or to a message. */
  function saveSubRecord(ctx, rowId) {
    if (!ctx.subTab || ctx.role !== 'owner') return Promise.resolve(null);
    var subDef = SCHEMA[ctx.subTab.table];
    var values = collectFormValues(subDef, false);
    var hasAny = Object.keys(values).some(function (k) {
      return values[k] !== null && values[k] !== '';
    });
    /* Don't create an all-null row for a product nobody has costed yet — it
       would make "has a development record" useless as a signal. */
    if (!hasAny && !ctx.subRow) return Promise.resolve(null);
    values.product_id = rowId;
    return sb.from(ctx.subTab.table).upsert(values, { onConflict: 'product_id' })
      .then(function (res) { return res.error ? res.error.message : null; });
  }

  function saveForm(ctx, id, joinFields) {
    var tableName = ctx.tableName, def = ctx.def, isNew = ctx.isNew;
    var statusEl = document.getElementById('saveStatus');
    var saveBtn = document.getElementById('saveBtn');
    statusEl.className = 'save-status';
    statusEl.textContent = t('loading');
    // Guard against double-click creating two rows in tables with no unique key.
    saveBtn.disabled = true;
    var fail = function (msg) {
      saveBtn.disabled = false;
      statusEl.className = 'save-status error';
      statusEl.textContent = msg;
    };
    var values = collectFormValues(def, isNew);

    var savePromise = isNew
      ? sb.from(tableName).insert(values).select('id').single()
      : sb.from(tableName).update(values).eq('id', id).select('id').single();

    savePromise.then(function (res) {
      if (res.error) { fail(t('saveFailed') + res.error.message); return; }
      var rowId = res.data.id;

      /* Relation sets are rewritten delete-then-insert. That is destructive, so
         every step is error-checked: if the insert fails (e.g. a CHECK
         constraint) after the delete already committed, the operator must be
         told the set is now empty rather than shown "Saved". */
      var joinOps = joinFields.map(function (f) {
        var checks = document.querySelectorAll('input[data-name="' + f.name + '"][data-rel-id]:checked');
        var selectedIds = Array.prototype.map.call(checks, function (c) { return c.dataset.relId; })
          // A product must never relate to itself — the DB has a CHECK for it,
          // and without this filter one stray tick wiped the whole set.
          .filter(function (targetId) { return targetId !== rowId; });
        return sb.from(f.joinTable).delete().eq(f.joinKey, rowId).then(function (delRes) {
          if (delRes.error) throw new Error(f.joinTable + ' (clear): ' + delRes.error.message);
          if (!selectedIds.length) return null;
          var rows = selectedIds.map(function (targetId) {
            var o = {}; o[f.joinKey] = rowId; o[f.joinTargetKey] = targetId; return o;
          });
          return sb.from(f.joinTable).insert(rows).then(function (insRes) {
            if (insRes.error) throw new Error(f.joinTable + ' (rewrite): ' + insRes.error.message);
          });
        });
      });

      Promise.all(joinOps).then(function () {
        return saveSubRecord(ctx, rowId);
      }).then(function (subError) {
        /* Two tables, two writes, no shared transaction — the same shape the join
           rewrite above already has, and the same rule applies: report the real
           state instead of printing "Saved". Recovery is just pressing Save
           again, because the two tables do not depend on each other. The form is
           left open, and formDirty stays true, because the development inputs
           genuinely still hold unsaved values. */
        if (subError) {
          saveBtn.disabled = false;
          statusEl.className = 'save-status error';
          statusEl.textContent = t('savedPartialDev') + subError;
          state.relationCache = {};
          triggerExportIfNeeded(tableName, document.getElementById('syncStatus'));
          return;
        }
        state.formDirty = false;
        statusEl.textContent = t('saved');
        // A renamed/created row changes relation labels elsewhere; drop the cache
        // so other forms don't keep showing stale options for the whole session.
        state.relationCache = {};
        /* Report export status into the PERSISTENT topbar, not this form's
           status line: the form is torn down below long before the export's
           GitHub round-trip finishes, so a failure written here would land on a
           detached node and the operator would never see it. */
        triggerExportIfNeeded(tableName, document.getElementById('syncStatus'));
        setTimeout(function () {
          state.view = { table: tableName, mode: 'list', id: null };
          renderContent();
        }, 600);
      }).catch(function (err) {
        fail(t('saveFailed') + err.message);
      });
    });
  }

  /* ---------------- boot ---------------- */
  sb.auth.getSession().then(function (res) {
    state.session = res.data.session;
    if (state.session) { showApp(); } else { showLogin(); }
  });
  sb.auth.onAuthStateChange(function (_event, session) {
    state.session = session;
  });
})();
