#!/usr/bin/env node
/**
 * VIEMAG — self-check for admin/packaging-export.js
 *
 *     node scripts/test_packaging_export.mjs
 *
 * Exit 0 = clean, 1 = something broke. No framework: the file under test is a
 * browser IIFE that hangs one object off `window`, so eval-ing it with a stub
 * window is both the smallest and the most faithful way to reach it.
 *
 * What is worth checking here is not formatting but the four rules that make
 * the export trustworthy, each of which fails silently if broken:
 *   • nothing empty is printed          (a blank heading reads as "deliberate")
 *   • only the matching 6A/6B/6C block  (wrong specs on a box is a reprint)
 *   • the Qi gate                       (printing an uncertified logo is a legal problem)
 *   • the EAN-13 check digit            (a transposed digit is invisible until the scanner fails)
 */
import fs from 'fs';
import assert from 'node:assert/strict';

const w = {};
global.window = w;
/* schema.js first: it owns VIEMAG_PKG_TYPES, the single declaration of which
   product type needs which block, and the exporter reads it. Loading them in
   the same order admin/index.html does means this test exercises the shared
   constant rather than a copy that could drift from it. */
eval(fs.readFileSync('admin/schema.js', 'utf8'));
eval(fs.readFileSync('admin/packaging-export.js', 'utf8'));
const P = w.VIEMAG_PACKAGING;
const SCHEMA = w.VIEMAG_SCHEMA;
const PKG_TYPES = w.VIEMAG_PKG_TYPES;

const DATE = '2026-09-30';
let checks = 0;
const ok = (label) => { checks++; console.log(`   ✓ ${label}`); };

/* ---------- EAN-13 check digit ---------- */
/* 4006381333931 is the canonical example from the GS1 specification. */
assert.equal(P.ean13Valid('4006381333931'), true);
assert.equal(P.ean13Valid('4006381333932'), false, 'wrong check digit must fail');
assert.equal(P.ean13Valid('4006381333'), false, 'short code must fail');
assert.equal(P.ean13Valid('40063813339AB'), false, 'non-digits must fail');
assert.equal(P.ean13Valid(''), false);
ok('EAN-13 validation accepts a real code and rejects length, digits and checksum errors');

/* ---------- nothing empty is printed ---------- */
{
  const txt = P.build(
    { packaging_product_type: 'Magnetic bracket', packaging_name_vi: 'Giá đỡ nam châm' },
    { product_id: 'V01' },
    DATE,
  );
  assert.ok(txt.includes('1. Tên sản phẩm'), 'the filled Vietnamese name must appear');
  assert.ok(!txt.includes('EN — English'), 'a language with no content must not get a block');
  assert.ok(!txt.includes('5. Chất liệu'), 'an empty section must not get a heading');
  ok('empty sections and empty languages are left out entirely');
}

/* ---------- only the matching spec block ---------- */
{
  const pkg = {
    packaging_product_type: 'Charging product',
    packaging_name_en: 'Wireless car charger',
    magnetic_bracket_specs_en: 'BRACKET-ONLY-TEXT',
    charging_specs_en: 'Input 9V/2A',
    power_bank_specs_en: 'BATTERY-ONLY-TEXT',
  };
  const txt = P.build(pkg, { product_id: 'VQ09' }, DATE);
  assert.ok(txt.includes('Input 9V/2A'), '6B must be printed for a charging product');
  assert.ok(!txt.includes('BRACKET-ONLY-TEXT'), '6A must not leak into a charging product');
  assert.ok(!txt.includes('BATTERY-ONLY-TEXT'), '6C must not leak into a charging product');

  const combined = P.build({ ...pkg, packaging_product_type: 'Combined product' }, { product_id: 'BQ01' }, DATE);
  assert.ok(combined.includes('BRACKET-ONLY-TEXT'), 'Combined product must open 6A');
  assert.ok(combined.includes('Input 9V/2A'), 'Combined product must open 6B');
  assert.ok(combined.includes('BATTERY-ONLY-TEXT'), 'Combined product must open 6C');
  ok('only the spec block matching the product type is exported; Combined opens all three');
}

/* ---------- the Qi gate ---------- */
{
  const pkg = { packaging_product_type: 'Charging product', packaging_name_vi: 'Sạc' };
  const testing = P.build(pkg, { product_id: 'VQ09', qi_status: 'Testing' }, DATE);
  assert.ok(testing.includes('MUST NOT appear'), 'an uncertified SKU must carry the prohibition');

  const noId = P.build(pkg, { product_id: 'VQ14', qi_status: 'Certified' }, DATE);
  assert.ok(noId.includes('[FAIL]') && noId.includes('no Qi ID'), 'Certified without a Qi ID must FAIL, not pass');

  const certified = P.build(pkg, { product_id: 'VQ14', qi_status: 'Certified', qi_id: 'QI-12345' }, DATE);
  assert.ok(certified.includes('may be printed') && certified.includes('QI-12345'));
  assert.ok(!certified.includes('MUST NOT appear'));
  ok('the Qi logo is permitted only when qi_status is Certified AND a Qi ID exists');
}

/* ---------- fallbacks ---------- */
{
  const txt = P.build(
    { packaging_product_type: 'Magnetic bracket' },
    {
      product_id: 'V01',
      official_sku_code: 'V01',
      name_vi: 'Giá đỡ điện thoại nam châm',
      accessories_vi: 'Giá đỡ × 1\nVòng nam châm × 1',
      technical_content_vi: 'Kích thước | 64 x 64 mm',
    },
    DATE,
  );
  assert.ok(txt.includes('Giá đỡ điện thoại nam châm'), 'product name must fill in for a blank packaging name');
  assert.ok(txt.includes('Vòng nam châm × 1'), 'accessories must fill in for blank contents');
  assert.ok(txt.includes('64 x 64 mm'), 'technical content must fill in when no spec block is filled');
  assert.equal(P.fileName({ official_sku_code: 'VQ09-WH' }), 'VQ09-WH-packaging.txt');
  ok('untouched packaging fields fall back to the product record; the file is named after the SKU');
}

/* ---------- a filled spec block wins over the fallback ---------- */
{
  const txt = P.build(
    { packaging_product_type: 'Magnetic bracket', magnetic_bracket_specs_vi: 'Kẹp 6-9 mm' },
    { product_id: 'V01', name_vi: 'Giá đỡ', technical_content_vi: 'SITE-SPEC-TABLE' },
    DATE,
  );
  assert.ok(txt.includes('Kẹp 6-9 mm'));
  assert.ok(!txt.includes('SITE-SPEC-TABLE'), 'the site spec table must not be mixed into a labelled 6A block');
  ok('a filled spec block replaces the site fallback rather than joining it');
}

/* ---------- EAN-13 edge cases the old check got wrong ---------- */
/* 036000291452 is the canonical GS1 UPC-A example. The field is labelled
   "EAN/UPC" and a UPC-A is an EAN-13 with a leading zero, so refusing it was the
   check calling a correct barcode wrong. */
assert.equal(P.ean13Valid('036000291452'), true, 'a valid 12-digit UPC-A must be accepted');
assert.equal(P.ean13Valid('036000291453'), false, 'a UPC-A with a wrong check digit must still fail');
/* Exported on window, so it can be called with whatever the caller holds.
   code[i] on a Number is undefined and the checksum would be NaN. */
assert.equal(P.ean13Valid(4006381333931), true, 'a numeric argument must not fail on string indexing');
assert.equal(P.ean13Valid(null), false);
assert.equal(P.ean13Valid(undefined), false);
assert.equal(P.ean13Valid('  4006381333931  '), true, 'a pasted code with whitespace must be accepted');
ok('EAN-13 accepts UPC-A and a numeric argument, and still rejects a bad check digit');

/* ---------- per-product-type field matrix ----------
   The one rule the whole feature exists for: a designer must not receive a
   figure that does not apply to the box they are laying out. */
const ALL_ATTRS = {
  magnet_grade: 'N52', clamp_range_mm: '6-9',
  input_voltage: '9V', input_current: '2A', input_power: '18W',
  wireless_output_power: '15W', max_output_power: '25W', connector_type: 'USB-C',
  wired_output_voltage: '5V', wired_output_current: '3A', wired_output_power: '15W',
  battery_type: 'Li-ion', battery_capacity_mah: '10000', rated_voltage: '3.7V',
  watt_hour_wh: '37', port1_spec: 'USB-C 5V/3A', port2_spec: 'USB-A 5V/2.4A',
  port3_spec: 'USB-C 9V/2A', max_combined_output: '65W',
};
const PRODUCT = { product_id: 'V01', name_vi: 'Giá đỡ', name_en: 'Mount' };

{
  const txt = P.build({ ...ALL_ATTRS, packaging_product_type: 'Magnetic bracket' }, PRODUCT, DATE, {});
  assert.ok(txt.includes('N52'), 'the magnet grade belongs on a bracket');
  assert.ok(txt.includes('6-9 mm'), 'the clamping range must carry its unit');
  assert.ok(!txt.includes('10000'), 'a bracket must never export a battery capacity');
  assert.ok(!txt.includes('37 Wh'), 'a bracket must never export watt-hours');
  assert.ok(!txt.includes('3.7V'), 'a bracket must never export a rated voltage');
  assert.ok(!txt.includes('USB-C 5V/3A'), 'a bracket must never export a port spec');
  assert.ok(!txt.includes('9V'), 'a bracket must never export a charging input');
  ok('Magnetic bracket exports its magnet and clamp figures and no battery or charging ones');
}

{
  const txt = P.build({ ...ALL_ATTRS, packaging_product_type: 'Charging product' }, PRODUCT, DATE, {});
  assert.ok(txt.includes('9V') && txt.includes('2A'), 'a charger must export its input');
  assert.ok(txt.includes('25W'), 'a charger must export its maximum output');
  assert.ok(txt.includes('USB-C'), 'a charger must export its connector');
  assert.ok(!txt.includes('10000'), 'a charger with no cells must not export a capacity');
  assert.ok(!txt.includes('37 Wh'), 'a charger with no cells must not export watt-hours');
  assert.ok(!txt.includes('N52'), 'a charger must not export a magnet grade');
  ok('Charging product exports input, output and connector and no battery figures');
}

{
  const txt = P.build({ ...ALL_ATTRS, packaging_product_type: 'Power bank' }, PRODUCT, DATE, {});
  assert.ok(txt.includes('10000 mAh'), 'a power bank must export its capacity with its unit');
  assert.ok(txt.includes('3.7V'), 'a power bank must export its rated voltage');
  assert.ok(txt.includes('37 Wh'), 'a power bank must export watt-hours with its unit');
  assert.ok(txt.includes('USB-C 5V/3A'), 'a power bank must export its port specs');
  assert.ok(txt.includes('65W'), 'a power bank must export its combined output ceiling');
  /* 6B opens for a power bank too: a bank that charges a phone has the same
     input and output figures a charger does. */
  assert.ok(txt.includes('18W'), 'a power bank must also export its charging input');
  assert.ok(!txt.includes('N52'), 'a power bank must not export a magnet grade');
  ok('Power bank exports battery, port and charging figures and no magnet ones');
}

{
  const txt = P.build({ ...ALL_ATTRS, packaging_product_type: 'Combined product' }, PRODUCT, DATE, {});
  assert.ok(txt.includes('N52') && txt.includes('9V') && txt.includes('37 Wh'),
    'Combined product must open all three blocks');
  ok('Combined product exports every block');
}

/* ---------- a value of 0 is a value ---------- */
{
  const txt = P.build(
    { packaging_product_type: 'Power bank', watt_hour_wh: '0', battery_capacity_mah: '0' },
    PRODUCT, DATE, {},
  );
  assert.ok(txt.includes('0 Wh'), 'zero is a number someone typed, not an empty box');
  assert.ok(txt.includes('0 mAh'));
  ok('a figure of 0 is printed rather than treated as empty');
}

/* ---------- figures alone do not manufacture four language blocks ---------- */
{
  const txt = P.build(
    { packaging_product_type: 'Power bank', watt_hour_wh: '37' },
    { product_id: 'V01', name_vi: 'Sạc dự phòng' },
    DATE, {},
  );
  assert.ok(txt.includes('VI — Tiếng Việt'), 'the language that has the product name must render');
  assert.ok(!txt.includes('ID — Bahasa Indonesia'),
    'identical figures under a translated label are not a translation');
  ok('shared figures are neutral: they do not conjure a language block of their own');
}

/* ---------- brand block ---------- */
{
  const empty = P.build({ packaging_product_type: 'Magnetic bracket' }, PRODUCT, DATE, {});
  assert.ok(empty.includes('[FAIL] Responsible company'), 'an unset brand block must fail pre-print');
  assert.ok(empty.includes('NOT YET FILLED IN'));

  const filled = P.build({ packaging_product_type: 'Magnetic bracket' }, PRODUCT, DATE, {
    responsible_company: 'COMART', responsible_address: 'Addr 1',
    importer_name: 'VN Importer', importer_address: 'Addr 2',
    customer_contact: 'hotline@example.com',
    warranty_terms_vi: 'Bảo hành 12 tháng kể từ ngày mua.',
  });
  assert.ok(!filled.includes('[FAIL] Responsible company'), 'a filled brand block must clear the failure');
  assert.ok(filled.includes('COMART') && filled.includes('VN Importer'));
  assert.ok(filled.includes('Bảo hành 12 tháng'), 'the warranty sentence must reach the file');
  ok('the brand block fails loudly when unset and prints when filled');
}

/* ---------- country of origin and year of manufacture ---------- */
{
  const bracket = P.build({ packaging_product_type: 'Magnetic bracket' }, PRODUCT, DATE, {});
  assert.ok(bracket.includes('[FAIL] Country of origin is empty'));
  assert.ok(!bracket.includes('Year of manufacture is required'),
    'a non-electric product is not asked for a year of manufacture');

  const charger = P.build(
    { packaging_product_type: 'Charging product', country_of_origin: 'Made in China' },
    PRODUCT, DATE, {},
  );
  assert.ok(!charger.includes('[FAIL] Country of origin'));
  assert.ok(charger.includes('Made in China'));
  assert.ok(charger.includes('Year of manufacture is required'),
    'Appendix I category 40 asks an electrical product for a year of manufacture');
  assert.ok(charger.includes('____'), 'an empty year must still print the fill-in line for the printer');

  const dated = P.build(
    { packaging_product_type: 'Charging product', manufacturing_year: '2026' },
    PRODUCT, DATE, {},
  );
  assert.ok(dated.includes('reads 2026'), 'a filled year still warns, because it is a batch property');
  ok('country of origin is always required; the year of manufacture only for electrical goods');
}

/* ---------- the watt-hour and lithium gates ---------- */
{
  const bare = P.build({ packaging_product_type: 'Power bank' }, PRODUCT, DATE, {});
  assert.ok(bare.includes('[FAIL] No watt-hour figure'), 'air freight will not take cells without a Wh figure');
  assert.ok(bare.includes('[FAIL] No Vietnamese lithium-cell warning'));

  const done = P.build(
    { packaging_product_type: 'Power bank', watt_hour_wh: '37', lithium_warning_vi: 'Không đốt, không đâm thủng.' },
    PRODUCT, DATE, {},
  );
  assert.ok(done.includes('[ok]   Watt-hours declared (37 Wh)'));
  assert.ok(!done.includes('[FAIL] No Vietnamese lithium-cell warning'));
  assert.ok(done.includes('6D. Cảnh báo pin lithium'));

  const bracket = P.build({ packaging_product_type: 'Magnetic bracket' }, PRODUCT, DATE, {});
  assert.ok(!bracket.includes('watt-hour'), 'a bracket is never asked for watt-hours');
  ok('a power bank must declare watt-hours and a Vietnamese lithium warning; a bracket is not asked');
}

/* ---------- the Vietnamese sub-label ---------- */
{
  const brand = {
    responsible_company: 'COMART', responsible_address: 'Addr 1',
    importer_name: 'VN Importer', importer_address: 'Addr 2',
    customer_contact: 'hotline@example.com',
  };
  const txt = P.buildSubLabel(
    {
      packaging_product_type: 'Power bank', country_of_origin: 'Made in China',
      manufacturing_year: '2026', watt_hour_wh: '37',
      packaging_name_vi: 'Sạc dự phòng nam châm', packaging_name_en: 'Magnetic power bank',
      instructions_precautions_vi: 'Không để gần nguồn nhiệt.',
      instructions_precautions_en: 'KEEP-AWAY-FROM-HEAT-EN',
      lithium_warning_vi: 'Không đốt.',
    },
    { product_id: 'V01', official_sku_code: 'BQ01', warranty_months: 12 },
    brand,
  );
  assert.ok(txt.includes('Sạc dự phòng nam châm'));
  assert.ok(txt.includes('COMART') && txt.includes('VN Importer'), 'both responsible parties are mandatory');
  assert.ok(txt.includes('Made in China'));
  assert.ok(txt.includes('Năm sản xuất'), 'an electrical product carries a year of manufacture');
  assert.ok(txt.includes('37 Wh'));
  assert.ok(txt.includes('Bảo hành 12 tháng'));
  assert.ok(!txt.includes('Magnetic power bank'), 'the sub-label is Vietnamese only');
  assert.ok(!txt.includes('KEEP-AWAY-FROM-HEAT-EN'), 'no other language may leak onto the sticker');

  const bracket = P.buildSubLabel(
    { packaging_product_type: 'Magnetic bracket', country_of_origin: 'Made in China', packaging_name_vi: 'Giá đỡ' },
    { product_id: 'V01' }, brand,
  );
  assert.ok(!bracket.includes('Năm sản xuất'),
    'a non-electric product must not spend a line of a sticker on a year it does not need');
  ok('the Vietnamese sub-label carries the mandatory content only, in Vietnamese only');
}

/* ---------- the print sheet ---------- */
{
  const html = P.buildPrintHtml(
    { packaging_product_type: 'Magnetic bracket', packaging_name_vi: 'Giá đỡ <nam châm>' },
    {
      product_id: 'V01',
      hero_image_url: 'https://zqmpjenlpzmeozoufvzy.supabase.co/storage/v1/object/public/viemag-media/a.png',
      gallery_urls: ['javascript:alert(1)', 'https://evil.example.com/x.png'],
    },
    DATE, {}, true,
  );
  assert.ok(html.includes('<img src="https://zqmpjenlpzmeozoufvzy.supabase.co/'), 'our own storage is embedded');
  /* Assert on the src attributes, not on the whole document. The rejected URLs
     DO still appear further down, as escaped text inside the <pre> that repeats
     the .txt — that is the designer being shown what was entered, and escaped
     text in a <pre> cannot execute. What must never happen is one reaching an
     attribute the browser resolves. */
  const srcs = [...html.matchAll(/<img src="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(srcs.length === 1, 'exactly one of the three URLs may be embedded');
  assert.ok(srcs.every((u) => u.startsWith('https://zqmpjenlpzmeozoufvzy.supabase.co/')),
    'only our own storage host may reach an img src');
  assert.ok(!srcs.some((u) => u.startsWith('javascript:')), 'a javascript: URL must never reach an img src');
  assert.ok(html.includes('&lt;nam châm&gt;'), 'staff text must be escaped, not rendered as markup');
  assert.ok(html.includes('UNSAVED DRAFT'), 'a sheet built from unsaved edits must say so');
  ok('the print sheet embeds only our own images, escapes staff text and flags an unsaved draft');
}

/* ---------- file names ---------- */
{
  assert.notEqual(
    P.fileName({ official_sku_code: 'VQ09 WH' }),
    P.fileName({ official_sku_code: 'VQ09/WH' }),
    'two different SKUs must not collide on one file name in a Downloads folder',
  );
  assert.ok(P.fileName({ official_sku_code: '磁吸支架-01' }).includes('%'),
    'a CJK SKU must survive rather than collapse to dashes');
  assert.ok(P.fileName({ official_sku_code: 'VQ09-Trắng' }).length > '-packaging.txt'.length + 4,
    'Vietnamese diacritics must not be eaten');
  assert.ok(P.fileName({ official_sku_code: 'BQ01' }, '-nhan-phu-vi.txt').endsWith('-nhan-phu-vi.txt'));
  ok('file names survive CJK and diacritics, and two SKUs cannot overwrite each other');
}

/* ---------- unicode round-trip ---------- */
{
  const txt = P.build(
    {
      packaging_product_type: 'Magnetic bracket',
      packaging_name_vi: 'Giá đỡ điện thoại nam châm',
      packaging_name_zh: '磁吸手機架',
      packaging_name_id: 'Dudukan ponsel magnetik',
      main_material_vi: 'Nhựa ABS, hợp kim nhôm',
      main_material_zh: 'ABS 塑膠、鋁合金',
    },
    PRODUCT, DATE, {},
  );
  assert.ok(txt.includes('Giá đỡ điện thoại nam châm'));
  assert.ok(txt.includes('磁吸手機架') && txt.includes('ABS 塑膠、鋁合金'));
  assert.ok(txt.includes('Dudukan ponsel magnetik'));
  ok('Vietnamese, Traditional Chinese and Indonesian survive the export unchanged');
}

/* ---------- the form and the export must agree about product types ----------
   This is the check that would have caught the four rules that had drifted:
   every battery requiredIf said ['Power bank'] while every other expression of
   the same rule included 'Combined product', so a magnetic power bank saved
   clean and then exported two [FAIL] lines. The rule now lives in one place;
   this asserts that nothing has quietly grown a second copy. */
{
  const pk = SCHEMA.product_packaging;
  const tab = SCHEMA.products.tabs.find((t) => t.key === 'packaging');
  const group = (k) => tab.groups.find((g) => g.key === k);
  const field = (n) => pk.fields.find((f) => f.name === n);

  // Each group points at the shared constant, not a copy that happens to match.
  assert.equal(group('pkgSpecA').showIf.in, PKG_TYPES.bracket);
  assert.equal(group('pkgSpecB').showIf.in, PKG_TYPES.charging);
  assert.equal(group('pkgSpecC').showIf.in, PKG_TYPES.battery);
  assert.equal(group('pkgLithium').showIf.in, PKG_TYPES.battery);

  /* A field may only be required for a type its own group is shown for.
     Requiring something on a form that hides it is unfixable by the operator. */
  for (const g of tab.groups) {
    for (const entry of g.fields || []) {
      for (const name of [].concat(entry)) {
        const f = field(name);
        if (!f || !f.requiredIf) continue;
        const shown = g.showIf ? g.showIf.in : null;
        if (!shown) continue;
        for (const t of f.requiredIf.in) {
          assert.ok(shown.indexOf(t) !== -1,
            `${name} is required for "${t}" but its group ${g.key} is hidden for it`);
        }
      }
    }
  }

  /* Whatever the form forces you to fill, the export must not then FAIL on,
     and vice versa. These two drifted apart in opposite directions once
     already: the form demanded lithium_warning_en while preflight checked
     lithium_warning_vi. */
  const PRODUCT_MIN = { product_id: 'V01', name_vi: 'X' };
  for (const type of ['Magnetic bracket', 'Charging product', 'Power bank', 'Combined product']) {
    /* The barcode is deliberately savable while empty and deliberately fatal to
       the export — the field description says so, because a half-typed code
       must still be storable while nothing goes to print against an unissued
       one. So a "complete" record has to include it; it is not an example of
       the form and the export disagreeing. */
    const filled = {
      packaging_product_type: type,
      country_of_origin: 'Made in China',
      barcode_ean_upc: '4006381333931',
    };
    pk.fields.forEach((f) => {
      if (f.requiredIf && f.requiredIf.in.indexOf(type) !== -1) filled[f.name] = '1';
    });
    const txt = P.build(filled, PRODUCT_MIN, DATE, {
      responsible_company: 'C', responsible_address: 'A',
      importer_name: 'I', importer_address: 'A2',
    });
    const fails = txt.split('\n').filter((l) => l.indexOf('[FAIL]') !== -1);
    assert.deepEqual(fails, [],
      `${type}: the form accepts this record but the export rejects it:\n${fails.join('\n')}`);
  }
  ok('the form and the export agree: no record passes Save and then fails the export');
}

console.log(`\nClean: ${checks} checks passed.`);
