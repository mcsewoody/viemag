# Supabase → data.js pipeline

`js/data.js` is **generated** from the VIEMAG Supabase project.
Edit content in **`/admin`**, never hand-edit `js/data.js` — it's overwritten
on the next export.

## What it does

`supabase/functions/export-site-data/index.ts` (a Supabase Edge Function)
reads `products`, `categories`, `scenarios`, `faq` (+ the `product_scenarios`
join table) and writes `js/data.js` by committing directly to this repo via
the GitHub Contents API. `personas`, `tests`, and `config` have no Supabase
source and are kept as static blocks inside the function, same as the old
Notion-era script.

**Trigger:** `/admin` calls the function automatically right after a save or
delete on Products/Categories/Scenarios/FAQ (see `admin/admin.js`,
`triggerExportIfNeeded`). There is no schedule — it's on-demand, not polling.

**Security:** this repo is public. The function only emits whitelisted public
fields. Internal fields (gross margin, promo floor, inventory, cost) are never
read or written. Do not add them.

## One-time setup (already done for this project — for reference only)

1. `supabase functions deploy export-site-data --project-ref <ref>`
2. Create a GitHub **fine-grained PAT** scoped to just this repo, permission
   `Contents: Read and write` only (do not use a broad personal token).
3. `supabase secrets set GITHUB_PAT=<token> --project-ref <ref>`
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are
   auto-injected by the platform — never set those yourself.)

## Run it manually (rare — normally /admin triggers this)

```
curl -X POST "https://<project-ref>.supabase.co/functions/v1/export-site-data" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <a logged-in user's access token>"
```
Must be called with a real signed-in user's token — `anon` alone is rejected
(401). Returns `{"committed": true/false, "message": "..."}`.

## Field mapping (Supabase → data.js)

| data.js | Supabase (table · column) |
|---|---|
| product `sku` | products · official_sku_code |
| product `name/claim` {en,vi,id,zh} | name_en/vi/id/zh · claim_en/vi/id/zh |
| product `category` | category_id (FK → categories.id, exported as categories.slug) |
| product `scenarios` | product_scenarios join → scenarios.scenario_code |
| product `tier/status` | launch_tier (`Future` ⇒ status `future`) |
| product `qi/watt/mount` | qi_status / charging_watt / mount_type |
| product `price/rating/reviews/badge` | price_usd / rating / review_count / badge |
| product `personas` · `art` | persona (array) · art_key |
| category `id/cat/sort/status/art` | slug / internal_cat_mapping / sort_order / visibility / art_key |
| scenario `code/id/priority/status/icon/combo` | scenario_code / slug / priority / status / icon / combo_skus |
| faq `id/q/a` | faq_key / question_en·vi·id·zh / answer_en·vi·id·zh |

Notes:
- **zh-Hans** is not stored in Supabase — it auto-converts from zh at runtime
  (see `js/main.js`). Hand-tune Simplified only in the front-end override layer.
- Publish gating: Categories/FAQ with status `Hidden`/not `Published` and
  Scenarios `Hidden` are dropped from the export. Products use `launch_tier`
  (not the `status` column) to decide `published` vs `future` — same
  long-standing behavior as the old Notion-era script.
- Products query is explicitly `.order('product_id')` for a stable, repeatable
  export order (fixed 2026-07-28 — Postgres gives no ordering guarantee
  without it, which briefly shuffled the homepage's featured-product order).

## Retired (2026-07-28)

Notion is no longer the backend. `scripts/export-notion.mjs`,
`scripts/translate-notion.mjs`, and `.github/workflows/notion-export.yml` were
deleted (recoverable from git history if ever needed). The `NOTION_TOKEN`
GitHub repo secret should be deleted manually (Settings → Secrets and
variables → Actions) — Claude's GitHub PAT is scoped to Contents only and
cannot manage repo secrets. Consider also revoking the Notion integration
token itself in Notion's own integration settings.
