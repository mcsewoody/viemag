import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

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
    body: '<button id="syncNowBtn"></button><form id="loginForm"></form><button id="signOutBtn"></button><div id="fixture"></div>' }));
  await page.goto('http://admin.test/');
  await page.evaluate(() => {
    window.VIEMAG_ADMIN_CONFIG = {};
    window.supabase = { createClient: () => ({}) };
  });
  await page.addStyleTag({ content: fs.readFileSync('admin/admin.css', 'utf8') });
  for (const file of ['schema.js', 'i18n.js', 'field-i18n.js', 'option-i18n.js', 'packaging-export.js']) {
    await page.evaluate(fs.readFileSync('admin/' + file, 'utf8'));
  }
  const source = fs.readFileSync('admin/admin.js', 'utf8');
  const marker = '/* ---------------- boot ---------------- */';
  assert.ok(source.includes(marker));
  await page.evaluate(source.replace(marker,
    'window.__qa={buildFormHtml,wireFormEvents,collectFormValues,validateForm,state};return;' + marker));
  await page.evaluate(() => {
    const ctx = { tableName: 'products', def: window.VIEMAG_SCHEMA.products, isNew: false, role: 'owner',
      row: { product_id: 'VQ09-WH', name_en: 'Mount', name_vi: 'Gia do', accessories_en: 'Cable', accessories_vi: 'Cap' },
      subRows: { product_packaging: { packaging_product_type: 'Charging product', country_of_origin: 'Made in China',
        main_material_en: 'ABS', main_material_vi: 'PC', input_voltage: '9V' } },
      brand: { manufacturer_name: 'Fixture manufacturer', manufacturer_address: 'Fixture address' },
      relOptions: {}, joinValues: {}, subTabs: window.VIEMAG_SCHEMA.products.tabs.filter(tab => tab.table) };
    window.__ctx = ctx;
    document.getElementById('fixture').innerHTML = window.__qa.buildFormHtml(ctx);
    window.__qa.wireFormEvents(ctx, 'fixture', []);
    document.querySelector('.tab-btn[data-tab="packaging"]').click();
  });
  const preserved = await page.evaluate(() => {
    const groups = window.VIEMAG_SCHEMA.products.tabs.find(tab => tab.key === 'packaging').groups;
    return groups.every(group => group.fields.flat().every(name =>
      document.querySelectorAll('[' + (group.source === 'brand_settings' ? 'data-shared-name' : 'data-name') + '="' + name + '"]').length === 1));
  });
  assert.ok(preserved, 'Every packaging field must still have exactly one editable source');
  assert.equal(await page.locator('.packaging-groups > .group:visible').count(), 1);
  await page.locator('[data-packaging-group="pkgLegal"]').click();
  assert.equal(await page.locator('[data-shared-name="manufacturer_name"]').innerText(), 'Fixture manufacturer');
  assert.equal(await page.locator('[data-name="manufacturer_name"]').count(), 0);
  assert.equal(await page.locator('#packagingReviewBtn').count(), 1);
  await page.locator('[data-packaging-search]').fill('input_voltage');
  assert.ok(await page.locator('[data-name="input_voltage"]').isVisible());
  assert.equal(await page.evaluate(() => window.__qa.state.formDirty), false, 'Search must not mark the record dirty');
  await page.locator('[data-name="input_voltage"]').fill('12V');
  await page.locator('[data-packaging-search]').fill('no-field-with-this-name');
  assert.ok(await page.locator('.packaging-no-results').isVisible());
  await page.locator('[data-packaging-group="pkgSetup"]').click();
  assert.equal(await page.locator('[data-name="country_of_origin"]').inputValue(), 'China');
  assert.equal(await page.locator('[data-name="manufacturing_year"]').inputValue(),
    await page.evaluate(() => window.VIEMAG_PACKAGING_YEAR));
  await page.locator('[data-packaging-group="pkgMaterial"]').click();
  await page.locator('[data-packaging-language]').selectOption('vi');
  assert.ok(await page.locator('[data-name="main_material_vi"]').isVisible());
  assert.ok(!await page.locator('[data-name="main_material_en"]').isVisible());
  await page.locator('[data-name="main_material_vi"]').fill('Silicone');
  await page.locator('[data-packaging-group="pkgIdentity"]').click();
  await page.locator('.packaging-groups [data-group="pkgIdentity"] .lang-row .packaging-field-source').click();
  assert.ok(await page.locator('.tab-panel[data-tab="front"]').isVisible());
  await page.locator('[data-name="name_vi"]').fill('<b>New name</b>');
  await page.locator('.tab-btn[data-tab="packaging"]').click();
  assert.equal(await page.locator('.packaging-groups [data-shared-name="name_vi"]').innerText(), '<b>New name</b>');
  const values = await page.evaluate(() => window.__qa.collectFormValues(window.VIEMAG_SCHEMA.product_packaging));
  assert.equal(values.input_voltage, '12V', 'Hidden groups must retain edited values');
  assert.equal(values.main_material_vi, 'Silicone');
  assert.equal(values.main_material_en, 'ABS', 'Switching language must preserve the other translations');
  assert.ok(!Object.hasOwn(values, 'model_number'));
  assert.ok(!Object.hasOwn(values, 'name_vi'));
  await page.locator('[data-packaging-group="pkgSetup"]').click();
  await page.locator('[data-name="packaging_product_type"]').selectOption('Power bank');
  const validate = () => page.evaluate(() => window.__qa.validateForm({ def: { fields: [] }, role: 'owner',
    subTabs: [{ table: 'product_packaging' }] }));
  assert.ok(await validate(), 'Required fields must be checked in inactive groups');
  assert.ok(await page.locator('.packaging-groups [data-group="pkgSpecC"]').isVisible());
  await page.locator('[data-name="battery_type"]').selectOption('Li-ion');
  await page.locator('[data-name="battery_capacity_mah"]').fill('10000');
  await page.locator('[data-name="rated_voltage"]').fill('3.7V');
  await page.locator('[data-name="watt_hour_wh"]').fill('37');
  await page.locator('[data-packaging-language]').selectOption('en');
  await page.locator('[data-packaging-group="pkgIdentity"]').click();
  assert.ok(await validate());
  assert.ok(await page.locator('[data-name="lithium_warning_vi"]').isVisible(), 'Reveal the required language as well as its group');
  await page.locator('[data-name="lithium_warning_vi"]').fill('Sample warning');
  assert.equal(await validate(), null);
  await page.locator('[data-packaging-group="pkgSetup"]').click();
  await page.locator('[data-name="packaging_product_type"]').selectOption('Magnetic bracket');
  assert.ok(!await page.locator('[data-packaging-group="pkgSpecC"]').isVisible());
  assert.equal((await page.evaluate(() => window.__qa.collectFormValues(window.VIEMAG_SCHEMA.product_packaging))).battery_capacity_mah, '10000');
  await page.locator('[data-packaging-all]').check();
  assert.ok(await page.locator('.packaging-groups > .group:visible').count() > 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile horizontal overflow');
  assert.deepEqual(errors, []);
  console.log('Admin packaging layout checks passed: field parity, shared values, search, languages, validation and mobile.');
} finally {
  await browser.close();
}
