import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';

const source = fs.readFileSync('admin/admin.js', 'utf8');
const missingLockColumn = { error: { message: "Could not find the 'translation_locks' column" } };
let attempts = 0;
const writeContext = vm.createContext({
  writeRow: async () => { attempts++; return missingLockColumn; },
  missingColumnFromError: () => 'translation_locks', missingSchemaColumns: {},
});
vm.runInContext(source.slice(source.indexOf('  function writeRowSkippingMissingColumns('),
  source.indexOf('  /* Is this field\'s rule live right now?')), writeContext);
const lockedPayload = { translation_locks: { name_vi: true } };
assert.equal(await writeContext.writeRowSkippingMissingColumns('products', lockedPayload, false, 'id', 8), missingLockColumn);
assert.equal(attempts, 1, 'Missing migration must fail instead of silently discarding proofreading state');
assert.deepEqual(lockedPayload.translation_locks, { name_vi: true });

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(os.homedir(),
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await playwright.chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } :
    fs.existsSync(edge) ? { executablePath: edge } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://admin.test/**', route => route.fulfill({ contentType: 'text/html',
    body: '<form id="loginForm" hidden></form><button id="syncNowBtn"></button><button id="signOutBtn"></button><div class="content" id="fixture"></div>' }));
  await page.goto('http://admin.test/');
  await page.evaluate(() => {
    window.VIEMAG_ADMIN_CONFIG = {};
    window.__writes = [];
    window.supabase = { createClient: () => ({ from: table => ({ upsert: async values => {
      window.__writes.push({ table, values });
      return { error: null };
    } }) }) };
  });
  await page.addStyleTag({ content: fs.readFileSync('admin/admin.css', 'utf8') });
  for (const file of ['schema.js', 'i18n.js', 'field-i18n.js', 'option-i18n.js', 'packaging-export.js']) {
    await page.evaluate(fs.readFileSync('admin/' + file, 'utf8'));
  }
  const marker = '/* ---------------- boot ---------------- */';
  assert.ok(source.includes(marker));
  await page.evaluate(source.replace(marker,
    'window.__qa={buildFormHtml,wireFormEvents,langRowHtml,collectFormValues,saveSubRecords,state,' +
    'setTranslate:function(fn){callTranslateFunction=fn;}};return;' + marker));
  await page.evaluate(() => {
    window.__qa.state.lang = 'en';
    const schema = window.VIEMAG_SCHEMA;
    for (const [table, def] of Object.entries(schema)) {
      if (!def.translationLocks) continue;
      const names = def.fields.map(field => field.name);
      for (const field of def.fields.filter(field => field.name.endsWith('_en'))) {
        const group = ['en', 'vi', 'id', 'zh'].map(lang => field.name.replace(/_en$/, '_' + lang));
        if (!group.every(name => names.includes(name))) continue;
        const row = Object.fromEntries(group.map(name => [name, 'Reviewed content']));
        const host = document.createElement('div');
        host.innerHTML = window.__qa.langRowHtml({ def }, table, row, group);
        if (host.querySelectorAll('.lang-lock-btn[aria-pressed="false"]').length !== 4) {
          throw new Error('Missing default unlocked buttons: ' + table + '.' + field.name);
        }
        row.translation_locks = { [group[1]]: true };
        host.innerHTML = window.__qa.langRowHtml({ def }, table, row, group);
        if (host.querySelectorAll('.lang-cell.locked .lang-lock-btn[aria-pressed="true"]').length !== 1) {
          throw new Error('Missing persisted lock: ' + table + '.' + field.name);
        }
      }
    }
    const ctx = { tableName: 'products', def: schema.products, isNew: false, role: 'owner',
      row: { product_id: 'LOCK-TEST', name_en: 'Mount', name_vi: 'Reviewed name',
        translation_locks: { name_vi: true } },
      subRows: { product_packaging: { instructions_precautions_en: 'Keep dry',
        instructions_precautions_vi: 'Reviewed Vietnamese', instructions_precautions_id: 'Old Indonesian',
        instructions_precautions_zh: 'Old Chinese' } }, brand: {}, relOptions: {}, joinValues: {},
      subTabs: [{ table: 'product_packaging' }] };
    window.__ctx = ctx;
    window.__render = () => {
      document.getElementById('fixture').innerHTML = window.__qa.buildFormHtml(ctx);
      window.__qa.wireFormEvents(ctx, 'fixture', []);
      document.querySelector('.tab-btn[data-tab="packaging"]').click();
    };
    window.__render();
    window.__qa.setTranslate(() => new Promise(resolve => { window.__finishTranslate = resolve; }));
  });
  const lock = page.locator('.lang-lock-btn[data-lock-field="instructions_precautions_vi"]');
  assert.equal(await lock.getAttribute('aria-pressed'), 'false');
  await lock.click();
  assert.equal(await lock.getAttribute('title'), 'Locked: auto-translation will not overwrite this field');
  assert.equal(await page.evaluate(() => window.__qa.state.formDirty), true);
  await page.locator('[data-name="instructions_precautions_vi"]').fill('Reviewed and edited manually');
  await page.locator('.lang-translate-btn[data-target="instructions_precautions_en"]').click();
  // Lock another target while the request is in flight.
  await page.locator('.lang-lock-btn[data-lock-field="instructions_precautions_zh"]').click();
  await page.evaluate(() => window.__finishTranslate({ httpOk: true, data: { translations: {
    en: 'Must never overwrite source', vi: 'Auto Vietnamese', id: 'New Indonesian', zh: 'Auto Chinese',
  } } }));
  await page.waitForFunction(() => document.querySelector('[data-translate-status="instructions_precautions"]').textContent.includes('Skipped'));
  assert.equal(await page.locator('[data-name="instructions_precautions_en"]').inputValue(), 'Keep dry');
  assert.equal(await page.locator('[data-name="instructions_precautions_vi"]').inputValue(), 'Reviewed and edited manually');
  assert.equal(await page.locator('[data-name="instructions_precautions_id"]').inputValue(), 'New Indonesian');
  assert.equal(await page.locator('[data-name="instructions_precautions_zh"]').inputValue(), 'Old Chinese');
  assert.equal(await page.locator('[data-translate-status="instructions_precautions"]').innerText(), 'Skipped 2 locked field(s)');
  const saved = await page.evaluate(async () => {
    const qa = window.__qa, schema = window.VIEMAG_SCHEMA;
    const product = qa.collectFormValues(schema.products, false, 'products');
    const packaging = qa.collectFormValues(schema.product_packaging, false, 'product_packaging');
    await qa.saveSubRecords(window.__ctx, 'product-uuid');
    Object.assign(window.__ctx.row, product);
    window.__ctx.subRows.product_packaging = packaging;
    window.__render();
    return { product, packaging, writes: window.__writes };
  });
  assert.deepEqual(saved.product.translation_locks, { name_vi: true });
  assert.deepEqual(saved.packaging.translation_locks, { instructions_precautions_vi: true, instructions_precautions_zh: true });
  assert.deepEqual(saved.writes[0].values.translation_locks, saved.packaging.translation_locks);
  assert.equal(await lock.getAttribute('aria-pressed'), 'true', 'Saved metadata survives rendering');
  const readOnlyName = page.locator('.tab-panel[data-tab="packaging"] .lang-lock-btn[data-lock-field="name_vi"]');
  assert.equal(await readOnlyName.isDisabled(), true);
  assert.equal(await readOnlyName.getAttribute('aria-pressed'), 'true');
  await page.locator('.tab-btn[data-tab="front"]').click();
  await page.locator('.tab-panel[data-tab="front"] .lang-lock-btn[data-lock-field="name_vi"]').click();
  assert.equal(await readOnlyName.getAttribute('aria-pressed'), 'false', 'Shared row mirrors unlock');
  const sourceLock = page.locator('.tab-panel[data-tab="front"] .lang-lock-btn[data-lock-field="name_en"]');
  await sourceLock.click();
  await page.locator('.lang-translate-btn[data-target="name_en"]').click();
  await page.evaluate(() => window.__finishTranslate({ httpOk: true, data: { translations: { vi: 'New name' } } }));
  await page.waitForFunction(() => document.querySelector('[data-name="name_vi"]').value === 'New name');
  assert.equal(await page.locator('[data-name="name_en"]').inputValue(), 'Mount', 'Locked source remains usable for translation');
  await sourceLock.click();
  assert.deepEqual(await page.evaluate(() => window.__qa.collectFormValues(window.VIEMAG_SCHEMA.products, false).translation_locks), {});
  assert.equal(await page.evaluate(() => Object.hasOwn(window.__qa.collectFormValues(window.VIEMAG_SCHEMA.products, true), 'translation_locks')), false);
  for (const width of [1440, 1008, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.tab-btn[data-tab="packaging"]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width);
    assert.ok(await lock.isVisible());
    if (process.env.TRANSLATION_LOCK_SCREENSHOT_DIR) {
      await lock.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.TRANSLATION_LOCK_SCREENSHOT_DIR, 'translation-locks-' + width + '.png') });
    }
  }
  await page.evaluate(async () => {
    window.__ctx.subRows = {};
    window.__writes = [];
    window.__render();
    await window.__qa.saveSubRecords(window.__ctx, 'new-product');
  });
  assert.deepEqual(await page.evaluate(() => window.__writes), [], 'Empty lock metadata must not create an empty packaging record');
  assert.deepEqual(errors, []);
  console.log('Translation lock checks passed: all language rows, default/persisted locks, manual edits, in-flight locks, source protection, skipped status, table-specific saves, unlock and responsive layout.');
} finally {
  await browser.close();
}
