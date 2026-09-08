// VIEMAG — translate one language's text into the other three, via DeepL
//
// Backs the "翻譯" (Translate) button next to each language cell in /admin's
// name/claim fields: take whichever language the operator just wrote, and fill
// the other three in automatically. DeepL was picked over an LLM (2026-08-05,
// Woody's call) because these are short, already brand-reviewed strings — the
// translation risk here is fidelity, not brand voice, and DeepL's free tier
// (500k chars/month) costs nothing at this catalog's scale. An LLM-based
// translator with brand-voice awareness in the prompt would be worth it for
// longer content (Insights articles) if that's ever built, but is overkill
// here.
//
// 2026-09-08: the button now also serves product_article_*, which is long-form
// HTML from a WYSIWYG editor rather than a short line of plain text. That is
// the `html: true` path — see deeplTranslate. The reasoning above is worth
// revisiting for it: an article is exactly the "longer content" the last
// paragraph says an LLM would suit better, and it is the one field here where
// brand voice is a real risk. Left on DeepL for now because it is what already
// works and costs nothing; if article translations start reading flat, that is
// the trade-off talking, not a bug.
//
// Secrets required (Supabase Function secrets, never client-side):
//   DEEPL_API_KEY    the API key from your DeepL account
//   DEEPL_API_HOST    optional, defaults to the Free-tier host below. Set this
//                      to https://api.deepl.com if the account is ever
//                      upgraded to Pro — a secret change, not a redeploy.
//
// SUPABASE_URL / SUPABASE_ANON_KEY are auto-injected by the platform.
//
// This function requires only "signed in", not "owner" — translation is not a
// sensitive operation (it never touches product_development or any internal
// field), so any authenticated staff member may use it. Compare
// export-site-data's verifyCaller, reused verbatim here.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEEPL_API_KEY = Deno.env.get('DEEPL_API_KEY');
const DEEPL_API_HOST = Deno.env.get('DEEPL_API_HOST') || 'https://api-free.deepl.com';

// Internal 4-language keys (matching every en/vi/id/zh column pair in schema.js)
// mapped to DeepL's own codes. zh maps to ZH-HANT specifically, not bare ZH —
// CLAUDE.md's rule is Traditional-authored content with Simplified generated
// from it at render time (js/main.js T2S), never the other way around. Asking
// DeepL for bare ZH risks a Simplified reply that would silently violate that
// pipeline.
const DEEPL_TARGET: Record<string, string> = { en: 'EN', vi: 'VI', id: 'ID', zh: 'ZH-HANT' };
// DeepL only needs the bare language for SOURCE (no variant needed even for
// zh — it reads Traditional or Simplified input as Chinese source either way).
const DEEPL_SOURCE: Record<string, string> = { en: 'EN', vi: 'VI', id: 'ID', zh: 'ZH' };

const LANGS = ['en', 'vi', 'id', 'zh'];
// A name or claim is one short line; accessories is a handful of short lines.
// Neither is a paragraph. Capped well above any real use so a future accidental
// reuse of this button on a large textarea (e.g. article body) fails loudly
// instead of quietly burning the monthly character quota on one call.
// Still true of every PLAIN-TEXT field. The article body stopped being the
// accident this was written to catch and became a supported case, but it takes
// the `html: true` path and MAX_HTML_LENGTH below — so this number keeps doing
// its original job here, and raising it would give that job up for nothing.
const MAX_INPUT_LENGTH = 2000;
// DeepL accepts up to 50 text elements per request. Lines beyond that mean the
// button is being used on something it was not designed for.
const DEEPL_MAX_TEXTS = 50;
// The separate ceiling for `html: true` (the product_article_* editor, which
// stores sanitized HTML). This is applied AFTER media blocks are protected, so
// long Supabase image URLs and YouTube/video embeds do not make an otherwise
// reasonable article fail the size guard.
const MAX_HTML_LENGTH = 12000;

/* The HTML path sends the whole article as ONE text element, so the N-in/N-out
   assertion below degenerates to 1 === 1 and stops asserting anything. The
   failure it guards against has not gone away — it moved from line count to tag
   structure. DeepL's HTML handler is known to occasionally drop or relocate
   elements, and outline_detection is free to reorder tags to suit the target
   language's word order. A translated paragraph landing in the wrong place is
   an edit; a silently deleted <figure> is an image gone from viemag.biz that
   nobody notices until a customer does.

   Counted with String.match, never .test() — this literal is shared and /g
   regexes carry lastIndex across .test() calls.

   The one check for this file, against a deployed function:

     curl -sS -X POST "$SUPABASE_URL/functions/v1/translate-text" \
       -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
       -d '{"source":"vi","html":true,"text":"<p>Xin chào</p><figure class=\"rich-image wide\"><img src=\"https://example.com/a.png\" alt=\"\"></figure>"}'

   Every translation in the reply must still contain `rich-image wide`, exactly
   one `<img`, and the unchanged example.com URL. If tag_handling stops being
   sent, the reply comes back with those translated into prose instead. */
const STRUCT_TAGS = /<(?:figure|img|iframe|video|hr)\b/gi;
const MEDIA_HTML = /<figure\b(?=[^>]*\b(?:rich-image|rich-youtube|rich-video)\b)[^>]*>[\s\S]*?<\/figure>|<video\b[\s\S]*?<\/video>|<iframe\b[\s\S]*?<\/iframe>|<img\b[^>]*>/gi;
const MEDIA_PLACEHOLDER = /<x-viemag-skip\b[^>]*\bdata-i=(?:"|')?(\d+)(?:"|')?[^>]*>\s*<\/x-viemag-skip>/gi;

/* "Is there anything to translate here?" — asked of the text CONTENT, not the
   string length. An empty article is not '': the rich editor stores the literal
   `<p><br></p>` (admin/admin.js), which is 11 truthy characters. Without this,
   translating an empty cell overwrites the other three languages — which may be
   thousands of characters of real, hand-checked copy — with the translation of
   nothing. Also covers `<p></p>` and `<p>&nbsp;</p>`. Mirrored in
   admin/admin.js's runTranslateButton so the operator is told before the round
   trip; kept here too because the guard has to hold for any caller. */
function hasTranslatableText(text: string): boolean {
  return /\S/.test(text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' '));
}

function protectMediaHtml(html: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = html.replace(MEDIA_HTML, (block) => {
    const i = blocks.push(block) - 1;
    return `<x-viemag-skip data-i="${i}"></x-viemag-skip>`;
  });
  return { text, blocks };
}

function restoreMediaHtml(html: string, blocks: string[]): string {
  const seen = new Set<number>();
  const restored = html.replace(MEDIA_PLACEHOLDER, (_match, rawIndex) => {
    const i = Number(rawIndex);
    if (!Number.isInteger(i) || i < 0 || i >= blocks.length) return '';
    seen.add(i);
    return blocks[i];
  });
  if (seen.size !== blocks.length) {
    throw new Error(`DeepL returned ${seen.size} protected media blocks for ${blocks.length} in the source`);
  }
  return restored;
}

function translatableRequestLength(text: string, asHtml: boolean): number {
  return asHtml ? protectMediaHtml(text).text.length : text.length;
}

async function verifyCaller(req: Request): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false, reason: 'missing Authorization header' };
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data.user) return { ok: false, reason: 'not signed in' };
  return { ok: true };
}

/* One DeepL text element PER LINE, not one blob for the whole field.
   `accessories` is a list: the line breaks are what make it a list, and the
   product page splits on them. DeepL's default split_sentences treats newlines
   as sentence boundaries, and whether they survive into the response is not
   something worth betting a live page on — if they are dropped, three
   accessories silently become one run-on entry, and the failure shows up on
   viemag.biz rather than here. N elements in, N results out, asserted below.

   For a single-line name or claim this is an array of one, so the request and
   the result are byte-for-byte what they were before.

   Blank lines keep their position and are never sent: DeepL has nothing to do
   with an empty string, and sending one would just consume an element slot.

   None of that applies to `asHtml`. A product article is sanitized HTML, and
   splitting HTML on newlines would hand DeepL fragments of markup: the line
   boundaries there are incidental (real articles carry stray \n inside a <p>),
   while the tags are the structure. So the whole article goes as ONE element
   with tag_handling, with media blocks replaced by ignored placeholder tags.
   Images and video embeds do not need translation, and keeping their URLs out
   of DeepL reduces quota risk and prevents accidental media markup edits. */
async function deeplTranslate(text: string, sourceLang: string, targetLang: string, asHtml: boolean): Promise<string> {
  const protectedHtml = asHtml ? protectMediaHtml(text) : null;
  const lines = asHtml ? [protectedHtml!.text] : text.split('\n');
  const sendAt: number[] = [];
  const payload: string[] = [];
  lines.forEach((line, i) => {
    if (line.trim()) { sendAt.push(i); payload.push(line); }
  });
  if (!payload.length) return '';
  if (payload.length > DEEPL_MAX_TEXTS) {
    throw new Error(`too many lines to translate (${payload.length} > ${DEEPL_MAX_TEXTS})`);
  }

  const res = await fetch(`${DEEPL_API_HOST}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    /* tag_handling_version defaults to v1, so v2 has to be asked for by name —
       it is not the redundant belt-and-braces it looks like. split_sentences is
       deliberately left off: html mode already defaults it to `nonewlines`,
       which is the right choice here precisely because article HTML carries
       stray literal newlines that mean nothing. */
    body: JSON.stringify({
      text: payload,
      source_lang: sourceLang,
      target_lang: targetLang,
      ...(asHtml ? { tag_handling: 'html', tag_handling_version: 'v2', ignore_tags: ['x-viemag-skip'] } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepL ${targetLang} failed: ${res.status} ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = data.translations ?? [];
  /* A mismatch means the line-to-line mapping is not what this code assumes, so
     writing the results back would scramble which item is which. Fail instead. */
  if (out.length !== payload.length) {
    throw new Error(`DeepL ${targetLang} returned ${out.length} results for ${payload.length} lines`);
  }
  sendAt.forEach((lineNo, k) => { lines[lineNo] = out[k]?.text ?? ''; });
  const result = asHtml ? restoreMediaHtml(lines.join('\n'), protectedHtml!.blocks) : lines.join('\n');

  if (asHtml) {
    const before = (text.match(STRUCT_TAGS) || []).length;
    const after = (result.match(STRUCT_TAGS) || []).length;
    if (before !== after) {
      throw new Error(`DeepL ${targetLang} returned ${after} media/structural tags for ${before} in the source`);
    }
  }
  return result;
}

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!DEEPL_API_KEY) return json({ error: 'DEEPL_API_KEY is not configured on this function' }, 500);

    const auth = await verifyCaller(req);
    if (!auth.ok) return json({ error: auth.reason }, 401);

    const body = await req.json().catch(() => null);
    const text = body?.text;
    const source = body?.source;
    /* Whether this field holds HTML is the CALLER's answer, not something to
       sniff for here. /admin knows for certain — the article editor's textarea
       carries a `rich-source` class — and sniffing would need a third copy of
       the HTML-detection regex that already lives in admin/admin.js and
       js/main.js. That regex also has a false positive this path cannot afford:
       a claim reading "Charges <a phone> in 30 min" matches `<a\b` and would be
       handed to DeepL as markup instead of being translated. Defaults to false,
       so an older caller that does not send the flag behaves exactly as before. */
    const asHtml = body?.html === undefined ? false : body.html;
    if (typeof text !== 'string' || !hasTranslatableText(text)) return json({ error: 'text is required' }, 400);
    if (typeof asHtml !== 'boolean') return json({ error: 'html must be true or false' }, 400);
    const cap = asHtml ? MAX_HTML_LENGTH : MAX_INPUT_LENGTH;
    if (translatableRequestLength(text, asHtml) > cap) return json({ error: `text exceeds ${cap} characters` }, 400);
    if (typeof source !== 'string' || !LANGS.includes(source)) return json({ error: `source must be one of ${LANGS.join(', ')}` }, 400);

    const targets = LANGS.filter((l) => l !== source);
    const results = await Promise.all(
      targets.map((l) => deeplTranslate(text, DEEPL_SOURCE[source], DEEPL_TARGET[l], asHtml).then((t) => [l, t] as const)),
    );

    const out: Record<string, string> = {};
    for (const [lang, translated] of results) out[lang] = translated;
    return json({ translations: out });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
