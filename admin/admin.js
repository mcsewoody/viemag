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

  function triggerExportIfNeeded(tableName, statusEl) {
    if (EXPORT_TRIGGER_TABLES.indexOf(tableName) === -1) return;
    callExportFunction().then(function (result) {
      if (!statusEl) return;
      if (!result.httpOk) { statusEl.textContent += ' (' + t('exportFailed') + (result.data.error || 'HTTP error') + ')'; return; }
      if (result.data.committed) statusEl.textContent += ' · ' + t('exported');
    }).catch(function (err) {
      if (statusEl) statusEl.textContent += ' (' + t('exportFailed') + err.message + ')';
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
    document.getElementById('brandLabel').textContent = t('appTitle');
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
    sb.from('admin_users').select('role').eq('user_id', state.session.user.id).maybeSingle()
      .then(function (res) {
        var role = (res.data && res.data.role) === 'owner' ? 'owner' : 'editor';
        if (role === state.myRole) return;
        state.myRole = role;
        if (state.view.table === ACCOUNTS_VIEW) renderContent();
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
  /* ---------------- list view ---------------- */
  function renderList(root) {
    var tableName = state.view.table;
    var def = SCHEMA[tableName];
    var orderCol = def.order || def.title;
    sb.from(tableName).select('*').order(orderCol, { ascending: true }).then(function (res) {
      if (res.error) { root.innerHTML = '<p class="save-status error">' + esc(res.error.message) + '</p>'; return; }
      var rows = res.data || [];
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
      if (!rows.length) {
        html += '<div class="empty-state">' + esc(t('noRecords')) + '</div>';
      } else {
        html += '<table class="grid"><thead><tr>';
        if (def.thumb || def.thumbFallback) html += '<th class="thumb-col"></th>';
        html += '<th>' + esc(def.title) + '</th>';
        if (statusField) html += '<th>status</th>';
        html += '<th></th></tr></thead><tbody id="listBody">';
        rows.forEach(function (r) {
          html += '<tr data-id="' + esc(r.id) + '">';
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
          if (statusField) html += '<td><span class="badge-status">' + esc(r.status || '—') + '</span></td>';
          html += '<td class="row-actions">';
          html += '<button class="btn edit-btn">' + esc(t('edit')) + '</button>';
          html += '<button class="btn btn-danger del-btn">' + esc(t('delete')) + '</button>';
          html += '</td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="row-count">' + t('rowCount')(rows.length) + '</p>';
      }
      root.innerHTML = html;

      document.getElementById('addNewBtn').addEventListener('click', function () {
        state.view = { table: tableName, mode: 'edit', id: null };
        renderContent();
      });
      var search = document.getElementById('listSearch');
      search.addEventListener('input', function () {
        var q = search.value.toLowerCase();
        Array.prototype.forEach.call(document.querySelectorAll('#listBody tr'), function (tr) {
          tr.style.display = tr.textContent.toLowerCase().indexOf(q) === -1 ? 'none' : '';
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
            var msg = t('confirmDelete');
            if (affected > 0) msg += '\n\n' + t('confirmDeleteCategory').replace('{n}', affected);
            if (!confirm(msg)) return;
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

    Promise.all([rowPromise, relOptionsPromise, joinValuesPromise]).catch(function (err) {
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
      var row = results[0], relOptions = results[1], joinValues = results[2];
      root.innerHTML = buildFormHtml(tableName, def, row, relOptions, joinValues, isNew);
      wireFormEvents(tableName, def, id, isNew, joinFields);
    });
  }

  function buildFormHtml(tableName, def, row, relOptions, joinValues, isNew) {
    var html = '<h2>' + esc(tTable(tableName)) + ' — ' + (isNew ? esc(t('addNew')) : esc(row[def.title] || '')) + '</h2>';
    html += '<button class="btn" id="backBtn">&larr; ' + esc(t('backToList')) + '</button>';
    html += '<div class="form-card" style="margin-top:14px"><div class="form-grid">';

    def.fields.forEach(function (f) {
      var value = row[f.name];
      var wideTypes = ['textarea', 'multiselect', 'relation_many', 'image', 'images'];
      html += '<div class="field' + (wideTypes.indexOf(f.type) !== -1 ? ' wide' : '') + '" data-field="' + f.name + '">';
      html += '<label>' + esc(f.name) + (f.internal ? ' <span class="internal-tag">' + esc(t('internalField')) + '</span>' : '') + '</label>';
      var descHtml = fieldDescHtml(tableName, f);
      if (descHtml) html += '<p class="field-desc">' + descHtml + '</p>';
      html += renderFieldInput(f, value, relOptions, joinValues);
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary" id="saveBtn">' + esc(t('save')) + '</button>';
    html += '<button class="btn" id="cancelBtn">' + esc(t('cancel')) + '</button>';
    html += '<span id="saveStatus" class="save-status"></span>';
    html += '</div></div>';
    return html;
  }

  function renderFieldInput(f, value, relOptions, joinValues) {
    switch (f.type) {
      case 'textarea':
        return '<textarea class="' + (f.large ? 'large' : '') + '" data-name="' + f.name + '">' + esc(value) + '</textarea>';
      case 'number':
        return '<input type="number" step="any" data-name="' + f.name + '" value="' + (value == null ? '' : esc(value)) + '">';
      case 'date':
        return '<input type="date" data-name="' + f.name + '" value="' + esc(value || '') + '">';
      case 'boolean':
        return '<div class="field checkbox"><input type="checkbox" data-name="' + f.name + '" ' + (value ? 'checked' : '') + '></div>';
      case 'select':
        return '<select data-name="' + f.name + '"><option value="">—</option>' + f.options.map(function (o) {
          return '<option value="' + esc(o) + '"' + (value === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>';
      case 'multiselect': {
        var arr = value || [];
        return '<div class="multiselect-options">' + f.options.map(function (o) {
          var checked = arr.indexOf(o) !== -1 ? ' checked' : '';
          return '<label><input type="checkbox" data-name="' + f.name + '" data-multi-value="' + esc(o) + '"' + checked + '>' + esc(o) + '</label>';
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
    html += '<input type="file" accept="image/*,.pdf" ' + (multi ? 'multiple' : '') + '>';
    html += '<span class="upload-status" style="font-size:.8rem;color:var(--muted)"></span>';
    html += '</div>';
    return html;
  }

  function wireFormEvents(tableName, def, id, isNew, joinFields) {
    document.getElementById('backBtn').addEventListener('click', function () {
      state.view = { table: tableName, mode: 'list', id: null };
      renderContent();
    });
    document.getElementById('cancelBtn').addEventListener('click', function () {
      state.view = { table: tableName, mode: 'list', id: null };
      renderContent();
    });

    Array.prototype.forEach.call(document.querySelectorAll('.image-field'), function (wrap) {
      wireImageField(wrap, tableName);
    });

    document.getElementById('saveBtn').addEventListener('click', function () {
      saveForm(tableName, def, id, isNew, joinFields);
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
      if (f.type === 'images') {
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

  function saveForm(tableName, def, id, isNew, joinFields) {
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
