/* VIEMAG Admin — table schema descriptors.
   Drives the generic list/edit UI: one definition per Supabase table.
   field.type: text | textarea | number | boolean | date | select |
               multiselect | image | images | relation | relation_many
   field.internal: true -> flagged in the form as staff-only; these values are
               never part of the public site export.

   NOTE: this file is served publicly (it is inside the GitHub Pages repo, so
   https://viemag.biz/admin/schema.js is fetchable by anyone). It must
   therefore contain no confidential values and no field names that reveal
   anything the brand rules say to keep private. Login protects the DATA, not
   this file. */
window.VIEMAG_SCHEMA = {
  categories: {
    title: 'category_name',
    order: 'sort_order',
    fields: [
      { name: 'category_name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'name_en', type: 'text' }, { name: 'name_vi', type: 'text' },
      { name: 'name_id', type: 'text' }, { name: 'name_zh', type: 'text' },
      { name: 'desc_en', type: 'textarea' }, { name: 'desc_vi', type: 'textarea' },
      { name: 'desc_id', type: 'textarea' }, { name: 'desc_zh', type: 'textarea' },
      { name: 'visibility', type: 'select', options: ['Public', 'Internal', 'Future'] },
      { name: 'internal_cat_mapping', type: 'select', options: ['CAT-A', 'CAT-B', 'CAT-C', 'CAT-D', 'CAT-E'] },
      { name: 'sort_order', type: 'number' },
      { name: 'art_key', type: 'text' },
      { name: 'hero_copy_vi', type: 'textarea' },
      { name: 'seo_title_vi', type: 'text' },
      { name: 'seo_description_vi', type: 'textarea' },
      { name: 'status', type: 'select', options: ['Published', 'Hidden'] },
    ],
  },

  scenarios: {
    title: 'scenario_name',
    order: 'priority',
    fields: [
      { name: 'scenario_name', type: 'text', required: true },
      { name: 'scenario_code', type: 'select', options: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] },
      { name: 'slug', type: 'text' },
      { name: 'priority', type: 'number' },
      { name: 'status', type: 'select', options: ['Primary', 'Secondary', 'Supporting', 'Future', 'Hidden'] },
      { name: 'name_en', type: 'text' }, { name: 'name_vi', type: 'text' },
      { name: 'name_id', type: 'text' }, { name: 'name_zh', type: 'text' },
      { name: 'desc_en', type: 'textarea' }, { name: 'desc_vi', type: 'textarea' },
      { name: 'desc_id', type: 'textarea' }, { name: 'desc_zh', type: 'textarea' },
      { name: 'pain_point_vi', type: 'textarea' },
      { name: 'proof_needed', type: 'multiselect', options: ['Vibration', 'Heat', 'Magnetic', 'Durability'] },
      { name: 'icon', type: 'text' },
      { name: 'combo_skus', type: 'text' },
      { name: 'hero_image_url', type: 'image' },
    ],
  },

  products: {
    title: 'product_id',
    order: 'product_id',
    fields: [
      { name: 'product_id', type: 'text', required: true },
      { name: 'official_sku_code', type: 'text' },
      { name: 'slug', type: 'text', required: true },
      { name: 'status', type: 'select', options: ['Draft', 'Review', 'Published', 'Hidden', 'Discontinued'] },
      { name: 'launch_tier', type: 'select', options: ['A - Core', 'B - Test', 'C - Display', 'Future'] },
      { name: 'category_id', type: 'relation', table: 'categories', labelField: 'category_name' },
      { name: 'internal_cat', type: 'select', options: ['CAT-A', 'CAT-B', 'CAT-C', 'CAT-D', 'CAT-E'] },
      { name: 'persona', type: 'multiselect', options: ['commuter', 'homeoffice', 'traveler', 'creator'] },
      { name: 'name_en', type: 'text' }, { name: 'name_vi', type: 'text' },
      { name: 'name_id', type: 'text' }, { name: 'name_zh', type: 'text' },
      { name: 'claim_en', type: 'textarea' }, { name: 'claim_vi', type: 'textarea' },
      { name: 'claim_id', type: 'textarea' }, { name: 'claim_zh', type: 'textarea' },
      { name: 'consumer_pain_point', type: 'multiselect', options: ['Dropping', 'Heat', 'Loose', 'Compatibility', 'Cable Mess'] },
      { name: 'shopee_url', type: 'text' },
      { name: 'price_usd', type: 'number' },
      { name: 'msrp_usd_min', type: 'number' },
      { name: 'msrp_usd_max', type: 'number' },
      { name: 'promo_floor', type: 'number', internal: true },
      { name: 'target_gross_margin', type: 'number', internal: true },
      { name: 'minimum_gross_margin', type: 'number', internal: true },
      { name: 'inventory_first_batch', type: 'number', internal: true },
      { name: 'mount_type', type: 'multiselect', options: ['Vent', 'Dashboard', 'Suction', 'Tape', 'Screen', 'Desktop'] },
      { name: 'charging_watt', type: 'select', options: ['None', '15W', '25W', 'TBD'] },
      { name: 'qi_status', type: 'select', options: ['Not applicable', 'Compatible', 'Testing', 'Certified', 'Pending'] },
      { name: 'certification_notes', type: 'textarea' },
      { name: 'warranty_months', type: 'number' },
      { name: 'defect_exchange_days', type: 'number' },
      { name: 'hero_image_url', type: 'image' },
      { name: 'gallery_urls', type: 'images' },
      { name: 'spec_sheet_url', type: 'image' },
      { name: 'art_key', type: 'select', options: ['vent', 'dash', 'suction', 'clip', 'tape', 'pro', 'carcharge', 'dashcharge', 'fancharge', 'suctioncharge', 'deskcharge', 'stand2in1', 'fold', 'ring', 'case', 'powerbank', 'stand', 'tripod'] },
      { name: 'badge', type: 'select', options: ['bestseller', 'new', 'soon'] },
      { name: 'rating', type: 'number' },
      { name: 'review_count', type: 'number' },
      { name: 'seo_title_vi', type: 'text' },
      { name: 'seo_description_vi', type: 'textarea' },
      { name: 'last_reviewed', type: 'date' },
      { name: 'owner', type: 'text' },
      { name: 'scenario_ids', type: 'relation_many', joinTable: 'product_scenarios', joinKey: 'product_id', joinTargetKey: 'scenario_id', table: 'scenarios', labelField: 'scenario_name' },
      { name: 'test_report_ids', type: 'relation_many', joinTable: 'product_test_reports', joinKey: 'product_id', joinTargetKey: 'test_report_id', table: 'test_reports', labelField: 'report_name' },
      { name: 'faq_ids', type: 'relation_many', joinTable: 'product_faqs', joinKey: 'product_id', joinTargetKey: 'faq_id', table: 'faq', labelField: 'faq_key' },
      { name: 'related_product_ids', type: 'relation_many', joinTable: 'product_related_products', joinKey: 'product_id', joinTargetKey: 'related_product_id', table: 'products', labelField: 'product_id' },
    ],
  },

  test_reports: {
    title: 'report_name',
    fields: [
      { name: 'report_name', type: 'text', required: true },
      { name: 'test_type', type: 'select', options: ['Vibration', 'Heat', 'Drop', 'Magnetic Force', 'Lifecycle', 'Qi'] },
      { name: 'public_status', type: 'select', options: ['Public', 'Internal Only', 'Pending'] },
      { name: 'evidence_level', type: 'select', options: ['Third-party', 'Internal Lab', 'Factory Test', 'Pending'] },
      { name: 'result_summary_vi', type: 'textarea' },
      { name: 'limitations', type: 'textarea' },
      { name: 'report_file_url', type: 'image' },
      { name: 'tested_date', type: 'date' },
      { name: 'approved_for_marketing', type: 'boolean' },
    ],
  },

  assets: {
    title: 'asset_name',
    fields: [
      { name: 'asset_name', type: 'text', required: true },
      { name: 'asset_type', type: 'select', options: ['Product Image', 'Lifestyle', 'Test Graphic', 'Video', 'Packaging', 'Icon'] },
      { name: 'language', type: 'select', options: ['VI', 'EN', 'ZH', 'Universal'] },
      { name: 'usage_rights', type: 'select', options: ['Owned', 'Licensed', 'KOL', 'Pending'] },
      { name: 'status', type: 'select', options: ['Draft', 'Approved', 'Needs Retouch', 'Archived'] },
      { name: 'file_url', type: 'image' },
      { name: 'alt_text_vi', type: 'text' },
      { name: 'notes', type: 'textarea' },
    ],
  },

  faq: {
    title: 'faq_key',
    fields: [
      { name: 'faq_key', type: 'text', required: true },
      { name: 'question_en', type: 'textarea' }, { name: 'question_vi', type: 'textarea' },
      { name: 'question_id', type: 'textarea' }, { name: 'question_zh', type: 'textarea' },
      { name: 'answer_en', type: 'textarea' }, { name: 'answer_vi', type: 'textarea' },
      { name: 'answer_id', type: 'textarea' }, { name: 'answer_zh', type: 'textarea' },
      { name: 'category', type: 'select', options: ['Installation', 'Compatibility', 'Warranty', 'Charging', 'Heat', 'Return'] },
      { name: 'status', type: 'select', options: ['Draft', 'Published', 'Archived'] },
      { name: 'last_reviewed', type: 'date' },
    ],
  },

  guides: {
    title: 'article_title',
    fields: [
      { name: 'article_title', type: 'text', required: true },
      { name: 'slug', type: 'text' },
      { name: 'language', type: 'select', options: ['VI', 'EN', 'ZH'] },
      { name: 'topic', type: 'select', options: ['Buying Guide', 'Installation', 'Qi2', 'Comparison', 'Dealer'] },
      { name: 'funnel_stage', type: 'select', options: ['Awareness', 'Consideration', 'Conversion', 'Support'] },
      { name: 'status', type: 'select', options: ['Idea', 'Draft', 'Review', 'Published'] },
      { name: 'seo_title', type: 'text' },
      { name: 'seo_description', type: 'textarea' },
      { name: 'cta', type: 'select', options: ['Shopee', 'Product', 'Dealer', 'Support'] },
      { name: 'content_body', type: 'textarea', large: true },
    ],
  },

  dealer_leads: {
    title: 'company_name',
    fields: [
      { name: 'company_name', type: 'text', required: true },
      { name: 'contact_person', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'phone_zalo', type: 'text' },
      { name: 'city_region', type: 'text' },
      { name: 'channel_type', type: 'multiselect', options: ['Shopee', 'Retail', 'Distributor', 'Car Accessories', 'Mobile Accessories'] },
      { name: 'current_brands', type: 'textarea' },
      { name: 'monthly_sales_estimate', type: 'number' },
      { name: 'first_order_readiness', type: 'select', options: ['Ready', 'Need Samples', 'Just Researching'] },
      { name: 'can_meet_minimum_order', type: 'boolean' },
      { name: 'needs_regional_protection', type: 'boolean' },
      { name: 'status', type: 'select', options: ['New', 'Contacted', 'Sample Sent', 'Negotiating', 'Won', 'Lost'] },
      { name: 'next_follow_up', type: 'date' },
      { name: 'notes', type: 'textarea' },
    ],
  },

  support_cases: {
    title: 'case_id',
    fields: [
      { name: 'case_id', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'contact', type: 'text' },
      { name: 'product_reported', type: 'text' },
      { name: 'purchase_channel', type: 'select', options: ['Shopee', 'Dealer', 'Website', 'Other'] },
      { name: 'purchase_date', type: 'date' },
      { name: 'issue_type', type: 'select', options: ['DOA', 'Heat', 'Drop', 'Charging', 'Mount Loose', 'Compatibility', 'Other'] },
      { name: 'issue_description', type: 'textarea' },
      { name: 'warranty_status', type: 'select', options: ['Within 14 Days', 'Within 12 Months', 'Out of Warranty', 'Unknown'] },
      { name: 'evidence_urls', type: 'images' },
      { name: 'resolution', type: 'select', options: ['Replace', 'Guide', 'Reject', 'Pending'] },
      { name: 'cost_owner', type: 'select', options: ['VIEMAG', 'Customer', 'Shared', 'Dealer'] },
      { name: 'status', type: 'select', options: ['New', 'Reviewing', 'Resolved', 'Escalated'] },
      { name: 'escalate_to_hq', type: 'boolean' },
      { name: 'root_cause', type: 'textarea' },
    ],
  },

  site_settings: {
    title: 'page_name',
    order: 'sort_order',
    fields: [
      { name: 'page_name', type: 'text', required: true },
      { name: 'slug', type: 'text' },
      { name: 'page_type', type: 'select', options: ['Home', 'Category', 'Static', 'Landing', 'Support'] },
      { name: 'language', type: 'select', options: ['VI', 'EN', 'ZH'] },
      { name: 'status', type: 'select', options: ['Draft', 'Published', 'Hidden'] },
      { name: 'seo_title', type: 'text' },
      { name: 'seo_description', type: 'textarea' },
      { name: 'hero_title', type: 'text' },
      { name: 'hero_copy', type: 'textarea' },
      { name: 'cta_label', type: 'text' },
      { name: 'cta_url', type: 'text' },
      { name: 'sort_order', type: 'number' },
    ],
  },
};

/* Table display order + nav grouping in the sidebar */
window.VIEMAG_TABLE_ORDER = [
  'products', 'categories', 'scenarios', 'test_reports', 'assets',
  'faq', 'guides', 'dealer_leads', 'support_cases', 'site_settings',
];
