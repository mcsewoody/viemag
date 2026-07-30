#!/usr/bin/env node
/**
 * VIEMAG — field parity audit
 *
 * Enforces the rule agreed on 2026-07-29: every field a colleague can edit in
 * /admin must either reach the public site or say plainly that it does not. A
 * field that saves happily and changes nothing is worse than a missing field,
 * because the person who filled it in believes the work is done.
 *
 * Run it after adding or removing ANY column:
 *     node scripts/audit-field-parity.mjs
 * Exit code 0 = clean, 1 = something needs a decision.
 *
 * It checks five directions, and C, D and E are the ones easy to forget:
 *   A. /admin field  -> is it exported, internal, or on an inbox/not-wired table?
 *   B. exported col  -> is there anywhere in /admin to edit it?
 *   C. data.js key   -> does any front-end file actually read it?
 *   D. internal field-> is it absent from every export whitelist?
 *   E. owner-only tbl-> is it absent from the export function entirely?
 *
 * Direction C is how `tier` was caught: it was published to js/data.js, read by
 * nothing, and its values ('B - Test', 'C - Display') exposed an internal
 * commercial classification to anyone who opened the file.
 *
 * Direction D closes a hole direction A had: A SKIPS anything tagged
 * internal: true, so a field that was both tagged internal AND added to a
 * *_COLS whitelist passed as clean while publishing to viemag.biz. Added
 * 2026-07-30 with the sales tab, whose every field is internal.
 *
 * Direction E is a plain substring check over the export function's source, and
 * it is deliberately strict: even naming an owner-only table in a COMMENT there
 * fails. The cost of that false positive is one sentence someone cannot write;
 * the cost of the false negative is a supplier name on a public website.
 *
 * Table categories, declared by `note:` in admin/schema.js:
 *   (none)         catalogue content — published on save
 *   noteInbox      filled by a public form, triaged by staff, never published
 *   noteNotWired   the editor exists but nothing consumes it yet (declared gap)
 *   noteOwnerOnly  owners only, enforced by RLS, never published
 * admin_users is managed by the Accounts panel, not by a schema.js table.
 *
 * Reading DB columns needs a live connection, so that part is optional: pass a
 * JSON file of [{table_name, cols}] as argv[2] to include direction B fully.
 */
import fs from 'fs';

const w = {};
global.window = w;
eval(fs.readFileSync('admin/schema.js', 'utf8'));
const SCHEMA = w.VIEMAG_SCHEMA;
const ORDER = w.VIEMAG_TABLE_ORDER;

const exporter = fs.readFileSync('supabase/functions/export-site-data/index.ts', 'utf8');
const WHITELIST = {};
for (const [table, constant] of [
  ['products', 'PRODUCT'], ['categories', 'CATEGORY'], ['scenarios', 'SCENARIO'],
  ['faq', 'FAQ'], ['test_reports', 'TEST_REPORT'], ['guides', 'GUIDE'],
]) {
  const m = exporter.match(new RegExp(`${constant}_COLS = \\[([\\s\\S]*?)\\]\\.join`));
  if (!m) { console.error(`cannot find ${constant}_COLS in the export function`); process.exit(2); }
  WHITELIST[table] = new Set([...m[1].matchAll(/'([\w ]+)'/g)].map((x) => x[1]));
}

const FRONT_END = [
  'js/main.js', 'index.html', 'products.html', 'product.html', 'about.html',
  'why-viemag.html', 'scenarios.html', 'insights.html', 'insight.html',
  'dealers.html', 'support.html',
];
const frontSrc = FRONT_END.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

let problems = 0;
const fail = (msg) => { console.log(`   ✗ ${msg}`); problems++; };

/* ---------- A. every /admin field has a purpose ---------- */
console.log('A. /admin fields\n');
/* Every table in SCHEMA, not just the ones in ORDER: product_development is
   edited as a tab of the product form and deliberately absent from the sidebar,
   and iterating ORDER alone would have left it entirely unaudited. */
for (const table of Object.keys(SCHEMA)) {
  const def = SCHEMA[table];
  const exported = WHITELIST[table] || new Set();
  if (!ORDER.includes(table) && !def.note) {
    fail(`${table}: not in VIEMAG_TABLE_ORDER and declares no note: — nothing can reach this editor`);
    continue;
  }
  if (def.note === 'noteOwnerOnly') {
    console.log(`   · ${table}: owner-only, never published — skipped`);
    continue;
  }
  if (def.note === 'noteNotWired') {
    console.log(`   ~ ${table}: declared not wired (${def.fields.length} fields) — expected while the product library is undesigned`);
    continue;
  }
  if (def.note === 'noteInbox') { console.log(`   · ${table}: inbox, nothing published — skipped`); continue; }

  const dead = def.fields
    // `computed` fields are not columns at all — calculated in the browser, stored nowhere.
    .filter((f) => f.type !== 'computed')
    .filter((f) => !exported.has(f.name) && !f.internal && !f.name.endsWith('_ids'))
    .map((f) => f.name);
  if (dead.length) fail(`${table}: editable, not exported, not tagged internal → ${dead.join(', ')}`);
  else console.log(`   ✓ ${table}`);
}

/* ---------- B. every exported column is editable ---------- */
console.log('\nB. exported columns\n');
for (const [table, cols] of Object.entries(WHITELIST)) {
  const names = new Set(SCHEMA[table].fields.map((f) => f.name));
  const orphan = [...cols].filter((c) => !names.has(c) && c !== 'id');
  if (orphan.length) fail(`${table}: exported but nowhere to edit → ${orphan.join(', ')}`);
  else console.log(`   ✓ ${table}`);
}

/* ---------- C. every data.js key is read by the front end ---------- */
console.log('\nC. js/data.js keys\n');
const dw = {};
global.window = dw;
eval(fs.readFileSync('js/data.js', 'utf8'));
const DB = dw.DB;

/* reports/insights are empty until staff publish some, so derive their shape
   from the export function rather than from a sample row. */
const shapeFromExporter = (marker) => {
  const start = exporter.indexOf(marker);
  const block = exporter.slice(start, exporter.indexOf('}))', start));
  return Object.fromEntries([...block.matchAll(/^\s{4}(\w+):/gm)].map((m) => [m[1], null]));
};
const shapes = {
  'products[]': DB.products[0],
  'categories[]': DB.categories[0],
  'scenarios[]': DB.scenarios[0],
  'personas[]': DB.personas[0],
  'tests[]': DB.tests[0],
  'faqs[]': DB.faqs[0],
  config: DB.config,
  'reports[]': shapeFromExporter('const reports = (reportRows'),
  'insights[]': shapeFromExporter('const insights = (guideRows'),
};
/* Conditionally-emitted product keys are absent from a sample row. */
for (const k of ['spec', 'faqs', 'related', 'img', 'shopee']) shapes['products[]'][k] ??= null;

/* `slug` on a product is deliberately carried unused: it is the natural key for
   the per-language URLs that are still on the backlog. Everything else must be
   read by something. */
const ALLOWED_UNUSED = new Set(['products[].slug']);

for (const [label, obj] of Object.entries(shapes)) {
  const unused = Object.keys(obj || {}).filter((k) => {
    if (ALLOWED_UNUSED.has(`${label}.${k}`)) return false;
    /* A bare `.key` match would count Array#sort as a read of a `sort` field, so
       require either an accessor on a short variable, a destructure, or a
       DB.<key> reference. */
    const root = label.replace('[]', '');
    return ![
      new RegExp(`\\b(?:p|x|a|b|c|s|f|pe|r|prod|item|target)\\.${k}\\b`),
      new RegExp(`\\{[^}]*\\b${k}\\b[^}]*\\}\\s*=`),
      new RegExp(`DB\\.${k}\\b`),
      /* Singular objects (config) are reached through their own name:
         DB.config.shopeeUrl, not <var>.shopeeUrl. */
      new RegExp(`\\b${root}\\.${k}\\b`),
    ].some((re) => re.test(frontSrc));
  });
  if (unused.length) fail(`${label}: exported but no front-end reads it → ${unused.join(', ')}`);
  else console.log(`   ✓ ${label}`);
}

/* ---------- D. nothing tagged internal is exported ---------- */
console.log('\nD. internal fields stay unexported\n');
for (const [table, cols] of Object.entries(WHITELIST)) {
  const leaked = SCHEMA[table].fields.filter((f) => f.internal && cols.has(f.name)).map((f) => f.name);
  if (leaked.length) fail(`${table}: tagged internal AND in the export whitelist → ${leaked.join(', ')}`);
  else console.log(`   ✓ ${table}`);
}

/* ---------- E. owner-only tables are invisible to the exporter ---------- */
console.log('\nE. owner-only tables never reach the exporter\n');
const ownerOnly = Object.entries(SCHEMA).filter(([, def]) => def.note === 'noteOwnerOnly');
if (!ownerOnly.length) console.log('   · none declared');
for (const [table] of ownerOnly) {
  if (exporter.includes(table)) {
    fail(`${table}: named in export-site-data — an owner-only table must not appear there at all, not even in a comment`);
  } else {
    console.log(`   ✓ ${table} is not named in export-site-data`);
  }
}

console.log(problems ? `\n${problems} item(s) need a decision.` : '\nClean: every field either reaches the site or says it does not.');
process.exit(problems ? 1 : 0);
