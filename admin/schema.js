/* VIEMAG Admin — table schema descriptors.
   Drives the generic list/edit UI: one definition per Supabase table.
   field.type: text | textarea | number | boolean | date | select |
               multiselect | image | images | relation | relation_many
   field.internal: true -> flagged in the form as staff-only; these values are
               never part of the public site export.
   field.desc: what this field actually does, shown next to it in /admin.
               English is the master copy; admin/field-i18n.js supplies
               zh-Hant / zh-Hans / vi translations, falling back to this
               English text when a translation is missing.

   NOTE: this file is served publicly (it is inside the GitHub Pages repo, so
   https://viemag.biz/admin/schema.js is fetchable by anyone). It must
   therefore contain no confidential values and no field names that reveal
   anything the brand rules say to keep private. Login protects the DATA, not
   this file. */
window.VIEMAG_SCHEMA = {
  /* The product editor is the only three-tab form in /admin, and the tabs are a
     permission boundary, not decoration:
       front  fields that reach viemag.biz            — all staff
       sales  internal sales reference                — all staff
       dev    development + cost (product_development) — OWNERS ONLY, via RLS
     Because every field in `sales` is internal and every field in `dev` is
     internal, the per-field red "internal" tag would appear on all of them and
     stop carrying information — the tab itself now says it. `internal: true`
     stays in the data because scripts/audit-field-parity.mjs reads it; only the
     DISPLAY moved up to the tab. Other tables are still mixed, so they keep the
     per-field tag.

     A group's `fields` entry may be a NAME or an ARRAY of names. An array is
     laid out as one row of side-by-side inputs sharing the first field's
     description — used for the four-language sets, so a missing translation sits
     visibly next to its filled siblings instead of being three scrolls away. */
  products: {
    title: 'product_id',
    order: 'product_id',
    thumb: 'hero_image_url',
    thumbFallback: 'art_key',   // no photo yet → show which illustration the site uses
    listCols: ['name_en'],      // extra list-view columns beyond title/status
    statusFilter: true,         // status now also marks pipeline items, so the list needs filtering
    tabs: [
      { key: 'front', groups: [
        { key: 'ident',     fields: ['product_id', 'official_sku_code', 'slug', 'status', 'launch_tier', 'category_id'] },
        { key: 'naming',    fields: [['name_en', 'name_vi', 'name_id', 'name_zh'],
                                    ['claim_en', 'claim_vi', 'claim_id', 'claim_zh']] },
        { key: 'commerce',  fields: ['price_usd', 'shopee_url'] },
        { key: 'targeting', fields: ['persona', 'consumer_pain_point', 'scenario_ids'] },
        { key: 'spec',      fields: ['mount_type', 'charging_watt', 'qi_status', 'warranty_months', 'defect_exchange_days'] },
        { key: 'media',     fields: ['hero_image_url', 'gallery_urls', 'spec_sheet_url', 'art_key'] },
        { key: 'card',      fields: ['badge', 'rating', 'review_count'] },
        { key: 'links',     fields: ['test_report_ids', 'faq_ids', 'related_product_ids'] },
        /* Collapsed by default: all eight are optional and the site composes a
           sensible fallback from the product name and claim when they are blank,
           so an open block of eight empty fields only manufactures anxiety.
           `card` is deliberately NOT collapsed — misusing `badge` (bestseller
           with no review data behind it) is something the brand rules forbid
           outright, so that group stays in plain sight. */
        { key: 'seo', collapsed: true, fields: [['seo_title_en', 'seo_title_vi', 'seo_title_id', 'seo_title_zh'],
                                                ['seo_description_en', 'seo_description_vi', 'seo_description_id', 'seo_description_zh']] },
      ] },
      { key: 'sales', groups: [
        { key: 'priceBand', fields: ['msrp_usd_min', 'msrp_usd_max', 'map_usd', 'wsp_usd'] },
        { key: 'margin',    fields: ['sales_cost_usd', 'target_gross_margin', 'minimum_gross_margin', 'actual_gross_margin'] },
        { key: 'channel',   fields: ['distributor'] },
        { key: 'record',    fields: ['owner', 'last_reviewed'] },
      ] },
      { key: 'dev', table: 'product_development', ownerOnly: true, groups: [
        { key: 'costStack', fields: ['purchase_cost_usd', 'packaging_cost_usd', 'inspection_cost_usd', 'freight_cost_usd',
                                     'licensing_fee_usd', 'patent_fee_usd', 'tooling_amortization_usd', 'other_cost_usd',
                                     'cost_note', 'sales_cost_usd'] },
        { key: 'project',   fields: ['supplier', 'design_link', 'inventory_first_batch', 'certification_notes'] },
      ] },
    ],
    fields: [
      { name: 'product_id', type: 'text', required: true, desc: 'Internal SKU code, unique per product. If official_sku_code is blank, the front end uses this value as the SKU shown to visitors.' },
      { name: 'official_sku_code', type: 'text', desc: 'The SKU shown to customers and used in the product page URL (?sku=). Do not put an internal-only code here.' },
      { name: 'slug', type: 'text', required: true, desc: 'URL-friendly short name. The site currently links products by ?sku=, so this is reserved for future per-language URLs; changing it will not break anything yet, but will once those exist.' },
      { name: 'status', type: 'select', options: ['Development', 'Draft', 'Review', 'Published', 'Hidden', 'Discontinued'], desc: 'Controls whether this product appears on the site at all — only Published is shown. Development means the product does not exist yet and is still being sourced or tooled; Draft means it exists but its copy is unfinished. Keeping those apart is what lets the list answer "how many projects are running".' },
      { name: 'launch_tier', type: 'select', options: ['A - Core', 'B - Test', 'C - Display', 'Future'], desc: 'Controls whether the product can be bought yet. Future shows as a "coming soon" card with no price or buy button. The other three values are an internal launch classification.' },
      { name: 'category_id', type: 'relation', table: 'categories', labelField: 'category_name', desc: 'Which product category this belongs to. Decides the breadcrumb, the category page listing, and the ?cat= filter result. Also the single source of this product’s CAT-A to CAT-E classification, through the category’s internal_cat_mapping.' },
      { name: 'persona', type: 'multiselect', options: ['commuter', 'homeoffice', 'traveler', 'creator'], desc: 'Which customer types this product suits. Drives the "by who you are" filter on the product listing and the count shown on each persona card.' },
      { name: 'name_en', type: 'text', desc: 'Product name. Shown on the product card, the product page title, the breadcrumb and the browser tab title. All four languages sit side by side — an empty box here is a missing translation on a live page.' },
      { name: 'name_vi', type: 'text', desc: 'Product name (Vietnamese).' },
      { name: 'name_id', type: 'text', desc: 'Product name (Indonesian).' },
      { name: 'name_zh', type: 'text', desc: 'Product name (Traditional Chinese).' },
      { name: 'claim_en', type: 'textarea', desc: 'One-line selling point — the single most-seen piece of copy on the whole site. Shown under the name on the product card and product page.' },
      { name: 'claim_vi', type: 'textarea', desc: 'One-line selling point (Vietnamese).' },
      { name: 'claim_id', type: 'textarea', desc: 'One-line selling point (Indonesian).' },
      { name: 'claim_zh', type: 'textarea', desc: 'One-line selling point (Traditional Chinese).' },
      { name: 'consumer_pain_point', type: 'multiselect', options: ['Dropping', 'Heat', 'Loose', 'Compatibility', 'Cable Mess'], desc: 'Which problems this product solves, picked from a fixed set of five tags. Shown as chips in a "Solves" section on the product page.' },
      { name: 'shopee_url', type: 'text', desc: 'Link to this product on Shopee — the destination of the "Buy on Shopee" button. Leave blank and the button points at a dead link (#).' },
      { name: 'price_usd', type: 'number', desc: 'Price shown on the site. Also the basis of the gross-margin figure in the sales tab.' },
      { name: 'msrp_usd_min', type: 'number', internal: true, desc: 'Suggested retail price, lower bound of the band.' },
      { name: 'msrp_usd_max', type: 'number', internal: true, desc: 'Suggested retail price, upper bound of the band.' },
      { name: 'map_usd', type: 'number', internal: true, desc: 'Minimum Advertised Price: the lowest price this product may be advertised or promoted at. Replaces the old promo_floor, which was documented as a price but typed as a ratio, so any realistic value was rejected.' },
      { name: 'wsp_usd', type: 'number', internal: true, desc: 'Wholesale Selling Price offered to distributors.' },
      { name: 'sales_cost_usd', type: 'computed', compute: 'salesCost', internal: true, desc: 'The sum of the eight cost components on the development tab, shown here read-only. Sales needs a cost basis to quote against; the breakdown itself stays behind the owner-only wall. Blank means no cost has been entered yet.' },
      { name: 'target_gross_margin', type: 'number', unit: '%', internal: true, desc: 'Target gross margin as a PERCENT — enter 35, not 0.35 — measured against the sales cost above.' },
      { name: 'minimum_gross_margin', type: 'number', unit: '%', internal: true, desc: 'Lowest gross margin considered acceptable, also a PERCENT. The actual margin below is flagged when it falls under this, but saving is never blocked: a clearance price under the floor is a business decision, and blocking it would only produce fake numbers.' },
      { name: 'actual_gross_margin', type: 'computed', compute: 'actualMargin', internal: true, desc: 'Calculated live from the site price and the sales cost, and stored nowhere — so it can never go stale. Shows nothing when no cost has been entered, rather than a flattering 100%.' },
      { name: 'distributor', type: 'text', internal: true, desc: 'Which distributor or channel partner handles this product.' },
      { name: 'mount_type', type: 'multiselect', options: ['Vent', 'Dashboard', 'Suction', 'Tape', 'Screen', 'Desktop'], desc: 'How the product mounts. Shown as chips on the product card and as a row in the spec table.' },
      { name: 'charging_watt', type: 'select', options: ['None', '15W', '25W', 'TBD'], desc: 'Charging wattage, shown in the spec table. Leave blank or set to None and that spec row does not appear.' },
      { name: 'qi_status', type: 'select', options: ['Not applicable', 'Compatible', 'Testing', 'Certified', 'Pending'], desc: 'Qi / Qi2 status. Only Certified displays a certification mark — never select it unless certification has actually been obtained.' },
      { name: 'warranty_months', type: 'number', desc: 'Warranty length in months. Feeds directly into the warranty copy on the site in all five languages. Leave blank to use the site-wide default (12).' },
      { name: 'defect_exchange_days', type: 'number', desc: 'Defect-exchange window in days. Also feeds the site copy in all five languages. Leave blank to use the site-wide default (14).' },
      { name: 'hero_image_url', type: 'image', desc: 'Main product photo. Leave blank and the site shows the built-in illustration for art_key instead — nothing breaks.' },
      { name: 'gallery_urls', type: 'images', desc: 'Additional product photos. There is no limit on how many. A thumbnail strip only appears on the product page once there are 2 or more photos including the main one.' },
      { name: 'spec_sheet_url', type: 'image', desc: 'Spec sheet file. When filled, a "Download spec sheet" link appears in the specs section — useful for dealer inquiries. This file is PUBLIC, so check the document’s title block carries no manufacturing-side information before uploading it.' },
      { name: 'art_key', type: 'select', options: ['vent', 'dash', 'suction', 'clip', 'tape', 'pro', 'carcharge', 'dashcharge', 'fancharge', 'suctioncharge', 'deskcharge', 'stand2in1', 'fold', 'ring', 'case', 'powerbank', 'stand', 'tripod'], desc: 'Which built-in illustration to show when there is no real photo. A wrong code means the site shows a blank image for this product.' },
      { name: 'badge', type: 'select', options: ['bestseller', 'new', 'soon'], desc: 'Corner badge on the product card. Do not use bestseller without real review data behind it.' },
      { name: 'rating', type: 'number', desc: 'Star rating. Leave blank and neither the card nor the product page shows a rating at all.' },
      { name: 'review_count', type: 'number', desc: 'Number of reviews, shown alongside the rating.' },
      { name: 'seo_title_en', type: 'text', desc: 'Search-result and browser-tab title. Leave any of the four blank and the site composes one from the product name automatically.' },
      { name: 'seo_title_vi', type: 'text', desc: 'Search-result and browser-tab title (Vietnamese). Leave blank to auto-compose.' },
      { name: 'seo_title_id', type: 'text', desc: 'Search-result and browser-tab title (Indonesian). Leave blank to auto-compose.' },
      { name: 'seo_title_zh', type: 'text', desc: 'Search-result and browser-tab title (Traditional Chinese). Leave blank to auto-compose.' },
      { name: 'seo_description_en', type: 'textarea', desc: 'Search-result summary. Leave any of the four blank and the site uses the selling point instead.' },
      { name: 'seo_description_vi', type: 'textarea', desc: 'Search-result summary (Vietnamese). Leave blank to fall back automatically.' },
      { name: 'seo_description_id', type: 'textarea', desc: 'Search-result summary (Indonesian). Leave blank to fall back automatically.' },
      { name: 'seo_description_zh', type: 'textarea', desc: 'Search-result summary (Traditional Chinese). Leave blank to fall back automatically.' },
      { name: 'last_reviewed', type: 'date', internal: true, desc: 'Date this record was last checked. Not published; it is here so anyone reading the record knows how current it is.' },
      { name: 'owner', type: 'text', internal: true, desc: 'Who owns this product record — the person to ask about it. Not published.' },
      { name: 'scenario_ids', type: 'relation_many', table: 'scenarios', labelField: 'scenario_name', joinTable: 'product_scenarios', joinKey: 'product_id', joinTargetKey: 'scenario_id', desc: 'Which usage scenarios this product belongs to. Decides which scenario pages it appears on, the ?scn= filter, and is also the basis for automatic "related products".' },
      { name: 'test_report_ids', type: 'relation_many', table: 'test_reports', labelField: 'title_en', joinTable: 'product_test_reports', joinKey: 'product_id', joinTargetKey: 'test_report_id', desc: 'Which test reports to show on this product page. Many-to-many — one report can be attached to several products. A report that has not cleared both publish gates will not appear even if selected here.' },
      { name: 'faq_ids', type: 'relation_many', table: 'faq', labelField: 'faq_key', joinTable: 'product_faqs', joinKey: 'product_id', joinTargetKey: 'faq_id', desc: 'This product’s own FAQ, shown as a dedicated section on the product page. Leave empty and visitors instead see the site-wide FAQ list on the support page.' },
      { name: 'related_product_ids', type: 'relation_many', table: 'products', labelField: 'product_id', joinTable: 'product_related_products', joinKey: 'product_id', joinTargetKey: 'related_product_id', desc: 'Manually chosen related products shown below this one. Leave empty and the site picks related products automatically by shared scenario, so most SKUs need no maintenance here.' },
    ],
  },

  /* Owner-only, 1:1 with products, edited as the product form's third tab —
     deliberately NOT in VIEMAG_TABLE_ORDER, so it never becomes a sidebar item
     an editor can browse. Enforcement is the RLS policy in
     supabase/migrations/20260730120000, not this file.

     Descriptions here are PUBLIC (https://viemag.biz/admin/schema.js is
     fetchable by anyone), so no description in this table may contain a real
     company name, even as an example. */
  product_development: {
    note: 'noteOwnerOnly',
    title: 'product_id',
    fields: [
      { name: 'purchase_cost_usd', type: 'number', internal: true, desc: 'What the product itself costs to buy in, per unit, in USD. This is only one part of the cost the sales side works from.' },
      { name: 'packaging_cost_usd', type: 'number', internal: true, desc: 'Packaging cost per unit, USD.' },
      { name: 'inspection_cost_usd', type: 'number', internal: true, desc: 'Inspection and quality-control cost per unit, USD.' },
      { name: 'freight_cost_usd', type: 'number', internal: true, desc: 'Freight and logistics cost per unit, USD.' },
      { name: 'licensing_fee_usd', type: 'number', internal: true, desc: 'Licensing fee per unit, USD.' },
      { name: 'patent_fee_usd', type: 'number', internal: true, desc: 'Patent or royalty fee per unit, USD.' },
      { name: 'tooling_amortization_usd', type: 'number', internal: true, desc: 'Tooling cost amortised per unit, USD. Entered by hand rather than derived, because amortisation is not always a straight division — it can be shared with the customer, already complete, or spread over a period instead of a quantity. Record which of those applies in the cost note.' },
      { name: 'other_cost_usd', type: 'number', internal: true, desc: 'Anything else that belongs in the per-unit cost, USD.' },
      { name: 'cost_note', type: 'textarea', internal: true, desc: 'Where the numbers above came from. Everything here is USD while quotes usually are not, so record the source and the rate used — one line such as "July quote, converted at 7.2" is enough. Without it, nobody can tell six months from now whether a figure is still current. This one note covers all eight components.' },
      { name: 'sales_cost_usd', type: 'number', readOnly: true, internal: true, desc: 'The eight components above, added up by the database. This is the only number from this tab that the sales tab can see; the breakdown stays here.' },
      { name: 'supplier', type: 'text', internal: true, desc: 'Who supplies this product. The most confidentiality-sensitive field in the whole system — it is the one piece of data that could link the brand back to a manufacturing origin, so it lives behind the owner-only wall and is never exported.' },
      { name: 'design_link', type: 'text', internal: true, desc: 'A LINK to the drawings, not an upload. Files uploaded through the normal image widget land in a public bucket and are fetchable by URL without logging in, and a drawing’s title block routinely names the manufacturer. Keep the files on the company drive and share the link to named people only — never "anyone with the link".' },
      { name: 'inventory_first_batch', type: 'number', internal: true, desc: 'First-batch quantity planned at project kick-off. Note this is a planning figure, not current sellable stock — if someone needs current stock, that is a different field that does not exist yet, so do not reuse this one for it.' },
      { name: 'certification_notes', type: 'textarea', internal: true, desc: 'Progress notes on certification. Kept behind the wall because in-progress notes ("submitted, expecting approval next quarter") are exactly what must not become a promise to a customer — the site already refuses to show a certification mark unless qi_status is Certified.' },
    ],
  },

  categories: {
    title: 'category_name',
    order: 'sort_order',
    thumbFallback: 'art_key',
    fields: [
      { name: 'category_name', type: 'text', required: true, internal: true, desc: 'Internal label used only in the admin list, to tell rows apart at a glance. The public site shows name_en/vi/id/zh instead.' },
      { name: 'slug', type: 'text', required: true, desc: 'URL key for this category (products.html?cat=<slug>). Changing it breaks any link already pointing at the old value.' },
      { name: 'name_en', type: 'text', desc: 'Category name (English). Shown on category cards, the product-page breadcrumb, the footer, and filter buttons.' },
      { name: 'name_vi', type: 'text', desc: 'Category name (Vietnamese).' },
      { name: 'name_id', type: 'text', desc: 'Category name (Indonesian).' },
      { name: 'name_zh', type: 'text', desc: 'Category name (Traditional Chinese).' },
      { name: 'desc_en', type: 'textarea', desc: 'Category description (English). Shown on the category card and the category page.' },
      { name: 'desc_vi', type: 'textarea', desc: 'Category description (Vietnamese).' },
      { name: 'desc_id', type: 'textarea', desc: 'Category description (Indonesian).' },
      { name: 'desc_zh', type: 'textarea', desc: 'Category description (Traditional Chinese).' },
      { name: 'visibility', type: 'select', options: ['Public', 'Internal', 'Future'], desc: 'Future marks the category as coming soon on its card.' },
      { name: 'internal_cat_mapping', type: 'select', options: ['CAT-A', 'CAT-B', 'CAT-C', 'CAT-D', 'CAT-E'], desc: 'Maps to the White Paper’s CAT-A to CAT-E code, shown on the category card. The single source of truth for a product’s CAT classification — products no longer carry their own separate copy of it.' },
      { name: 'sort_order', type: 'number', desc: 'Display order on the homepage, the category list and the footer. Lower numbers come first.' },
      { name: 'art_key', type: 'text', desc: 'Which built-in illustration this category card uses.' },
      { name: 'seo_title_en', type: 'text', desc: 'Search-result and browser-tab title for this category’s page (English). Leave blank for the generic listing title.' },
      { name: 'seo_title_vi', type: 'text', desc: 'Search-result and browser-tab title (Vietnamese). Leave blank for the generic listing title.' },
      { name: 'seo_title_id', type: 'text', desc: 'Search-result and browser-tab title (Indonesian). Leave blank for the generic listing title.' },
      { name: 'seo_title_zh', type: 'text', desc: 'Search-result and browser-tab title (Traditional Chinese). Leave blank for the generic listing title.' },
      { name: 'seo_description_en', type: 'textarea', desc: 'Search-result summary for this category (English). Leave blank and the category description is used instead.' },
      { name: 'seo_description_vi', type: 'textarea', desc: 'Search-result summary (Vietnamese). Leave blank to fall back to the description.' },
      { name: 'seo_description_id', type: 'textarea', desc: 'Search-result summary (Indonesian). Leave blank to fall back to the description.' },
      { name: 'seo_description_zh', type: 'textarea', desc: 'Search-result summary (Traditional Chinese). Leave blank to fall back to the description.' },
      { name: 'status', type: 'select', options: ['Published', 'Hidden'], desc: 'Controls whether the category appears at all. Hidden means it disappears entirely — and any product still pointing at it loses its breadcrumb segment, though the product itself still shows.' },
    ],
  },

  scenarios: {
    title: 'scenario_name',
    order: 'priority',
    thumb: 'hero_image_url',
    thumbFallback: 'icon',
    fields: [
      { name: 'scenario_name', type: 'text', required: true, internal: true, desc: 'Internal label used only in the admin list. The public site shows name_en/vi/id/zh instead.' },
      { name: 'scenario_code', type: 'select', options: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], desc: 'The S1–S6 code shown on the scenario page and on filter buttons.' },
      { name: 'slug', type: 'text', desc: 'Anchor and filter value for this scenario (scenarios.html#<slug> and ?scn=<slug>).' },
      { name: 'priority', type: 'number', desc: 'Display order on the scenarios page. Lower numbers come first.' },
      { name: 'status', type: 'select', options: ['Primary', 'Secondary', 'Supporting', 'Future', 'Hidden'], desc: 'Controls whether this scenario appears at all. Hidden means it does not show.' },
      { name: 'name_en', type: 'text', desc: 'Scenario name (English). Shown on the scenario page, scenario cards and the ?scn= filter button.' },
      { name: 'name_vi', type: 'text', desc: 'Scenario name (Vietnamese).' },
      { name: 'name_id', type: 'text', desc: 'Scenario name (Indonesian).' },
      { name: 'name_zh', type: 'text', desc: 'Scenario name (Traditional Chinese).' },
      { name: 'desc_en', type: 'textarea', desc: 'Scenario description (English). The paragraph shown for this scenario on the scenarios page.' },
      { name: 'desc_vi', type: 'textarea', desc: 'Scenario description (Vietnamese).' },
      { name: 'desc_id', type: 'textarea', desc: 'Scenario description (Indonesian).' },
      { name: 'desc_zh', type: 'textarea', desc: 'Scenario description (Traditional Chinese).' },
      { name: 'pain_point_en', type: 'textarea', desc: 'What goes wrong in this scenario (English). Shown under the description — this is the reason the scenario page exists at all.' },
      { name: 'pain_point_vi', type: 'textarea', desc: 'What goes wrong in this scenario (Vietnamese).' },
      { name: 'pain_point_id', type: 'textarea', desc: 'What goes wrong in this scenario (Indonesian).' },
      { name: 'pain_point_zh', type: 'textarea', desc: 'What goes wrong in this scenario (Traditional Chinese).' },
      { name: 'proof_needed', type: 'multiselect', options: ['Vibration', 'Heat', 'Magnetic', 'Durability'], internal: true, desc: 'Internal planning: which kind of test evidence this scenario needs to support its claims.' },
      { name: 'icon', type: 'text', desc: 'Built-in icon used when there is no real photo for this scenario.' },
      { name: 'combo_skus', type: 'text', desc: 'Suggested product combination for this scenario. Enter SKUs separated by commas; the scenario page turns them into clickable product links.' },
      { name: 'hero_image_url', type: 'image', desc: 'Real photograph for this scenario. Leave blank and the page falls back to the icon — a real photo is far more persuasive here, since the whole point of a scenario page is a lived-in moment.' },
    ],
  },

  /* Published on product pages when public_status = Public AND
     approved_for_marketing = true. BOTH are required — the export function
     filters on both in Postgres, so ticking only one publishes nothing. */
  test_reports: {
    title: 'title_en',
    order: 'sort_order',
    fields: [
      { name: 'title_en', type: 'text', required: true, desc: 'Report title (English). Shown in the "Quality Evidence" list on the product page; clickable when a file is attached.' },
      { name: 'title_vi', type: 'text', desc: 'Report title (Vietnamese).' },
      { name: 'title_id', type: 'text', desc: 'Report title (Indonesian).' },
      { name: 'title_zh', type: 'text', desc: 'Report title (Traditional Chinese).' },
      { name: 'test_type', type: 'select', options: ['Vibration', 'Heat', 'Drop', 'Magnetic Force', 'Lifecycle', 'Qi'], desc: 'Type of test performed. Shown in the info line under the report title.' },
      { name: 'evidence_level', type: 'select', options: ['Third-party', 'Internal Lab', 'Factory Test', 'Pending'], desc: 'How the test was conducted. Shown to visitors as-is — third-party lab evidence reads very differently from a factory self-test, so this is not a formality.' },
      { name: 'public_status', type: 'select', options: ['Public', 'Internal Only', 'Pending'], desc: 'First of two publish gates. Must be Public for this report to have any chance of appearing.' },
      { name: 'approved_for_marketing', type: 'boolean', desc: 'Second publish gate: marketing sign-off. BOTH this and public_status must be true at once — ticking only one publishes nothing.' },
      { name: 'tested_date', type: 'date', desc: 'Date the test was run. Shown in the report’s info line.' },
      { name: 'sort_order', type: 'number', desc: 'Order this report appears in on a product page. Lower numbers come first.' },
      { name: 'report_file_url', type: 'image', desc: 'The report file. When filled, the title becomes clickable and opens it; when blank, the report still lists — the claim itself is the content.' },
      { name: 'summary_en', type: 'textarea', desc: 'Result summary (English). Shown under the report title.' },
      { name: 'summary_vi', type: 'textarea', desc: 'Result summary (Vietnamese).' },
      { name: 'summary_id', type: 'textarea', desc: 'Result summary (Indonesian).' },
      { name: 'summary_zh', type: 'textarea', desc: 'Result summary (Traditional Chinese).' },
      { name: 'limitations_en', type: 'textarea', desc: 'Measurement conditions and limitations (English). A compliance requirement, not a footnote — the site always shows this next to the result, never collapsed, because Vietnam’s advertising law requires a performance claim to carry the conditions it was measured under.' },
      { name: 'limitations_vi', type: 'textarea', desc: 'Measurement conditions and limitations (Vietnamese).' },
      { name: 'limitations_id', type: 'textarea', desc: 'Measurement conditions and limitations (Indonesian).' },
      { name: 'limitations_zh', type: 'textarea', desc: 'Measurement conditions and limitations (Traditional Chinese).' },
    ],
  },

  /* The public Insights section (VIEMAG 科技洞察 / VIEMAG Insights).
     Published only when status = Published. `category` must stay in step with
     the DB check constraint AND the insights.cat.* labels in js/i18n.js. */
  guides: {
    title: 'title_en',
    order: 'sort_order',
    thumb: 'hero_image_url',
    thumbFallback: 'art_key',
    fields: [
      { name: 'slug', type: 'text', required: true, desc: 'The article’s URL key (insight.html?slug=<slug>). Required, must be unique, and changing it after publishing breaks any link already out there.' },
      { name: 'category', type: 'select', options: ['Magnetic Technology', 'Charging Standards', 'Apple Ecosystem', 'Industry Trends', 'Tech Explained'], desc: 'One of five fixed categories. Adding a new one requires a code change in three places, so do not type a new value here.' },
      { name: 'status', type: 'select', options: ['Idea', 'Draft', 'Review', 'Published'], desc: 'Controls whether the article is live. Only Published appears on the site.' },
      { name: 'published_date', type: 'date', desc: 'Date shown on the article, and also decides ordering within a category (newest first).' },
      { name: 'sort_order', type: 'number', desc: 'Manual ordering, lower numbers first; ties are broken by date.' },
      { name: 'hero_image_url', type: 'image', desc: 'Article cover photo. Leave blank and art_key’s illustration is used instead.' },
      { name: 'art_key', type: 'text', desc: 'Which built-in illustration to use when there is no cover photo.' },
      { name: 'title_en', type: 'text', required: true, desc: 'Article title (English). Shown on the listing card, the article page heading and the browser tab title.' },
      { name: 'title_vi', type: 'text', desc: 'Article title (Vietnamese).' },
      { name: 'title_id', type: 'text', desc: 'Article title (Indonesian).' },
      { name: 'title_zh', type: 'text', desc: 'Article title (Traditional Chinese).' },
      { name: 'excerpt_en', type: 'textarea', desc: 'Listing-card summary (English). Also used as this article’s search-result summary.' },
      { name: 'excerpt_vi', type: 'textarea', desc: 'Listing-card summary (Vietnamese).' },
      { name: 'excerpt_id', type: 'textarea', desc: 'Listing-card summary (Indonesian).' },
      { name: 'excerpt_zh', type: 'textarea', desc: 'Listing-card summary (Traditional Chinese).' },
      { name: 'body_en', type: 'textarea', large: true, desc: 'Article body (English). Supports simple formatting: `## heading`, `- list item`, `**bold**`, blank-line paragraphs. Pasted HTML is shown as literal text, not executed — that is deliberate.' },
      { name: 'body_vi', type: 'textarea', large: true, desc: 'Article body (Vietnamese). Same formatting rules as body_en.' },
      { name: 'body_id', type: 'textarea', large: true, desc: 'Article body (Indonesian). Same formatting rules as body_en.' },
      { name: 'body_zh', type: 'textarea', large: true, desc: 'Article body (Traditional Chinese). Same formatting rules as body_en.' },
      { name: 'funnel_stage', type: 'select', options: ['Awareness', 'Consideration', 'Conversion', 'Support'], internal: true, desc: 'Internal marketing planning only — never shown on the site.' },
      { name: 'cta', type: 'select', options: ['Shopee', 'Product', 'Dealer', 'Support'], internal: true, desc: 'Internal marketing planning only — never shown on the site.' },
    ],
  },

  /* Not wired to the site, and as of 2026-07-30 not reserved for anything either:
     the 產品庫 it was held for was cancelled in favour of marking pipeline items
     with products.status = 'Development'. Woody chose to keep the table rather
     than drop it, so it stays declared noteNotWired — an editor who opens it must
     be told plainly that nothing consumes it, because "kept for later" and "wired
     up" look identical from inside a form. Note /admin does not even WRITE this
     table today: image upload goes straight to Storage and puts the URL on the
     product. */
  assets: {
    note: 'noteNotWired',
    title: 'asset_name',
    fields: [
      { name: 'asset_name', type: 'text', required: true, desc: 'Asset name. This whole table is not wired to the site yet, so filling it in has no front-end effect today.' },
      { name: 'asset_type', type: 'select', options: ['Product Image', 'Lifestyle', 'Test Graphic', 'Video', 'Packaging', 'Icon'], desc: 'What kind of asset this is.' },
      { name: 'language', type: 'select', options: ['VI', 'EN', 'ZH', 'Universal'], desc: 'Which language version this asset is for; Universal means it works for every language.' },
      { name: 'usage_rights', type: 'select', options: ['Owned', 'Licensed', 'KOL', 'Pending'], desc: 'Where this asset’s usage rights come from — matters if a license expires or a source is disputed.' },
      { name: 'status', type: 'select', options: ['Draft', 'Approved', 'Needs Retouch', 'Archived'], desc: 'Internal processing status for this asset.' },
      { name: 'file_url', type: 'image', desc: 'Where the asset file is stored.' },
      { name: 'alt_text_vi', type: 'text', desc: 'Alt text (Vietnamese only — not wired to anything).' },
      { name: 'notes', type: 'textarea', desc: 'Free-text notes.' },
    ],
  },

  faq: {
    title: 'faq_key',
    fields: [
      { name: 'faq_key', type: 'text', required: true, desc: 'Unique identifier for this question. This is the value a product’s FAQ selector actually looks up, so use a readable short English name.' },
      { name: 'question_en', type: 'textarea', desc: 'The question (English). Shown as the collapsible heading on the support page and, if selected, on a product page.' },
      { name: 'question_vi', type: 'textarea', desc: 'The question (Vietnamese).' },
      { name: 'question_id', type: 'textarea', desc: 'The question (Indonesian).' },
      { name: 'question_zh', type: 'textarea', desc: 'The question (Traditional Chinese).' },
      { name: 'answer_en', type: 'textarea', desc: 'The answer (English). Shown when the question is expanded.' },
      { name: 'answer_vi', type: 'textarea', desc: 'The answer (Vietnamese).' },
      { name: 'answer_id', type: 'textarea', desc: 'The answer (Indonesian).' },
      { name: 'answer_zh', type: 'textarea', desc: 'The answer (Traditional Chinese).' },
      { name: 'category', type: 'select', options: ['Installation', 'Compatibility', 'Warranty', 'Charging', 'Heat', 'Return'], desc: 'Question category. The support page groups questions under a heading per category once any are categorised; with none categorised, it shows one flat list.' },
      { name: 'status', type: 'select', options: ['Draft', 'Published', 'Archived'], desc: 'Controls whether this question is live. Only Published appears on the site.' },
      { name: 'last_reviewed', type: 'date', internal: true, desc: 'Internal: date this question/answer was last checked.' },
    ],
  },

  /* Inbox: the public dealers.html form inserts the first ten columns; the rest
     are the staff triage record. Nothing here is ever published. */
  dealer_leads: {
    note: 'noteInbox',
    title: 'company_name',
    fields: [
      { name: 'company_name', type: 'text', required: true, desc: 'Filled in by the visitor on the public dealer form.' },
      { name: 'contact_person', type: 'text', desc: 'Filled in by the visitor.' },
      { name: 'email', type: 'text', desc: 'Filled in by the visitor.' },
      { name: 'phone_zalo', type: 'text', desc: 'Filled in by the visitor.' },
      { name: 'city_region', type: 'text', desc: 'Filled in by the visitor.' },
      { name: 'channel_type', type: 'multiselect', options: ['Shopee', 'Retail', 'Distributor', 'Car Accessories', 'Mobile Accessories'], desc: 'Filled in by the visitor.' },
      { name: 'current_brands', type: 'textarea', desc: 'Filled in by the visitor.' },
      { name: 'monthly_sales_estimate', type: 'number', desc: 'Filled in by the visitor.' },
      { name: 'first_order_readiness', type: 'select', options: ['Ready', 'Need Samples', 'Just Researching'], desc: 'Your assessment of how ready this lead is to place a first order.' },
      { name: 'can_meet_minimum_order', type: 'boolean', desc: 'Checked by the visitor on the form.' },
      { name: 'needs_regional_protection', type: 'boolean', desc: 'Your assessment of whether this lead is asking for territory exclusivity.' },
      { name: 'status', type: 'select', options: ['New', 'Contacted', 'Sample Sent', 'Negotiating', 'Won', 'Lost'], desc: 'Your handling status for this lead.' },
      { name: 'next_follow_up', type: 'date', desc: 'Your next follow-up date.' },
      { name: 'notes', type: 'textarea', desc: 'The visitor’s free-text note, plus anywhere you want to add your own internal remarks.' },
    ],
  },

  /* Inbox: support.html inserts the customer's report; the rest is the staff
     handling record. Nothing here is ever published. */
  support_cases: {
    note: 'noteInbox',
    title: 'case_id',
    fields: [
      { name: 'case_id', type: 'text', desc: 'Case number (SC-year-sequence). Generated automatically — do not fill in.' },
      { name: 'customer_name', type: 'text', desc: 'Filled in by the customer on the public support form.' },
      { name: 'contact', type: 'text', desc: 'Filled in by the customer.' },
      { name: 'product_reported', type: 'text', desc: 'Filled in by the customer.' },
      { name: 'purchase_channel', type: 'select', options: ['Shopee', 'Dealer', 'Website', 'Other'], desc: 'Filled in by the customer.' },
      { name: 'purchase_date', type: 'date', desc: 'Filled in by the customer.' },
      { name: 'issue_type', type: 'select', options: ['DOA', 'Heat', 'Drop', 'Charging', 'Mount Loose', 'Compatibility', 'Other'], desc: 'Filled in by the customer.' },
      { name: 'issue_description', type: 'textarea', desc: 'Filled in by the customer.' },
      { name: 'warranty_status', type: 'select', options: ['Within 14 Days', 'Within 12 Months', 'Out of Warranty', 'Unknown'], desc: 'Your determination of warranty status.' },
      { name: 'evidence_urls', type: 'images', desc: 'Photo or video evidence.' },
      { name: 'resolution', type: 'select', options: ['Replace', 'Guide', 'Reject', 'Pending'], desc: 'Your chosen resolution: replace, guide the customer, reject, or still pending.' },
      { name: 'cost_owner', type: 'select', options: ['VIEMAG', 'Customer', 'Shared', 'Dealer'], desc: 'Your determination of who bears the cost.' },
      { name: 'status', type: 'select', options: ['New', 'Reviewing', 'Resolved', 'Escalated'], desc: 'Your handling status for this case.' },
      { name: 'escalate_to_hq', type: 'boolean', desc: 'Whether this case needs to be escalated to headquarters.' },
      { name: 'root_cause', type: 'textarea', desc: 'Your root-cause analysis.' },
    ],
  },

};

/* Table display order + nav grouping in the sidebar */
window.VIEMAG_TABLE_ORDER = [
  'products', 'categories', 'scenarios', 'test_reports', 'guides', 
  'assets', 'faq', 'dealer_leads', 
  'support_cases'
];
