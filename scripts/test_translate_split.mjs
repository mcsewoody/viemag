/* Check the line-splitting half of supabase/functions/translate-text — the part
   that decides what DeepL sees and what is kept byte-for-byte.
   Run: node scripts/test_translate_split.mjs

   The two functions are lifted out of index.ts at run time and type-stripped with
   node:module, so this test cannot drift away from the deployed source. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const SRC = new URL('../supabase/functions/translate-text/index.ts', import.meta.url);
const src = readFileSync(SRC, 'utf8');
const start = src.indexOf('function splitHtmlBlocks');
const end = src.indexOf('async function verifyCaller');
assert.ok(start !== -1 && end > start, 'could not locate splitHtmlBlocks/shouldPreserveLine in index.ts');

const js = stripTypeScriptTypes(src.slice(start, end) + '\nexport { splitHtmlBlocks, shouldPreserveLine };');
const { splitHtmlBlocks, shouldPreserveLine } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

/* What the admin rich editor really produces: cleanArticleHtml() emits ONE line
   with no newlines anywhere, so splitting on '\n' alone would hand DeepL the
   whole article as a single text element. */
const ARTICLE = [
  '<h2>Sạc nam châm cho iPhone</h2>',
  '<p>Đế sạc <strong>MagSafe</strong> giữ chặt máy khi đang sạc.</p>',
  '<figure class="rich-image wide"><img src="https://x.supabase.co/a.webp" alt="" loading="lazy"></figure>',
  '<section class="rich-split image-left"><figure class="rich-image wide"><img src="https://x.supabase.co/b.webp" alt="" loading="lazy"></figure><div class="rich-copy"><p>Nam châm N52 giữ lực hút 1.2 kg.</p></div></section>',
  '<ul><li>Sạc nhanh 15W</li><li>Chống trượt</li></ul>',
  '<figure class="rich-youtube" data-youtube="https://www.youtube.com/embed/abcdefghijk"><iframe src="https://www.youtube.com/embed/abcdefghijk" title="YouTube video" loading="lazy" allowfullscreen></iframe></figure>',
  '<p>Bảo hành 12 tháng.</p>',
].join('');

const chunks = splitHtmlBlocks(ARTICLE);

// 1. Nothing is lost or reordered: the chunks must rebuild the article exactly.
assert.equal(chunks.join(''), ARTICLE, 'chunks do not rebuild the original article');

// 2. Every top-level block is its own chunk — otherwise one 5,000-word element
//    goes to DeepL and comes back as a single blob we cannot map positionally.
assert.ok(chunks.length >= 7, `expected one chunk per block, got ${chunks.length}`);

// 3. No chunk ends mid-tag.
chunks.forEach((c) => {
  const opens = (c.match(/</g) || []).length;
  const closes = (c.match(/>/g) || []).length;
  assert.equal(opens, closes, `chunk splits a tag: ${c.slice(0, 60)}`);
});

// 4. Media-only blocks are never sent to DeepL; text blocks always are.
const sent = chunks.filter((c) => !shouldPreserveLine(c));
const held = chunks.filter((c) => shouldPreserveLine(c));
assert.ok(held.some((c) => c.includes('rich-youtube')), 'YouTube figure was sent to DeepL');
assert.ok(held.some((c) => c.includes('a.webp')), 'standalone image figure was sent to DeepL');
assert.ok(sent.some((c) => c.includes('Sạc nam châm')), 'heading was not sent to DeepL');
assert.ok(sent.some((c) => c.includes('rich-split')), 'split section (image + copy) was not sent to DeepL');
assert.ok(sent.some((c) => c.includes('Sạc nhanh 15W')), 'list was not sent to DeepL');

/* 5. The blank-result bug, kept as a regression case.
   An article that opens with a lead image and closes with a figure is ONE line
   starting with "<figure" and ending with "</figure>", so shouldPreserveLine's
   greedy [\s\S]* matched the WHOLE article — every word of it was withheld from
   DeepL, the payload came out empty, and all three languages were filled with an
   empty string. Splitting into blocks first is what makes the check per-block. */
const LEAD_IMAGE_ARTICLE = [
  '<figure class="rich-image wide"><img src="https://x.supabase.co/lead.webp" alt="" loading="lazy"></figure>',
  '<p>Đế sạc giữ máy chắc chắn khi đang sạc.</p>',
  '<figure class="rich-youtube" data-youtube="https://www.youtube.com/embed/abcdefghijk"><iframe src="https://www.youtube.com/embed/abcdefghijk" title="YouTube video" loading="lazy" allowfullscreen></iframe></figure>',
].join('');
assert.ok(shouldPreserveLine(LEAD_IMAGE_ARTICLE), 'precondition of the old bug no longer holds — rewrite this case');
const leadChunks = splitHtmlBlocks(LEAD_IMAGE_ARTICLE);
const leadSent = leadChunks.filter((c) => !shouldPreserveLine(c));
assert.equal(leadSent.length, 1, 'the paragraph between two figures must still reach DeepL');
assert.ok(leadSent[0].includes('Đế sạc'), 'wrong block sent to DeepL');

// 6. Plain multi-line text (accessories, claim) still splits per line, unchanged.
const plain = splitHtmlBlocks('Cáp USB-C\nSách hướng dẫn\n\nTúi vải');
assert.deepEqual(plain, ['Cáp USB-C', 'Sách hướng dẫn', '', 'Túi vải']);
assert.ok(shouldPreserveLine(''), 'blank line should be preserved, not sent');

console.log(`ok — ${chunks.length} blocks, ${sent.length} sent to DeepL, ${held.length} kept verbatim`);
