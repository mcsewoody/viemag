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

/* Which packaging product types need which block. THE one place this is
   written down.

   It used to be written eleven times — four group `showIf`s and six
   `requiredIf`s here, three `SPEC_BLOCKS[].types` and two `electric` boolean
   chains in admin/packaging-export.js — with a comment in each file asking the
   other to stay in step. They did not stay in step: `Combined product` was
   missing from every battery rule, so a magnetic power bank saved clean and
   then exported two [FAIL] lines; and the year-of-manufacture rule disagreed
   with its own field description. A comment asking a human to keep two arrays
   equal is the bug, not the fix.

   Declared here rather than in packaging-export.js because admin/index.html
   loads this file first. scripts/test_packaging_export.mjs evals this file
   before the exporter for the same reason. */
window.VIEMAG_PKG_TYPES = {
  /* Has a magnet and a clamp: block 6A. */
  bracket: ['Magnetic bracket', 'Combined product'],
  /* Puts power into a phone, so it has input and output figures: block 6B.
     A power bank is in here too — it charges a phone exactly as a charger
     does. Also the Appendix I category-40 set, the one the law asks for a
     year of manufacture. */
  charging: ['Charging product', 'Power bank', 'Combined product'],
  /* Carries its own cells: block 6C, the lithium warning, and the watt-hour
     figure air freight will not move the goods without. */
  battery: ['Power bank', 'Combined product'],
};
/* Every type, in the order the select offers them. Also the answer to "has
   anyone started a packaging record for this product?" — which is what the
   legally-required-on-every-label fields hang off, so that a product nobody has
   packaged yet still saves. */
window.VIEMAG_PKG_TYPES.all = [
  'Magnetic bracket', 'Charging product', 'Power bank', 'Combined product',
];

window.VIEMAG_PACKAGING_YEAR = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Bangkok', year: 'numeric',
}).format(new Date());
window.VIEMAG_NORMALIZE_ORIGIN = function (value) {
  var aliases = {
    'china': 'China', 'made in china': 'China', 'trung quốc': 'China', '中國': 'China', '中国': 'China',
    'taiwan': 'Taiwan', 'made in taiwan': 'Taiwan', 'đài loan': 'Taiwan', '台灣': 'Taiwan', '台湾': 'Taiwan',
    'vietnam': 'Vietnam', 'viet nam': 'Vietnam', 'made in vietnam': 'Vietnam', 'việt nam': 'Vietnam', '越南': 'Vietnam',
  };
  var text = String(value == null ? '' : value).trim();
  return aliases[text.toLowerCase()] || text;
};

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
    listCols: ['official_sku_code', 'name_en', 'art_key', 'sales_cost_usd'], // extra list-view columns beyond title/status
    /* sales_cost_usd is not a column of products. It is the one number allowed
       across the owner-only wall, read from the product_sales_cost view and
       merged in by renderList(). purchase_cost_usd and supplier deliberately
       stay OUT of this list: they live one tab deeper for a reason, and a
       supplier name on the default screen is a name in every screenshot and
       screen share. */
    listExtras: [{ table: 'product_sales_cost', key: 'product_id', cols: ['sales_cost_usd'], money: true }],
    statusFilter: true,         // status now also marks pipeline items, so the list needs filtering
    tabs: [
      { key: 'front', groups: [
        { key: 'ident',     fields: ['product_id', 'official_sku_code', 'slug', 'status', 'launch_tier', 'category_id'] },
        { key: 'naming',    fields: [['name_en', 'name_vi', 'name_id', 'name_zh'],
                                    ['claim_en', 'claim_vi', 'claim_id', 'claim_zh'],
                                    ['accessories_en', 'accessories_vi', 'accessories_id', 'accessories_zh']] },
        { key: 'commerce',  fields: ['price_usd', 'shopee_url'] },
        { key: 'media',     fields: ['hero_image_url', 'gallery_urls', 'spec_sheet_url', 'art_key'] },
        { key: 'article',   fields: ['product_article_image_url',
                                    ['product_article_en', 'product_article_vi', 'product_article_id', 'product_article_zh']] },
        { key: 'spec',      fields: ['mount_type', 'charging_watt', 'qi_status', 'warranty_months', 'defect_exchange_days',
                                    ['technical_content_en', 'technical_content_vi', 'technical_content_id', 'technical_content_zh']],
          sharedFields: [{ source: 'product_packaging', fields: [
            ['main_material_en', 'main_material_vi', 'main_material_id', 'main_material_zh'],
            'country_of_origin', 'magnet_grade', 'clamp_range_mm',
            'input_voltage', 'input_current', 'input_power', 'wireless_output_power',
            'max_output_power', 'connector_type', 'wired_output_voltage',
            'wired_output_current', 'wired_output_power', 'battery_type',
            'battery_capacity_mah', 'rated_voltage', 'watt_hour_wh',
            'port1_spec', 'port2_spec', 'port3_spec', 'max_combined_output',
          ] }] },
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
      /* Everything a packaging designer needs, in the order the box is read.
         A second sub-table tab, on the same 1:1 pattern as `dev` below but
         WITHOUT ownerOnly: packaging copy is printed on a box that ships to the
         public, so it is not owner material. It still never reaches viemag.biz,
         which is a different fact — see the table's note.

         Groups 6A/6B/6C carry `showIf`: only the technical block that matches
         `packaging_product_type` is shown. That is the whole point of the
         product-type field — a bare magnetic bracket should never be looking at
         a battery-capacity box. Combined product opens more than one. */
      { key: 'packaging', table: 'product_packaging', groups: [
        { key: 'pkgIdentity', source: 'products', readOnly: true,
          fields: ['product_id', ['name_en', 'name_vi', 'name_id', 'name_zh']] },
        { key: 'pkgSetup', fields: ['packaging_status', 'packaging_product_type',
                                    'country_of_origin', 'manufacturing_year'] },
        { key: 'pkgLegal', source: 'brand_settings', readOnly: true,
          fields: ['responsible_company', 'responsible_address', 'manufacturer_name', 'manufacturer_address',
                   'importer_name', 'importer_address', 'customer_contact',
                   ['warranty_terms_en', 'warranty_terms_vi', 'warranty_terms_id', 'warranty_terms_zh']] },
        { key: 'pkgUsage',    fields: [['instructions_precautions_en', 'instructions_precautions_vi',
                                        'instructions_precautions_id', 'instructions_precautions_zh'],
                                       ['storage_instructions_en', 'storage_instructions_vi',
                                        'storage_instructions_id', 'storage_instructions_zh']] },
        { key: 'pkgContents', source: 'products', readOnly: true,
          fields: [['accessories_en', 'accessories_vi', 'accessories_id', 'accessories_zh']] },
        { key: 'pkgMaterial', fields: [['main_material_en', 'main_material_vi',
                                        'main_material_id', 'main_material_zh']] },
        /* Each 6x group is now the measurable attributes first, then the free
           prose last. The prose field is the SAME column it has always been —
           see the comments on it below — so nothing a colleague typed before
           this change moved or disappeared. */
        { key: 'pkgSpecA', showIf: { field: 'packaging_product_type', in: window.VIEMAG_PKG_TYPES.bracket },
          fields: ['magnet_grade', 'clamp_range_mm',
                   ['magnetic_bracket_specs_en', 'magnetic_bracket_specs_vi',
                    'magnetic_bracket_specs_id', 'magnetic_bracket_specs_zh']] },
        { key: 'pkgSpecB', showIf: { field: 'packaging_product_type', in: window.VIEMAG_PKG_TYPES.charging },
          fields: ['input_voltage', 'input_current', 'input_power',
                   'wireless_output_power', 'max_output_power', 'connector_type',
                   'wired_output_voltage', 'wired_output_current', 'wired_output_power',
                   ['charging_specs_en', 'charging_specs_vi', 'charging_specs_id', 'charging_specs_zh']] },
        { key: 'pkgSpecC', showIf: { field: 'packaging_product_type', in: window.VIEMAG_PKG_TYPES.battery },
          fields: ['battery_type', 'battery_capacity_mah', 'rated_voltage', 'watt_hour_wh',
                   'port1_spec', 'port2_spec', 'port3_spec', 'max_combined_output',
                   ['power_bank_specs_en', 'power_bank_specs_vi',
                    'power_bank_specs_id', 'power_bank_specs_zh']] },
        /* Its own group rather than a paragraph inside 6C, because the lithium
           warning is a separate legal requirement with its own air-freight
           consequences — buried in a spec box it is the first thing to get
           forgotten. */
        { key: 'pkgLithium', showIf: { field: 'packaging_product_type', in: window.VIEMAG_PKG_TYPES.battery },
          fields: [['lithium_warning_en', 'lithium_warning_vi',
                    'lithium_warning_id', 'lithium_warning_zh'], 'iata_notes'] },
        { key: 'pkgBarcode', fields: ['barcode_ean_upc'] },
        { key: 'pkgNotes', fields: [['packaging_notes_en', 'packaging_notes_vi',
                                     'packaging_notes_id', 'packaging_notes_zh']] },
        /* No fields: the group exists to hold the Download button. A button is
           not a column, so it is declared as an `action` rather than faked as a
           field with a type nothing can save. */
        { key: 'pkgExport', action: 'packagingExport', fields: [] },
      ] },
      /* Who and what first, money second (Woody, 2026-07-30). Opening a project
         record on a wall of eight cost boxes says nothing about which product it
         is; the supplier and the drawings do. */
      { key: 'dev', table: 'product_development', ownerOnly: true, groups: [
        { key: 'supplierInfo', fields: ['supplier', 'supplier_part_number', 'reference_files'] },
        { key: 'productInfo',  fields: ['design_files', 'inventory_first_batch', 'certification_notes'] },
        { key: 'costStack',    fields: ['purchase_cost_usd', 'packaging_cost_usd', 'inspection_cost_usd', 'freight_cost_usd',
                                        'licensing_fee_usd', 'patent_fee_usd', 'tooling_amortization_usd', 'other_cost_usd',
                                        'cost_note', 'sales_cost_usd'] },
      ] },
    ],
    fields: [
      { name: 'product_id', type: 'text', required: true, desc: 'Unique product code and the packaging model number. Edit on Site; Packaging displays the same value read-only. If official_sku_code is blank, the website also uses this code as its SKU.' },
      { name: 'official_sku_code', type: 'text', desc: 'The SKU shown to customers and used in the product page URL (?sku=). Do not put an internal-only code here.' },
      { name: 'slug', type: 'text', required: true, desc: 'URL-friendly short name. The site currently links products by ?sku=, so this is reserved for future per-language URLs; changing it will not break anything yet, but will once those exist.' },
      { name: 'status', type: 'select', options: ['Development', 'Draft', 'Review', 'Published', 'Hidden', 'Discontinued'], desc: 'Controls whether this product appears on the site at all — only Published is shown. Development means the product does not exist yet and is still being sourced or tooled; Draft means it exists but its copy is unfinished. Keeping those apart is what lets the list answer "how many projects are running".' },
      { name: 'launch_tier', type: 'select', options: ['Buyable', 'Future', 'Discontinued'], desc: 'Controls whether the product can be BOUGHT. Independent of Status, which controls whether it is on the site at all. Buyable shows the price and buy button; Future shows a coming-soon card; Discontinued keeps the page but removes the price and buy button — use it when a product stops selling but existing owners still need its specs. To take a product off the site entirely, set Status to Discontinued instead.' },
      { name: 'category_id', type: 'relation', table: 'categories', labelField: 'category_name', desc: 'Which product category this belongs to. Decides the breadcrumb, the category page listing, and the ?cat= filter result. Also the single source of this product’s CAT-A to CAT-E classification, through the category’s internal_cat_mapping.' },
      { name: 'name_en', type: 'text', desc: 'Product name. Shown on the product card, the product page title, the breadcrumb and the browser tab title. All four languages sit side by side — an empty box here is a missing translation on a live page.' },
      { name: 'name_vi', type: 'text', desc: 'Product name (Vietnamese).' },
      { name: 'name_id', type: 'text', desc: 'Product name (Indonesian).' },
      { name: 'name_zh', type: 'text', desc: 'Product name (Traditional Chinese).' },
      { name: 'claim_en', type: 'textarea', large: true, desc: 'Selling point — the single most-seen piece of copy on the whole site. Shown under the name on the product card and product page. One point per line: write several lines and the product page renders them as a list, while a single line stays a single sentence.' },
      { name: 'claim_vi', type: 'textarea', large: true, desc: 'Selling point (Vietnamese). One point per line.' },
      { name: 'claim_id', type: 'textarea', large: true, desc: 'Selling point (Indonesian). One point per line.' },
      { name: 'claim_zh', type: 'textarea', large: true, desc: 'Selling point (Traditional Chinese). One point per line.' },
      { name: 'accessories_en', type: 'textarea', desc: 'What ships in the box, ONE ITEM PER LINE. Shown as its own list on the product page. Line breaks are what make the list — putting everything on one line produces one long run-on entry. Leave blank and the section does not appear at all, which is the right outcome for a product that ships on its own.' },
      { name: 'accessories_vi', type: 'textarea', desc: 'What is in the box, one item per line (Vietnamese).' },
      { name: 'accessories_id', type: 'textarea', desc: 'What is in the box, one item per line (Indonesian).' },
      { name: 'accessories_zh', type: 'textarea', desc: 'What is in the box, one item per line (Traditional Chinese). Simplified is converted automatically.' },
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
      { name: 'sub_category', type: 'select', options: ['mounts', 'charging-mounts', 'stands', 'travel', 'power', 'creator', 'interface'], desc: 'Mid-level nav bucket inside the ecosystem. The SKU only encodes the ecosystem, so this can be reorganised without reissuing any part number.' },
      { name: 'mount_type', type: 'multiselect', options: ['Vent', 'Dashboard', 'Suction', 'PU-Suction', 'Tape', 'Screen', 'Clip', 'Clamp', 'Screw', 'Quarter-Inch', 'Magnetic', 'Magsafe', 'Desktop'], desc: 'How the product attaches, multi-select. Shown as chips on the product card and as a row in the spec table — the row disappears entirely for products that mount to nothing, such as a power bank. Suction is a vacuum cup and PU-Suction is a nano-adhesive pad; Clip is a spring clip and Clamp is a screw-tightened one; Quarter-Inch is the 1/4" camera thread. Magsafe describes how the phone attaches and always displays as "MagSafe-compatible", never as a bare trademark.' },
      { name: 'charging_watt', type: 'select', options: ['None', '15W', '25W', 'TBD'], desc: 'Charging wattage, shown in the spec table. Leave blank or set to None and that spec row does not appear.' },
      { name: 'qi_status', type: 'select', options: ['Not applicable', 'Compatible', 'Testing', 'Certified', 'Pending'], desc: 'Qi / Qi2 status. Only Certified displays a certification mark — never select it unless certification has actually been obtained.' },
      { name: 'qi_id', type: 'text', desc: 'The Qi certification ID issued by the WPC. Required whenever Qi Status is Certified — the code itself no longer carries a certification marker, so this field plus Qi Status is the only record that a product may print the Qi logo.' },
      { name: 'warranty_months', type: 'number', desc: 'Warranty length in months. Feeds directly into the warranty copy on the site in all five languages. Leave blank to use the site-wide default (12).' },
      { name: 'defect_exchange_days', type: 'number', desc: 'Defect-exchange window in days. Also feeds the site copy in all five languages. Leave blank to use the site-wide default (14).' },
      { name: 'hero_image_url', type: 'image', desc: 'Main product photo. Leave blank and the site shows the built-in illustration for art_key instead — nothing breaks.' },
      { name: 'gallery_urls', type: 'images', desc: 'Additional product photos. There is no limit on how many. A thumbnail strip only appears on the product page once there are 2 or more photos including the main one.' },
      { name: 'spec_sheet_url', type: 'image', desc: 'Spec sheet file. When filled, a "Download spec sheet" link appears in the specs section — useful for dealer inquiries. This file is PUBLIC, so check the document’s title block carries no manufacturing-side information before uploading it.' },
      { name: 'art_key', type: 'select', options: ['vent', 'dash', 'suction', 'clip', 'tape', 'pro', 'carcharge', 'dashcharge', 'fancharge', 'suctioncharge', 'deskcharge', 'stand2in1', 'fold', 'ring', 'case', 'powerbank', 'stand', 'tripod'], desc: 'Which built-in illustration to show when there is no real photo. A wrong code means the site shows a blank image for this product.' },
      { name: 'product_article_image_url', type: 'image', desc: 'Optional lead image for the long-form product article section. Use a product or lifestyle photo that supports the explanation below. Leave blank and the article renders as text only.' },
      { name: 'product_article_en', type: 'textarea', large: true, editor: 'productArticle', desc: 'Long-form product article shown in the Product Details tab. Use blank lines to separate movable blocks. The toolbar inserts bold, italic, headings, linked headings, bullets, image layouts and YouTube embeds; left/right images wrap the nearby text, wide images span the article. Add a local/public video as its own line: ![video](https://example.com/demo.mp4). Leave blank and the article tab stays empty.' },
      { name: 'product_article_vi', type: 'textarea', large: true, editor: 'productArticle', desc: 'Long-form product article (Vietnamese). Same formatting tools as product_article_en.' },
      { name: 'product_article_id', type: 'textarea', large: true, editor: 'productArticle', desc: 'Long-form product article (Indonesian). Same formatting tools as product_article_en.' },
      { name: 'product_article_zh', type: 'textarea', large: true, editor: 'productArticle', desc: 'Long-form product article (Traditional Chinese). Simplified is converted automatically.' },
      { name: 'technical_content_en', type: 'textarea', large: true, editor: 'productArticle', requiresColumn: true, desc: 'Flexible content for the Specifications tab (English). Product dimensions now live here as a normal two-column spec row, not as a separate field. Use the + Row toolbar button and keep the value in mm, for example `Dimensions | 64 x 64 x 82 mm`.' },
      { name: 'technical_content_vi', type: 'textarea', large: true, editor: 'productArticle', requiresColumn: true, desc: 'Flexible content for the Specifications tab (Vietnamese). Product dimensions now live here as a normal two-column spec row, not as a separate field. Use the + Row toolbar button and keep the value in mm.' },
      { name: 'technical_content_id', type: 'textarea', large: true, editor: 'productArticle', requiresColumn: true, desc: 'Flexible content for the Specifications tab (Indonesian). Product dimensions now live here as a normal two-column spec row, not as a separate field. Use the + Row toolbar button and keep the value in mm.' },
      { name: 'technical_content_zh', type: 'textarea', large: true, editor: 'productArticle', requiresColumn: true, desc: 'Flexible content for the Specifications tab (Traditional Chinese). Product dimensions now live here as a normal two-column spec row, not as a separate field. Use the + Row toolbar button and keep the value in mm. Simplified is converted automatically.' },
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
      { name: 'test_report_ids', type: 'relation_many', table: 'test_reports', labelField: 'title_en', joinTable: 'product_test_reports', joinKey: 'product_id', joinTargetKey: 'test_report_id', desc: 'Which test reports to show on this product page. Many-to-many — one report can be attached to several products. A report that has not cleared both publish gates will not appear even if selected here.' },
      { name: 'faq_ids', type: 'relation_many', table: 'faq', labelField: 'faq_key', joinTable: 'product_faqs', joinKey: 'product_id', joinTargetKey: 'faq_id', desc: 'This product’s own FAQ, shown as a dedicated section on the product page. Leave empty and visitors instead see the site-wide FAQ list on the support page.' },
      { name: 'related_product_ids', type: 'relation_many', table: 'products', labelField: 'product_id', joinTable: 'product_related_products', joinKey: 'product_id', joinTargetKey: 'related_product_id', desc: 'Manually chosen related products shown below this one. Leave empty and the site picks related products automatically from the same ecosystem, preferring the same sub-category, so most SKUs need no maintenance here.' },
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
      { name: 'supplier_part_number', type: 'text', internal: true, desc: 'The item code the supplier uses for this product, for quoting and reordering. Owner-only and never exported, for the same reason as the field above: a part number is a lookup key into one specific catalogue, so publishing it gives away much of what publishing the name would.' },
      { name: 'design_files', type: 'files_private', internal: true, desc: 'Drawings and design files, as many as needed. These upload to a PRIVATE bucket, not the one product photos use — that one is public, and a drawing’s title block routinely names the manufacturer. Only owners can open these, through links that expire.' },
      { name: 'reference_files', type: 'files_private', internal: true, desc: 'Supplier-side documents: quotations, catalogues, certificates, anything worth keeping with the project. Same private storage and same owner-only access as the design files. A quotation letterhead is exactly the kind of document that must never sit at a public URL.' },
      { name: 'inventory_first_batch', type: 'number', internal: true, desc: 'First-batch quantity planned at project kick-off. Note this is a planning figure, not current sellable stock — if someone needs current stock, that is a different field that does not exist yet, so do not reuse this one for it.' },
      { name: 'certification_notes', type: 'textarea', internal: true, desc: 'Progress notes on certification. Kept behind the wall because in-progress notes ("submitted, expecting approval next quarter") are exactly what must not become a promise to a customer — the site already refuses to show a certification mark unless qi_status is Certified.' },
    ],
  },

  /* 1:1 with products, edited as the product form's Packaging tab. Like
     product_development it is deliberately NOT in VIEMAG_TABLE_ORDER — it is a
     tab, not a sidebar item — but unlike it, any signed-in colleague may read
     and write it. Enforcement is the RLS policy in
     supabase/migrations/20260930120000, not this file.

     Packaging-only fields are tagged internal. Main material is shared with
     the website and is edited once here.

     Descriptions here are PUBLIC (https://viemag.biz/admin/schema.js is
     fetchable by anyone), so no description may contain the responsible
     company's registered name or address, even as an example. Those live in
     admin/packaging-export.js. */
  product_packaging: {
    note: 'notePackaging',
    title: 'product_id',
    fields: [
      { name: 'packaging_status', type: 'select', internal: true, options: ['Draft', 'Ready for design', 'Sent to print', 'Printed'], desc: 'Where this box is in its own workflow. Separate from the product Status, which is about the website — a product can be live on the site for months while its packaging is still a draft.' },
      { name: 'packaging_product_type', type: 'select', internal: true, options: window.VIEMAG_PKG_TYPES.all, desc: 'Which technical-specification block this product needs. Choosing it shows the matching block below and hides the others; Combined product shows more than one. It also decides what the law asks for — a charging product must print a year of manufacture, a bare bracket need not.' },
      { name: 'barcode_ean_upc', type: 'text', internal: true, validate: 'ean13', desc: 'EAN-13, 13 digits. Stored as text to preserve leading zeros. A partial code can be saved; missing or invalid codes are flagged in the review export.' },
      { name: 'instructions_precautions_en', type: 'textarea', large: true, internal: true, desc: 'How to use the product, how to store it, and any warnings — one point per line. Mostly carried by diagrams on the box, so keep the text to what a diagram cannot say. For anything with a battery or a heating part this section is not optional.' },
      { name: 'instructions_precautions_vi', type: 'textarea', large: true, internal: true, desc: 'Instructions, storage and warnings (Vietnamese), one point per line.' },
      { name: 'instructions_precautions_id', type: 'textarea', large: true, internal: true, desc: 'Instructions, storage and warnings (Indonesian), one point per line.' },
      { name: 'instructions_precautions_zh', type: 'textarea', large: true, internal: true, desc: 'Instructions, storage and warnings (Traditional Chinese), one point per line.' },
      { name: 'main_material_en', type: 'textarea', desc: 'Main material / composition, listed briefly. One shared value for packaging and the product specifications on the website. Edit here; the Site tab shows a read-only copy.' },
      { name: 'main_material_vi', type: 'textarea', desc: 'Main material / composition (Vietnamese), shared with the website.' },
      { name: 'main_material_id', type: 'textarea', desc: 'Main material / composition (Indonesian), shared with the website.' },
      { name: 'main_material_zh', type: 'textarea', desc: 'Main material / composition (Traditional Chinese), shared with the website.' },
      { name: 'magnetic_bracket_specs_en', type: 'textarea', large: true, internal: true, desc: 'The part of the bracket specification that only a sentence can say: which phones and cases it works with, whether an adapter ring is needed and whether one is included. The measurable attributes now have their own boxes above — magnet grade and clamping range — so this is for the conditions around them, one per line.' },
      { name: 'magnetic_bracket_specs_vi', type: 'textarea', large: true, internal: true, desc: 'Bracket technical specifications (Vietnamese), one per line.' },
      { name: 'magnetic_bracket_specs_id', type: 'textarea', large: true, internal: true, desc: 'Bracket technical specifications (Indonesian), one per line.' },
      { name: 'magnetic_bracket_specs_zh', type: 'textarea', large: true, internal: true, desc: 'Bracket technical specifications (Traditional Chinese), one per line.' },
      { name: 'charging_specs_en', type: 'textarea', large: true, internal: true, desc: 'The part of the charging specification that only a sentence can say — above all what the supply has to provide before the maximum output is real, e.g. that it needs a 30W PD adapter. The figures themselves now have their own boxes above. One point per line.' },
      { name: 'charging_specs_vi', type: 'textarea', large: true, internal: true, desc: 'Charging technical specifications (Vietnamese), one per line.' },
      { name: 'charging_specs_id', type: 'textarea', large: true, internal: true, desc: 'Charging technical specifications (Indonesian), one per line.' },
      { name: 'charging_specs_zh', type: 'textarea', large: true, internal: true, desc: 'Charging technical specifications (Traditional Chinese), one per line.' },
      { name: 'power_bank_specs_en', type: 'textarea', large: true, internal: true, desc: 'The part of the power-bank specification that only a sentence can say: charging behaviour, pass-through, anything conditional. Cell type, capacity, nominal voltage, watt-hours and the per-port figures now have their own boxes above. One point per line.' },
      { name: 'power_bank_specs_vi', type: 'textarea', large: true, internal: true, desc: 'Power-bank technical specifications (Vietnamese), one per line.' },
      { name: 'power_bank_specs_id', type: 'textarea', large: true, internal: true, desc: 'Power-bank technical specifications (Indonesian), one per line.' },
      { name: 'power_bank_specs_zh', type: 'textarea', large: true, internal: true, desc: 'Power-bank technical specifications (Traditional Chinese), one per line.' },

      /* ---------- general label content ---------- */
      /* Packaging can be saved while incomplete. Readiness checks belong to
         the review export, not the shared Site/Sales/Packaging Save button. */
      { name: 'country_of_origin', type: 'select', options: ['China', 'Taiwan', 'Vietnam'], normalizeValue: window.VIEMAG_NORMALIZE_ORIGIN, internal: true, desc: 'Actual country of origin: China, Taiwan or Vietnam. Select the country supported by the product records. May be left blank while drafting.' },
      /* The current-year default is a convenience; the production batch still
         determines which year staff must select. */
      { name: 'manufacturing_year', type: 'select', options: Array.from({ length: Math.max(2035, Number(window.VIEMAG_PACKAGING_YEAR) + 5) - 2025 + 1 }, function (_, i) { return String(2025 + i); }), defaultValue: window.VIEMAG_PACKAGING_YEAR, internal: true, desc: 'Year of manufacture. Defaults to the current year when not entered; select the actual production year for the batch.' },
      { name: 'storage_instructions_en', type: 'textarea', internal: true, desc: 'How to store the product — temperature, damp, direct sun, anything that shortens its life. The law lists storage separately from instructions for use, so give it its own lines rather than folding it into the box above.' },
      { name: 'storage_instructions_vi', type: 'textarea', internal: true, desc: 'Storage instructions (Vietnamese), one point per line.' },
      { name: 'storage_instructions_id', type: 'textarea', internal: true, desc: 'Storage instructions (Indonesian), one point per line.' },
      { name: 'storage_instructions_zh', type: 'textarea', internal: true, desc: 'Storage instructions (Traditional Chinese), one point per line.' },

      /* ---------- 6A, measurable ---------- */
      { name: 'magnet_grade', type: 'text', internal: true, desc: 'Magnet grade, e.g. N52. One box, no language copies: the grade is the same characters everywhere, so four translated copies would only be four chances to mistype it. Leave blank if the grade is not worth printing.' },
      { name: 'clamp_range_mm', type: 'text', internal: true, unit: 'mm', desc: 'Clamping width or thickness the bracket accepts, e.g. 6-9. Only for clamp types. This is the dimension that decides whether a phone fits, which is why it is here when general product dimensions are deliberately not collected at all.' },

      /* ---------- 6B, measurable ---------- */
      { name: 'input_voltage', type: 'text', internal: true, desc: 'Input voltage as printed, e.g. 9V, or 5V/9V when it accepts both. Text rather than a number so a range and its unit survive exactly as the box should show them.' },
      { name: 'input_current', type: 'text', internal: true, desc: 'Input current, e.g. 2A.' },
      { name: 'input_power', type: 'text', internal: true, desc: 'Input power, e.g. 18W.' },
      { name: 'wireless_output_power', type: 'text', internal: true, desc: 'Wireless charging output, e.g. 15W. State the figure the product actually sustains, not the peak of the standard it implements.' },
      { name: 'max_output_power', type: 'text', internal: true, desc: 'The highest output the product can deliver. If reaching it depends on the adapter or the phone, say so in the notes box at the bottom of this section — a bare number that needs a 30W PD charger to be true reads as a promise.' },
      { name: 'connector_type', type: 'select', internal: true, options: ['USB-C', 'USB-A', 'USB-C + USB-A', 'Lightning', 'Micro-USB', 'DC barrel', 'Hardwired'], desc: 'The connector on the product itself. Pick Hardwired when the cable is fixed and there is no socket.' },
      { name: 'wired_output_voltage', type: 'text', internal: true, desc: 'Output voltage of the cable port, e.g. 5V⎓3A / 9V⎓2A. Only for products that also charge over a cable.' },
      { name: 'wired_output_current', type: 'text', internal: true, desc: 'Output current of the cable port.' },
      { name: 'wired_output_power', type: 'text', internal: true, desc: 'Output power of the cable port.' },

      /* ---------- 6C, measurable ---------- */
      { name: 'battery_type', type: 'select', internal: true, options: ['Li-ion', 'Li-polymer', 'LiFePO4'], desc: 'Cell chemistry. Fill for products with cells; leave blank for products without a battery or while drafting.' },
      { name: 'battery_capacity_mah', type: 'text', internal: true, unit: 'mAh', desc: 'Cell capacity, e.g. 10000. Give the rated cell capacity, not the usable output after conversion. May be left blank while drafting.' },
      { name: 'rated_voltage', type: 'text', internal: true, desc: 'Nominal voltage of the cells, e.g. 3.7V. Together with capacity this is used to calculate watt-hours. May be left blank while drafting.' },
      { name: 'watt_hour_wh', type: 'text', internal: true, unit: 'Wh', desc: 'Watt-hours, e.g. 37. Capacity in Ah multiplied by nominal voltage. Missing values are flagged in the review export, not blocked on Save.' },
      { name: 'port1_spec', type: 'text', internal: true, desc: 'First port, input and output on one line, e.g. USB-C In 5V⎓3A / Out 5V⎓3A, 9V⎓2A. One field per port rather than a list, because each port prints as its own line and they are not interchangeable.' },
      { name: 'port2_spec', type: 'text', internal: true, desc: 'Second port, same format. Leave blank if there is only one.' },
      { name: 'port3_spec', type: 'text', internal: true, desc: 'Third port, same format.' },
      { name: 'max_combined_output', type: 'text', internal: true, desc: 'The ceiling when more than one port draws at once, e.g. 65W total. Not the sum of the ports and not derivable from them — leaving it out is what turns a spec list into a claim the product cannot meet.' },

      /* ---------- lithium cells ---------- */
      { name: 'lithium_warning_en', type: 'textarea', large: true, internal: true, desc: 'Lithium-cell safety warning (English). Fill when applicable; may be left blank while drafting.' },
      { name: 'lithium_warning_vi', type: 'textarea', large: true, internal: true, desc: 'Lithium-cell warning (Vietnamese). Missing text for a battery product is flagged in the review export, not blocked on Save.' },
      { name: 'lithium_warning_id', type: 'textarea', large: true, internal: true, desc: 'Lithium-cell warning (Indonesian).' },
      { name: 'lithium_warning_zh', type: 'textarea', large: true, internal: true, desc: 'Lithium-cell warning (Traditional Chinese).' },
      { name: 'iata_notes', type: 'textarea', internal: true, desc: 'Air-freight marking notes — the lithium handling label, the watt-hour marking on the outer carton, anything the forwarder has asked for. Not printed on the retail box, but the designer needs to know it applies before the outer-carton artwork is laid out.' },

      /* ---------- designer notes ---------- */
      { name: 'packaging_notes_en', type: 'textarea', large: true, internal: true, desc: 'Anything the designer has to know that is not itself printed — a hanging hole the side label must clear, a panel that has to stay clear for a sticker, a colour that has to match an existing box. Not label content.' },
      { name: 'packaging_notes_vi', type: 'textarea', large: true, internal: true, desc: 'Notes for the designer (Vietnamese). Not printed on the box.' },
      { name: 'packaging_notes_id', type: 'textarea', large: true, internal: true, desc: 'Notes for the designer (Indonesian). Not printed on the box.' },
      { name: 'packaging_notes_zh', type: 'textarea', large: true, internal: true, desc: 'Notes for the designer (Traditional Chinese). Not printed on the box.' },
    ],
  },

  /* One row, edited from its own sidebar page rather than per product: this is
     the block that is identical on every box, so holding it per SKU would mean
     thirty copies free to drift apart. Owner-only to WRITE — see the RLS in
     supabase/migrations/20261005090000 — because naming the organisation that
     answers for the goods is a legal declaration, not product copy.

     Nothing here gets a translate button. A registered company name and address
     have to match the business licence exactly, and a machine translation of an
     address is a plausible-looking address that is not the legal one. Only the
     warranty sentence is prose, so only that one has four languages. */
  /* Nothing here is `required`. The migration seeds the single row with every
     column NULL and calls that the intended state until legal confirms the
     registered names — so a rule refusing to save it would refuse exactly the
     state the design asks for. The export's [FAIL] line is the gate, and it
     fires on every export until the names are filled in. */
  brand_settings: {
    note: 'notePackaging',
    title: 'responsible_company',
    singleton: true,
    fields: [
      { name: 'responsible_company', type: 'text', internal: true, desc: 'The organisation that answers for the goods, in its registered name exactly as it appears on the business licence. Depending on the shipment this may be the manufacturer or the importer; the law cares that it is named and reachable, not which of the two it is.' },
      { name: 'responsible_address', type: 'textarea', internal: true, desc: 'Full registered address of the company above. Printed as written — do not abbreviate it to fit the panel.' },
      { name: 'manufacturer_name', type: 'text', internal: true, desc: 'Registered manufacturer name, when the label must state the maker separately from the responsible company. Leave blank only when legal confirms the responsible-company line is the correct manufacturer/commissioning-party line for this shipment.' },
      { name: 'manufacturer_address', type: 'textarea', internal: true, desc: 'Full registered address of the manufacturer, printed as written when the manufacturer line is used.' },
      { name: 'importer_name', type: 'text', internal: true, desc: 'Registered name of the Vietnamese importer. Required on the label whenever the goods are imported, and separate from the responsible company because the usual case has one of each.' },
      { name: 'importer_address', type: 'textarea', internal: true, desc: 'Full registered address of the Vietnamese importer.' },
      { name: 'customer_contact', type: 'text', internal: true, desc: 'At least one channel a buyer can actually reach — a phone number or an email address. Expected next to the responsible-party block, and a buyer with a faulty product is the person it is for.' },
      { name: 'warranty_terms_en', type: 'textarea', large: true, internal: true, desc: 'The warranty and exchange sentence printed on the box. The NUMBERS live on each product (Warranty months, Defect exchange days on the Sales tab) because they vary per SKU; this is the wording around them. Vietnamese is the copy consumer law requires.' },
      { name: 'warranty_terms_vi', type: 'textarea', large: true, internal: true, desc: 'Warranty and exchange conditions (Vietnamese). Legally required.' },
      { name: 'warranty_terms_id', type: 'textarea', large: true, internal: true, desc: 'Warranty and exchange conditions (Indonesian).' },
      { name: 'warranty_terms_zh', type: 'textarea', large: true, internal: true, desc: 'Warranty and exchange conditions (Traditional Chinese).' },
    ],
  },

  categories: {
    title: 'category_name',
    order: 'sort_order',
    thumb: 'hero_image_url',
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
      { name: 'hero_image_url', type: 'image', desc: 'Main illustration/photo for this product line. Shown large on the category card; leave blank and the site falls back to art_key.' },
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
      { name: 'slug', type: 'text', desc: 'Anchor for this scenario on the scenarios page (scenarios.html#<slug>).' },
      { name: 'priority', type: 'number', desc: 'Display order on the scenarios page. Lower numbers come first.' },
      { name: 'status', type: 'select', options: ['Primary', 'Secondary', 'Supporting', 'Future', 'Hidden'], desc: 'Controls whether this scenario appears at all. Hidden means it does not show.' },
      { name: 'name_en', type: 'text', desc: 'Scenario name (English). Shown on the scenario page and on scenario cards.' },
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
/* brand_settings is last on purpose: it is one row that is set up once and then
   almost never touched, so it sits below the things people open every day. It
   IS in this list, unlike product_packaging and product_development, because it
   is not a tab of anything — there is no product to hang it off. */
window.VIEMAG_TABLE_ORDER = [
  'products', 'categories', 'scenarios', 'test_reports', 'guides',
  'assets', 'faq', 'dealer_leads',
  'support_cases', 'brand_settings'
];
