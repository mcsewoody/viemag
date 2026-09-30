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
eval(fs.readFileSync('admin/packaging-export.js', 'utf8'));
const P = w.VIEMAG_PACKAGING;

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

console.log(`\nClean: ${checks} checks passed.`);
