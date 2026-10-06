import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('product.html', 'utf8');
const extract = (name, next) => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${next}(`, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
};
const context = vm.createContext({
  t: key => key,
  tf: value => value?.en || '',
  esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  richText: value => value,
  accessoryBlock: () => '<ul class="accessory-list"><li>Cable</li></ul>',
  reportList: () => '', icon: () => '',
});
vm.runInContext(extract('technicalDetailsContent', 'productTabsBlock') + extract('packagingSpecRows', 'productFeatureHtml'), context);
const product = { packaging: { material: { en: 'ABS <plastic>' }, origin: 'China', type: 'INTERNAL-TYPE',
  year: 2026, specs: { input_voltage: '5V', battery_capacity_mah: 5000 } } };
const html = context.technicalDetailsContent(product, '<tr><td>SKU</td><td>V01</td></tr>');
assert.equal((html.match(/<table /g) || []).length, 1);
for (const value of ['ABS &lt;plastic&gt;', 'China', '5V', '5000 mAh', 'accessory-list']) assert.ok(html.includes(value));
for (const value of ['pdp.packagingSpecs', 'INTERNAL-TYPE', '2026']) assert.ok(!html.includes(value));
assert.equal(context.packagingSpecRows({}), '');
console.log('Public Tech Specs checks passed: one table, shared material, no operational packaging fields.');
