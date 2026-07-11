/* ============================================================
   VIEMAG — Notion auto-translate (build-time, human-in-the-loop)
   For every translatable field group in the 後台 databases, detect
   the source language the editor wrote, and fill ONLY the empty
   target languages via the Claude API — then write them back to
   Notion so editors can review/override.

   Model: Claude Opus 4.8 (claude-opus-4-8) — brand-sensitive copy,
   volume is tiny (dozens of SKUs). Pricing: $5 / $25 per 1M tok.

   Rules (match CLAUDE.md language policy):
   - Authoring langs = EN / VI / ID / ZH(繁). zh-Hans is NOT touched
     here — it is materialised from ZH by the front-end T2S table.
   - FILL EMPTY ONLY. A non-empty field is frozen: a human edit is,
     by definition, non-empty, so this never overwrites人工用詞.
   - Source = the highest-priority non-empty value per field group
     (ZH → EN → VI → ID), or a `Source Lang` select if present.

   SECURITY: this is a PUBLIC repo. The guardrail prompt below is
   deliberately GENERIC and reveals nothing. The confidential
   banned-term list (Taiwan / parent-company / competitor names)
   is injected at runtime from BRAND_BANNED_TERMS — never hardcode
   it here, and never commit it.

   Usage:
     NOTION_TOKEN=… ANTHROPIC_API_KEY=… \
     BRAND_BANNED_TERMS="term1,term2,…" \
     node scripts/translate-notion.mjs            # DRY RUN (default)
     … node scripts/translate-notion.mjs --apply  # write back to Notion
   ============================================================ */

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!NOTION_TOKEN)  { console.error('Missing NOTION_TOKEN env var'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY env var'); process.exit(1); }

const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';
const MODEL = process.env.TRANSLATE_MODEL || 'claude-opus-4-8';

/* Confidential banned terms come from the secret, not the repo. */
const BANNED = (process.env.BRAND_BANNED_TERMS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

/* ---------- Notion plumbing (same shape as export-notion.mjs) ---------- */
const N_API = 'https://api.notion.com/v1';
const N_HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};
const DB = {
  products:   'e5aaaf67b6e94d9c95c7095087faf6b5',
  categories: '980d48794ffb4ad8863d2c6ad865ce2a',
  scenarios:  '1b273820a3354be0a4453eb16f1deecb',
  faq:        '38264c50d1194d78b84ab03f40d30b1f',
};

/* Field groups to translate, per DB. `transcreate` = slogan/marketing
   copy where VI must be localised, not literally translated. */
const GROUPS = {
  products:   [{ prefix: 'Name', transcreate: true },  { prefix: 'Claim', transcreate: true }],
  categories: [{ prefix: 'Name', transcreate: true },  { prefix: 'Desc',  transcreate: false }],
  scenarios:  [{ prefix: 'Name', transcreate: true },  { prefix: 'Desc',  transcreate: false }],
  faq:        [{ prefix: 'Question', transcreate: false }, { prefix: 'Answer', transcreate: false }],
};

const LANGS = ['en', 'vi', 'id', 'zh'];            // authoring set (no zh-Hans)
const SOURCE_PRIORITY = ['zh', 'en', 'vi', 'id'];  // ZH(繁) is the writing base
const LANG_NAME = { en: 'English', vi: 'Vietnamese', id: 'Indonesian', zh: 'Traditional Chinese (繁體中文)' };
const COL = { en: 'EN', vi: 'VI', id: 'ID', zh: 'ZH' };

const P = (page, name) => page.properties[name];
const txt = (p) => (p && p.type === 'rich_text' ? (p.rich_text.map((t) => t.plain_text).join('') || '') : '');
const titleOf = (p) => (p && p.type === 'title' ? (p.title.map((t) => t.plain_text).join('') || '') : '');
const sel = (p) => (p && p.type === 'select' && p.select ? p.select.name : null);

async function queryAll(dbId) {
  const rows = []; let cursor;
  do {
    const res = await fetch(`${N_API}/databases/${dbId}/query`, {
      method: 'POST', headers: N_HEADERS,
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion query ${dbId} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    rows.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return rows;
}

/* rich_text max 2000 chars per block → chunk long values */
const richText = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i += 2000) out.push({ type: 'text', text: { content: s.slice(i, i + 2000) } });
  return out.length ? out : [{ type: 'text', text: { content: '' } }];
};

async function patchPage(pageId, props) {
  const res = await fetch(`${N_API}/pages/${pageId}`, {
    method: 'PATCH', headers: N_HEADERS, body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) throw new Error(`Notion patch ${pageId} failed: ${res.status} ${await res.text()}`);
}

/* ---------- Claude translation ---------- */
const GUARDRAILS = [
  'You are a professional marketing translator for the consumer accessory brand VIEMAG.',
  'Hard rules — follow every one:',
  '- Keep the brand name exactly "VIEMAG" in all uppercase in every language; never translate, romanise, localise, or inflect it.',
  '- Never introduce or invent any company name, manufacturer, country/region of origin, parent company, or competitor brand name — even if it would read naturally. Add no provenance or "made in" claims of any kind.',
  '- For MagSafe / Qi2, only ever express compatibility ("compatible with MagSafe", "meets the Qi2 standard"). Never imply certification the source did not state.',
  '- No unsubstantiated superlatives (strongest, first, only, revolutionary, best-in-class, etc.) unless the source explicitly makes that claim.',
  '- Preserve the source meaning and marketing tone; keep length roughly similar; do not add facts, features, or claims not in the source.',
  'For Vietnamese specifically: transcreate marketing slogans into natural local phrasing — do NOT translate them word-for-word.',
  BANNED.length ? `Never output any of these exact terms in any language: ${BANNED.join(', ')}.` : '',
].filter(Boolean).join('\n');

const containsBanned = (s) => {
  const low = s.toLowerCase();
  return BANNED.some((t) => t && low.includes(t.toLowerCase()));
};

async function translate({ srcLang, srcText, targets, fieldKind, transcreate }) {
  const schema = {
    type: 'object',
    properties: Object.fromEntries(targets.map((l) => [l, { type: 'string' }])),
    required: [...targets],
    additionalProperties: false,
  };
  const user = [
    `Field type: ${fieldKind}${transcreate ? ' (marketing slogan — transcreate, keep it punchy)' : ' (descriptive copy — translate faithfully)'}.`,
    `Source language: ${LANG_NAME[srcLang]}.`,
    `Source text:\n"""${srcText}"""`,
    `Translate it into: ${targets.map((l) => LANG_NAME[l]).join(', ')}.`,
    'Return a JSON object keyed by these language codes: ' + targets.join(', ') + '. Values are the translated strings only — no quotes, notes, or explanations.',
  ].join('\n\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: GUARDRAILS,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.stop_reason === 'refusal') throw new Error('Anthropic refused this translation');
  const block = (json.content || []).find((b) => b.type === 'text');
  return JSON.parse(block.text); // output_config guarantees valid JSON
}

/* ---------- per-row processing ---------- */
async function processRow(dbKey, row, group, report) {
  const label = titleOf(P(row, 'Product ID')) || titleOf(P(row, 'FAQ Key'))
    || txt(P(row, 'Slug')) || txt(P(row, `${group.prefix} EN`)) || row.id.slice(0, 8);

  const values = Object.fromEntries(LANGS.map((l) => [l, txt(P(row, `${group.prefix} ${COL[l]}`))]));
  const filled = LANGS.filter((l) => values[l].trim());
  const empty = LANGS.filter((l) => !values[l].trim());
  if (!filled.length || !empty.length) return; // nothing to seed from, or nothing to fill

  const override = sel(P(row, 'Source Lang'));
  const srcLang = (override && filled.includes(override))
    ? override
    : SOURCE_PRIORITY.find((l) => filled.includes(l));

  let out;
  try {
    out = await translate({
      srcLang, srcText: values[srcLang], targets: empty,
      fieldKind: `${dbKey} ${group.prefix}`, transcreate: group.transcreate,
    });
  } catch (e) {
    report.errors.push(`${dbKey}/${label}/${group.prefix}: ${e.message}`);
    return;
  }

  const props = {};
  for (const l of empty) {
    const v = (out[l] || '').trim();
    if (!v) continue;
    if (containsBanned(v)) { report.blocked.push(`${dbKey}/${label}/${group.prefix} ${COL[l]}: banned term`); continue; }
    props[`${group.prefix} ${COL[l]}`] = { rich_text: richText(v) };
    report.filled.push(`${dbKey}/${label}/${group.prefix} ${COL[l]}  ←${COL[srcLang]}  "${v.slice(0, 60)}"`);
  }
  if (!Object.keys(props).length) return;
  if (APPLY) await patchPage(row.id, props);
}

async function main() {
  const report = { filled: [], blocked: [], errors: [] };
  for (const [dbKey, dbId] of Object.entries(DB)) {
    const rows = await queryAll(dbId);
    for (const row of rows) {
      for (const group of GROUPS[dbKey]) {
        await processRow(dbKey, row, group, report);
      }
    }
  }

  console.log(`\n=== VIEMAG auto-translate ${APPLY ? '(APPLIED)' : '(DRY RUN — pass --apply to write)'} ===`);
  console.log(`model: ${MODEL} · banned-terms: ${BANNED.length}\n`);
  console.log(`Would fill ${report.filled.length} field(s):`);
  report.filled.forEach((l) => console.log('  + ' + l));
  if (report.blocked.length) { console.log(`\nBlocked ${report.blocked.length} (banned term in output):`); report.blocked.forEach((l) => console.log('  ✗ ' + l)); }
  if (report.errors.length)  { console.log(`\nErrors ${report.errors.length}:`); report.errors.forEach((l) => console.log('  ! ' + l)); }
}

main().catch((e) => { console.error(e); process.exit(1); });
