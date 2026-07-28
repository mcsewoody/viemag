/* VIEMAG Admin — generic table editor. Vanilla JS, no build step,
   matching the rest of this repo's front-end style. */
(function () {
  'use strict';

  var CFG = window.VIEMAG_ADMIN_CONFIG;
  var SCHEMA = window.VIEMAG_SCHEMA;
  var TABLE_ORDER = window.VIEMAG_TABLE_ORDER;
  var I18N = window.VIEMAG_ADMIN_I18N;
  var LANGS = window.VIEMAG_ADMIN_LANGS;

  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

  var state = {
    lang: localStorage.getItem('viemag-admin-lang') || 'en',
    session: null,
    view: { table: TABLE_ORDER[0], mode: 'list', id: null },
    relationCache: {},
  };

  /* Tables that actually feed js/data.js (see supabase/functions/export-site-data).
     Saving/deleting a row in one of these triggers a re-export + GitHub commit. */
  var EXPORT_TRIGGER_TABLES = ['products', 'categories', 'scenarios', 'faq'];

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
  function tTable(name) {
    var dict = I18N[state.lang] || I18N.en;
    return (dict.tables && dict.tables[name]) || name;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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
  function showLogin() {
    document.getElementById('app').style.display = 'none';
    var el = document.getElementById('loginScreen');
    el.style.display = 'flex';
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
    }).join('');
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
    if (state.view.mode === 'list') renderList(root);
    else renderForm(root);
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
      html += '<div class="toolbar">';
      html += '<input type="search" id="listSearch" placeholder="' + esc(t('search')) + '">';
      html += '<button class="btn btn-primary" id="addNewBtn">+ ' + esc(t('addNew')) + '</button>';
      html += '</div>';
      if (!rows.length) {
        html += '<div class="empty-state">' + esc(t('noRecords')) + '</div>';
      } else {
        html += '<table class="grid"><thead><tr>';
        html += '<th>' + esc(def.title) + '</th>';
        if (statusField) html += '<th>status</th>';
        html += '<th></th></tr></thead><tbody id="listBody">';
        rows.forEach(function (r) {
          html += '<tr data-id="' + esc(r.id) + '">';
          html += '<td>' + esc(r[def.title]) + '</td>';
          if (statusField) html += '<td><span class="badge-status">' + esc(r.status || '—') + '</span></td>';
          html += '<td class="row-actions">';
          html += '<button class="btn edit-btn">' + esc(t('edit')) + '</button>';
          html += '<button class="btn btn-danger del-btn">' + esc(t('delete')) + '</button>';
          html += '</td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="panel-note">' + t('rowCount')(rows.length) + '</p>';
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
      return '<div class="thumb-wrap"><img src="' + esc(u) + '"><button type="button" class="thumb-remove" data-remove-url="' + esc(u) + '">&times;</button></div>';
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
        return '<div class="thumb-wrap"><img src="' + esc(u) + '"><button type="button" class="thumb-remove" data-remove-url="' + esc(u) + '">&times;</button></div>';
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
