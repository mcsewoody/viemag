# Notion → data.js pipeline

`js/data.js` is **generated** from the Notion workspace **「VIEMAG 後台」**.
Edit content in Notion, then run the exporter — never hand-edit `js/data.js`.

## What it does

`scripts/export-notion.mjs` reads four Notion databases (Products, Categories,
Scenarios, FAQ) and writes `js/data.js`. `personas`, `tests`, and `config`
have no Notion source and are kept as static blocks inside the script.

**Security:** this repo is public. The exporter only emits whitelisted public
fields. Internal fields (gross margin, promo floor, inventory, cost) are never
read or written. Do not add them to the exporter.

## One-time setup (you must do this — tokens are yours)

1. Create a Notion **internal integration**: https://www.notion.so/my-integrations
   → New integration → Internal → copy the token (`ntn_...` / `secret_...`).
2. Give it access to the content: open the **「VIEMAG 後台」** page in Notion →
   **•••  → Connections → add your integration**. (Access flows to the 10 DBs.)
3. Add the token as a **GitHub repo secret**: repo → Settings → Secrets and
   variables → Actions → New repository secret → name `NOTION_TOKEN`, paste value.

## Run it

- **In CI:** Actions tab → *Export Notion → data.js* → **Run workflow**.
  It regenerates `js/data.js`, commits if changed, and GitHub Pages redeploys.
  (Also runs daily at 01:00 UTC — edit the cron in the workflow to change/disable.)
- **Locally:** `NOTION_TOKEN=secret_xxx node scripts/export-notion.mjs`
  then commit `js/data.js` yourself.

## Field mapping (Notion → data.js)

| data.js | Notion (DB · property) |
|---|---|
| product `sku` | Products · Official SKU Code |
| product `name/claim` {en,vi,id,zh} | Name EN/VI/ID/ZH · Claim EN/VI/ID/ZH |
| product `category` | Public Category (relation → Categories.Slug) |
| product `scenarios` | Scenario (relation → Scenarios.Scenario Code) |
| product `tier/status` | Launch Tier (`Future` ⇒ status `future`) |
| product `qi/watt/mount` | Qi Status / Charging Watt / Mount Type |
| product `price/rating/reviews/badge` | Price USD / Rating / Review Count / Badge |
| product `personas` · `art` | Persona (multi-select) · Art Key |
| category `id/cat/sort/status/art` | Slug / Internal CAT Mapping / Sort Order / Public·Internal / Art Key |
| scenario `code/id/priority/status/icon/combo` | Scenario Code / Slug / Priority / Status / Icon / Combo SKUs |
| faq `id/q/a` | FAQ Key / Question EN·VI·ID·ZH / Answer EN·VI·ID·ZH |

Notes:
- **zh-Hans** is not stored in Notion — it auto-converts from zh at runtime
  (see `js/main.js`). Hand-tune Simplified only in the front-end override layer.
- Publish gating: Categories/FAQ with Status `Hidden`/not `Published` and
  Scenarios `Hidden` are dropped from the export.
