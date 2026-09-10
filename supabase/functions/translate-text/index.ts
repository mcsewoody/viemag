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
// Product articles and technical notes are real translation surfaces now, so the
// old 2,000-character guard would reject normal catalog work. Keep a generous
// client-facing cap to avoid accidental quota burns, then batch DeepL requests
// below its per-request text-element limit.
const MAX_INPUT_LENGTH = 50000;
const DEEPL_MAX_TEXTS = 50;
const DEEPL_BATCH_TEXTS = 45;
const DEEPL_BATCH_CHARS = 24000;

function shouldPreserveLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^(?:---|\*\s*\*\s*\*)$/.test(trimmed)) return true;
  if (/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(trimmed)) return true;
  if (/^!\[[^\]]*\]\([^)]+\)(?:\{(?:wide|left|right)\})?$/i.test(trimmed)) return true;
  if (/^<figure\b[\s\S]*<\/figure>$/i.test(trimmed) && /<(?:img|iframe|video)\b/i.test(trimmed)) return true;
  if (/^<(?:img|iframe|video)\b[\s\S]*>$/i.test(trimmed)) return true;
  return false;
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

   Blank lines and media-only/format-only lines keep their position and are never
   sent: DeepL has nothing useful to do with an image URL, iframe, divider, or
   table separator, and translating those can break the exact markup/layout the
   public renderer expects. */
async function deeplTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const lines = text.split('\n');
  const sendAt: number[] = [];
  const payload: string[] = [];
  lines.forEach((line, i) => {
    if (!shouldPreserveLine(line)) { sendAt.push(i); payload.push(line); }
  });
  if (!payload.length) return '';

  const batches: string[][] = [];
  let batch: string[] = [];
  let batchChars = 0;
  for (const item of payload) {
    const itemChars = item.length;
    if (batch.length && (batch.length >= DEEPL_BATCH_TEXTS || batchChars + itemChars > DEEPL_BATCH_CHARS)) {
      batches.push(batch);
      batch = [];
      batchChars = 0;
    }
    batch.push(item);
    batchChars += itemChars;
  }
  if (batch.length) batches.push(batch);

  const translated: string[] = [];
  const tagHandling = /<\/?[a-z][\s\S]*>/i.test(text) ? 'html' : undefined;
  for (const part of batches) {
    if (part.length > DEEPL_MAX_TEXTS) {
      throw new Error(`too many lines in one DeepL batch (${part.length} > ${DEEPL_MAX_TEXTS})`);
    }
    const body: Record<string, unknown> = { text: part, source_lang: sourceLang, target_lang: targetLang };
    if (tagHandling) body.tag_handling = tagHandling;
    const res = await fetch(`${DEEPL_API_HOST}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepL ${targetLang} failed: ${res.status} ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const out = data.translations ?? [];
    /* A mismatch means the line-to-line mapping is not what this code assumes, so
       writing the results back would scramble which item is which. Fail instead. */
    if (out.length !== part.length) {
      throw new Error(`DeepL ${targetLang} returned ${out.length} results for ${part.length} lines`);
    }
    translated.push(...out.map((x: { text?: string }) => x?.text ?? ''));
  }
  sendAt.forEach((lineNo, k) => { lines[lineNo] = translated[k] ?? ''; });
  return lines.join('\n');
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
    if (typeof text !== 'string' || !text.trim()) return json({ error: 'text is required' }, 400);
    if (text.length > MAX_INPUT_LENGTH) return json({ error: `text exceeds ${MAX_INPUT_LENGTH} characters` }, 400);
    if (typeof source !== 'string' || !LANGS.includes(source)) return json({ error: `source must be one of ${LANGS.join(', ')}` }, 400);

    const targets = LANGS.filter((l) => l !== source);
    const results = await Promise.all(
      targets.map((l) => deeplTranslate(text, DEEPL_SOURCE[source], DEEPL_TARGET[l]).then((t) => [l, t] as const)),
    );

    const out: Record<string, string> = {};
    for (const [lang, translated] of results) out[lang] = translated;
    return json({ translations: out });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
