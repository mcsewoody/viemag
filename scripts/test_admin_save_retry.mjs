import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('admin/admin.js', 'utf8');
const saveSource = source.slice(source.indexOf('  function saveForm('), source.indexOf('  /* ---------------- boot ---------------- */'));
const status = { className: '', textContent: '' };
const button = { disabled: false };
const classes = new Set();
let focused = false;
let siteOpened = false;
const codeInput = { closest: () => ({ classList: { add: name => classes.add(name) } }),
  scrollIntoView() {}, focus() { focused = true; } };
const writes = [];
let values = { product_id: '4', slug: 'product-4' };
let response = { data: { id: 'product-uuid' }, error: null };
let subError = 'Packaging write failed';
let subCalls = 0;
const context = vm.createContext({
  document: {
    getElementById: id => id === 'saveStatus' ? status : id === 'saveBtn' ? button : {},
    querySelector: selector => selector.includes('data-name="product_id"') ? codeInput :
      selector.includes('data-tab="front"') ? { click() { siteOpened = true; } } : null,
  },
  state: { view: { id: null }, formDirty: true },
  validateForm: () => null, collectFormValues: () => ({ ...values }),
  t: key => key + ': ', tf: (key, args) => key + ': ' + args.code,
  writeRowSkippingMissingColumns: async (table, row, isNew, id) => {
    writes.push({ table, row, isNew, id });
    return response;
  },
  saveSubRecords: async () => { subCalls++; return subError; },
  triggerExportIfNeeded() {}, setTimeout() {},
});
vm.runInContext(saveSource, context);
const settle = () => new Promise(resolve => setImmediate(resolve));
const ctx = { tableName: 'products', def: {}, isNew: true, row: {} };
context.saveForm(ctx, null, []);
await settle();
assert.equal(writes[0].isNew, true);
assert.equal(ctx.isNew, false);
assert.equal(ctx.row.id, 'product-uuid');
assert.ok(status.textContent.includes('Packaging write failed'));
assert.equal(button.disabled, false);
assert.equal(context.state.formDirty, true);
subError = null;
context.saveForm(ctx, null, []);
await settle();
assert.equal(writes[1].isNew, false);
assert.equal(writes[1].id, 'product-uuid');
assert.equal(context.state.formDirty, false);

const beforeDuplicate = subCalls;
response = { error: { code: '23505', message: 'duplicate key value violates unique constraint "products_product_id_key"' } };
const duplicateCtx = { tableName: 'products', def: {}, isNew: true, row: {} };
context.saveForm(duplicateCtx, null, []);
await settle();
assert.equal(status.textContent, 'duplicateProductCode: 4');
assert.equal(duplicateCtx.isNew, true);
assert.equal(subCalls, beforeDuplicate);
assert.ok(siteOpened && focused && classes.has('field-error'));
assert.equal(button.disabled, false);
assert.equal(values.product_id, '4');

response = { error: { code: '23505', message: 'duplicate key value violates unique constraint "products_slug_key"' } };
context.saveForm(duplicateCtx, null, []);
await settle();
assert.ok(status.textContent.includes('products_slug_key'), 'Other unique constraints must not be misreported as product code conflicts');
console.log('Save retry checks passed: partial inserts become updates, duplicate codes preserve entries and unrelated constraints remain distinct.');
