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
 * It checks seven directions, and C, D, E and G are the ones easy to forget:
 *   A. /admin field  -> is it exported, internal, or on an inbox/not-wired table?
 *   B. exported col  -> is there anywhere in /admin to edit it?
 *   C. data.js key   -> does any front-end file actually read it?
 *   D. internal field-> is it absent from every export whitelist?
 *   E. owner-only tbl-> is it absent from the export function entirely?
 *   F. every view    -> does it revoke default grants from anon AND authenticated?
 *   G. every option  -> does every select/multiselect value have a label in
 *                       option-i18n.js for zh-Hant, zh-Hans and vi?
 *
 * Direction G is how a whole missing translation LAYER was caught (2026-08-06):
 * renderFieldInput() showed every select/multiselect option as its raw stored
 * value with no translation at all, so every dropdown and checkbox list was
 * English regardless of admin UI language — even though field labels and
 * descriptions were fully translated. Field-level i18n coverage (this script's
 * original job) said nothing about it, because the gap was one level deeper:
 * inside the options of already-covered fields. A field can pass every other
 * direction here and still fail G.
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
eval(fs.readFileSync('admin/option-i18n.js', 'utf8'));
const SCHEMA = w.VIEMAG_SCHEMA;
const ORDER = w.VIEMAG_TABLE_ORDER;
const OPTION_I18N = w.VIEMAG_OPTION_I18N;

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
    console.log(`   ~ ${table}: declared not wired (${def.fields.length} fields) — kept deliberately, with no consumer planned since the product library was dropped on 2026-07-30`);
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

/* ---------- F. every view in public strips its default grants ---------- */
/* Supabase grants ALL on every new object in `public` to anon and authenticated.
   For a VIEW that is worse than for a table, because a view with
   security_invoker left at its default runs with its OWNER's privileges and
   therefore reads and writes straight past the base table's RLS. A leftover
   DELETE grant on such a view is a way around the policy, not a formality.

   20260730120000 created product_sales_cost, revoked the defaults from anon, and
   forgot authenticated — leaving an editor able to DELETE the cost record it was
   only ever supposed to read one number from. Fixed in 20260730140000; this
   check is here so the next view cannot repeat it.

   Only views are checked. Catalogue TABLES intentionally leave authenticated
   with full CRUD (see 20260728035523) and RLS is what constrains them, so the
   same rule applied to tables would fail on fourteen correct migrations. */
console.log('\nF. views strip their default grants\n');
const migDir = 'supabase/migrations';
const views = [];
for (const file of fs.readdirSync(migDir).sort()) {
  const sqlText = fs.readFileSync(`${migDir}/${file}`, 'utf8');
  for (const m of sqlText.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/gi)) {
    views.push({ view: m[1], file });
  }
}
if (!views.length) console.log('   · no views in public');
for (const { view } of views) {
  /* The revoke may land in a later migration than the create — that is a valid
     fix, so search every migration rather than only the creating one. */
  const all = fs.readdirSync(migDir).map((f) => fs.readFileSync(`${migDir}/${f}`, 'utf8')).join('\n');
  const missing = ['anon', 'authenticated'].filter(
    (role) => !new RegExp(`revoke\\s+all\\s+on\\s+public\\.${view}\\s+from\\s+${role}`, 'i').test(all));
  if (missing.length) fail(`view public.${view}: never revokes default grants from ${missing.join(' and ')} — a view bypasses the base table's RLS, so a leftover write grant is a way around it`);
  else console.log(`   ✓ public.${view} revokes anon and authenticated defaults`);
}

/* ---------- G. every select/multiselect option is translated ---------- */
/* Codes, not labels — translating them would make them harder to match
   against source documents, so option-i18n.js deliberately omits them and this
   direction must not flag their absence. Keep this list in sync with the
   "DELIBERATELY NOT translated" comment at the top of option-i18n.js. */
const OPTION_EXCLUDED = {
  products: new Set(['art_key']),
  categories: new Set(['internal_cat_mapping']),
  scenarios: new Set(['scenario_code']),
};
const OPTION_LANGS = ['zh-Hant', 'zh-Hans', 'vi'];
console.log('\nG. select/multiselect options are translated\n');
for (const table of Object.keys(SCHEMA)) {
  const fields = SCHEMA[table].fields.filter((f) => (f.type === 'select' || f.type === 'multiselect') && f.options);
  for (const f of fields) {
    if ((OPTION_EXCLUDED[table] || new Set()).has(f.name)) continue;
    for (const lang of OPTION_LANGS) {
      const dict = (OPTION_I18N[lang] && OPTION_I18N[lang][table] && OPTION_I18N[lang][table][f.name]) || {};
      // A bare wattage number ('15W') is language-neutral and needs no entry.
      const missing = f.options.filter((o) => !(o in dict) && !/^\d+W$/.test(o));
      if (missing.length) fail(`${table}.${f.name} [${lang}]: missing option label(s) → ${missing.join(', ')}`);
    }
  }
}
if (!problems) console.log('   ✓ every translatable option covered in zh-Hant, zh-Hans and vi');

console.log(problems ? `\n${problems} item(s) need a decision.` : '\nClean: every field either reaches the site or says it does not.');
process.exit(problems ? 1 : 0);
