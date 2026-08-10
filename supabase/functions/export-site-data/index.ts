// VIEMAG — Supabase -> js/data.js exporter (Edge Function)
// Replaces scripts/export-notion.mjs. Reads published content from
// Postgres (service_role, bypasses RLS by design — this function IS
// the trusted boundary) and commits a regenerated js/data.js straight
// to GitHub via the Contents API, which triggers a GitHub Pages
// redeploy. Invoked by /admin right after a save (see admin.js).
//
// SECURITY: only the whitelisted public fields below are ever read.
// Internal fields (Minimum/Target Gross Margin, Promo Floor,
// Inventory First Batch, Certification Notes, Owner, cost/stock)
// are NEVER selected or emitted. Do not add them.
//
// Required secrets (supabase secrets set):
//   GITHUB_PAT            fine-grained PAT, Contents: Read and write, scoped to this repo only
// Optional secrets (defaults shown):
//   GITHUB_REPO           default 'mcsewoody/viemag'
//   GITHUB_BRANCH         default 'main'
//   GITHUB_FILE_PATH      default 'js/data.js'
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by the platform.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'mcsewoody/viemag';
const GITHUB_BRANCH = Deno.env.get('GITHUB_BRANCH') ?? 'main';
const GITHUB_FILE_PATH = Deno.env.get('GITHUB_FILE_PATH') ?? 'js/data.js';
const GITHUB_PAT = Deno.env.get('GITHUB_PAT');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/* ---- static blocks with no Supabase source: personas, tests, config.
   Hand-maintained here, carried through unchanged on every export
   (mirrors scripts/export-notion.mjs — not in scope of the migration). ---- */
const STATIC = {
  personas: [
    { id: 'commuter', icon: 'car', age: '25–40',
      name: { vi: 'Người đi làm yêu công nghệ', en: 'Tech Commuter', id: 'Komuter Melek Teknologi', zh: '科技通勤族' },
      desc: { vi: 'Mỗi lần đổi bối cảnh là một lần tháo – gắn. Nam châm giúp tiết kiệm 3 giây mỗi lần, cả ngày là hàng chục lần.', en: 'Every scene change means re-docking the phone. Magnets give those 3 seconds back, dozens of times a day.', id: 'Setiap ganti tempat berarti memasang ulang ponsel. Magnet mengembalikan 3 detik itu, puluhan kali sehari.', zh: '每換一個場景就要重新固定手機，磁吸把每次 3 秒省回來。' },
      picks: ['car-mounts', 'car-chargers'] },
    { id: 'homeoffice', icon: 'desk', age: '30–50',
      name: { vi: 'Chuyên gia làm việc tại nhà', en: 'Home-Office Professional', id: 'Profesional Kerja dari Rumah', zh: '居家辦公專業者' },
      desc: { vi: 'Bàn làm việc gọn là một phần của năng suất. Sạc đứng, họp video, không dây rối.', en: 'A tidy desk is part of productivity. Upright charging through every call, zero cable mess.', id: 'Meja rapi adalah bagian dari produktivitas. Mengisi tegak sepanjang panggilan, tanpa kabel semrawut.', zh: '桌面整潔是生產力的一部分，立式充電、視訊零線材。' },
      picks: ['desk-travel', 'stands-display'] },
    { id: 'traveler', icon: 'plane', age: '35–55',
      name: { vi: 'Doanh nhân hay công tác', en: 'Business Traveler', id: 'Pelancong Bisnis', zh: '差旅商務人士' },
      desc: { vi: 'Hành lý càng nhẹ càng tốt. Sạc gập 3 trong 1 và pin nam châm là vật bất ly thân.', en: 'The lighter the bag, the better. Folding chargers and snap-on power are the essentials.', id: 'Makin ringan tas makin baik. Pengisi lipat dan daya tempel adalah barang wajib.', zh: '行李越輕越好，折疊充電器與磁吸電源是必備。' },
      picks: ['desk-travel', 'portable-power'] },
    { id: 'creator', icon: 'camera', age: '25–45',
      name: { vi: 'Nhà sáng tạo ngoài trời', en: 'Outdoor Creator', id: 'Kreator Luar Ruang', zh: '戶外/影像創作者' },
      desc: { vi: 'Vlog, thể thao, cắm trại. Giá trị cốt lõi là khả năng mở rộng của hệ nam châm.', en: 'Vlogs, action shots, camping. The core value is how far the magnetic system extends.', id: 'Vlog, aksi, berkemah. Nilai intinya adalah seberapa jauh sistem magnetik bisa diperluas.', zh: 'Vlog、運動攝影、露營，看重磁吸生態的擴充性。' },
      picks: ['accessories', 'stands-display'] },
  ],
  tests: [
    { id: 'vibration', icon: 'wave', name: { vi: 'Kiểm tra rung xóc', en: 'Vibration Testing', id: 'Uji Getaran', zh: '震動測試' }, desc: { vi: 'Mô phỏng mặt đường xấu và phanh gấp trước khi xuất xưởng.', en: 'Simulates rough roads and hard braking before any unit ships.', id: 'Mensimulasikan jalan rusak dan pengereman mendadak sebelum unit dikirim.', zh: '出貨前模擬爛路與急煞情境。' } },
    { id: 'thermal', icon: 'thermo', name: { vi: 'Kiểm tra tăng nhiệt', en: 'Thermal-Rise Testing', id: 'Uji Kenaikan Suhu', zh: '溫升測試' }, desc: { vi: 'Theo dõi nhiệt độ suốt chu kỳ sạc — bảo vệ điện thoại của bạn khi sạc.', en: 'Charge-cycle temperature profiling — protects your phone while charging.', id: 'Pemantauan suhu sepanjang siklus pengisian — melindungi ponsel Anda saat mengisi daya.', zh: '全充電週期溫度監控，充電時更保護您的手機。' } },
    { id: 'magnetic', icon: 'magnet', name: { vi: 'Kiểm tra lực hút', en: 'Magnetic Force Testing', id: 'Uji Gaya Magnet', zh: '磁力測試' }, desc: { vi: 'Đo lực giữ theo mọi hướng, kể cả khi dùng ốp lưng.', en: 'Holding force measured in every direction, case-on included.', id: 'Gaya tahan diukur ke segala arah, termasuk saat memakai casing.', zh: '各方向吸持力實測，含裝殼狀態。' } },
    { id: 'lifecycle', icon: 'cycle', name: { vi: 'Tuổi thọ hút – nhả', en: 'Attach-Release Lifecycle', id: 'Uji Umur Tempel–Lepas', zh: '吸合壽命測試' }, desc: { vi: 'Hàng nghìn chu kỳ gắn – tháo và kiểm tra khớp xoay.', en: 'Thousands of dock-release cycles plus hinge endurance.', id: 'Ribuan siklus tempel–lepas plus ketahanan engsel.', zh: '數千次吸合循環與球頭鉸鏈耐久。' } },
  ],
  config: {
    shopeeUrl: '#',
    /* Site-wide fallback for products that leave the fields blank. The front-end
       copy interpolates these ("{m}-month warranty · {d}-day exchange") instead
       of hard-coding 12 and 14 into five languages, which is what made the
       warranty_months / defect_exchange_days columns inert until 2026-07-29. */
    warrantyMonths: 12,
    exchangeDays: 14,
    // dealerEndpoint/supportEndpoint (Make.com webhooks) retired 2026-07-28 —
    // dealers.html / support.html now insert into Supabase directly (anon key + RLS).
  },
};

const QI_MAP: Record<string, string> = {
  'Not applicable': 'none', Compatible: 'compatible', Testing: 'testing', Certified: 'certified', Pending: 'testing',
};
const langObj = (row: any, prefix: string) => ({
  en: row[`${prefix}_en`] || '', vi: row[`${prefix}_vi`] || '', id: row[`${prefix}_id`] || '', zh: row[`${prefix}_zh`] || '',
});

async function verifyCaller(req: Request): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false, reason: 'missing Authorization header' };
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data.user) return { ok: false, reason: 'not signed in' };
  return { ok: true };
}

/* Explicit column whitelists. NOT cosmetic: with select('*') the confidential
   sales columns still on products (map_usd, wsp_usd, target/minimum_gross_margin,
   distributor, owner) would be pulled into this function's memory and its logs
   on every run, one careless `...r` away from a public repo. Listing columns
   makes Postgres enforce the boundary instead of relying on whoever edits this
   file next.

   The development and cost fields moved out of products entirely on 2026-07-30,
   into a separate owner-only table this function must never name — see
   scripts/audit-field-parity.mjs direction E, which fails the build if the
   table's name appears anywhere in this file, comments included. */
const PRODUCT_COLS = [
  'id', 'product_id', 'official_sku_code', 'slug', 'status', 'launch_tier',
  'category_id', 'persona', 'name_en', 'name_vi', 'name_id', 'name_zh',
  'claim_en', 'claim_vi', 'claim_id', 'claim_zh', 'shopee_url', 'price_usd',
  'mount_type', 'charging_watt', 'qi_status', 'hero_image_url', 'art_key',
  'badge', 'rating', 'review_count',
  /* Added 2026-07-29. All of these were editable in /admin with no effect on the
     site — staff could fill them in and nothing happened. */
  'gallery_urls', 'spec_sheet_url', 'consumer_pain_point',
  'warranty_months', 'defect_exchange_days',
  'seo_title_en', 'seo_title_vi', 'seo_title_id', 'seo_title_zh',
  'seo_description_en', 'seo_description_vi', 'seo_description_id', 'seo_description_zh',
  /* Added 2026-08-10. What ships in the box, one item per line. */
  'accessories_en', 'accessories_vi', 'accessories_id', 'accessories_zh',
].join(',');
const CATEGORY_COLS = [
  'id', 'slug', 'internal_cat_mapping', 'visibility', 'status', 'sort_order', 'art_key',
  'name_en', 'name_vi', 'name_id', 'name_zh', 'desc_en', 'desc_vi', 'desc_id', 'desc_zh',
  'seo_title_en', 'seo_title_vi', 'seo_title_id', 'seo_title_zh',
  'seo_description_en', 'seo_description_vi', 'seo_description_id', 'seo_description_zh',
].join(',');
const SCENARIO_COLS = [
  'id', 'scenario_code', 'slug', 'priority', 'status', 'icon', 'combo_skus',
  'name_en', 'name_vi', 'name_id', 'name_zh', 'desc_en', 'desc_vi', 'desc_id', 'desc_zh',
  'hero_image_url', 'pain_point_en', 'pain_point_vi', 'pain_point_id', 'pain_point_zh',
].join(',');
/* Test reports shown on product pages. `limitations` travels with the result on
   purpose: under Vietnam's advertising rules a performance claim has to carry
   the conditions it was measured under.
   This list is every content column the table has — the two publish gates
   included, because the filter below needs them. The previous version of this
   comment warned about withholding certification_notes and owner; neither column
   has ever existed on test_reports (they were products columns, and as of
   2026-07-30 certification_notes is not even that). Corrected rather than
   deleted, so nobody re-adds the phantom warning. */
const TEST_REPORT_COLS = [
  'id', 'test_type', 'public_status', 'evidence_level', 'report_file_url',
  'tested_date', 'approved_for_marketing', 'sort_order',
  'title_en', 'title_vi', 'title_id', 'title_zh',
  'summary_en', 'summary_vi', 'summary_id', 'summary_zh',
  'limitations_en', 'limitations_vi', 'limitations_id', 'limitations_zh',
].join(', ');

/* Insights articles. funnel_stage and cta stay OUT — they are internal
   marketing-planning fields with no public meaning. */
const GUIDE_COLS = [
  'id', 'slug', 'category', 'status', 'published_date', 'sort_order',
  'hero_image_url', 'art_key',
  'title_en', 'title_vi', 'title_id', 'title_zh',
  'excerpt_en', 'excerpt_vi', 'excerpt_id', 'excerpt_zh',
  'body_en', 'body_vi', 'body_id', 'body_zh',
].join(', ');

const FAQ_COLS = [
  'id', 'faq_key', 'status', 'category',
  'question_en', 'question_vi', 'question_id', 'question_zh',
  'answer_en', 'answer_vi', 'answer_id', 'answer_zh',
].join(',');

/* PostgREST caps a response at 1000 rows and gives NO truncation signal — it
   just returns 200 with 1000 rows. The Notion-era exporter paginated; that got
   dropped in the migration. Page explicitly so a growing catalog can never be
   silently half-published. */
async function selectAll(sb: any, table: string, cols: string, tweak?: (q: any) => any) {
  const PAGE = 500;
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (tweak) q = tweak(q);
    const { data, error } = await q;
    // Never let a failed read masquerade as "this table is empty" — that would
    // publish an empty catalog to the live public site.
    if (error) throw new Error(`query ${table} failed: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

async function buildDataJs(): Promise<{ content: string; counts: Record<string, number>; skipped: string[]; withheld: string[] }> {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const [catRows, scnRows, prodRows, faqRows, linkRows, reportRows, reportLinkRows, guideRows,
         faqLinkRows, relatedLinkRows] =
    await Promise.all([
      selectAll(sb, 'categories', CATEGORY_COLS, (q: any) => q.order('sort_order').order('slug')),
      selectAll(sb, 'scenarios', SCENARIO_COLS, (q: any) => q.order('priority').order('scenario_code')),
      selectAll(sb, 'products', PRODUCT_COLS, (q: any) => q.order('product_id')),
      selectAll(sb, 'faq', FAQ_COLS, (q: any) => q.eq('status', 'Published').order('faq_key')),
      selectAll(sb, 'product_scenarios', 'product_id, scenario_id',
        (q: any) => q.order('product_id').order('scenario_id')),
      /* TWO gates, both required, and both filtered in Postgres rather than here
         so an un-approved report can never reach this function's memory: a
         report is public evidence only if it is marked Public AND signed off for
         marketing use. Until 2026-07-29 neither column did anything, because
         nothing consumed this table. */
      selectAll(sb, 'test_reports', TEST_REPORT_COLS, (q: any) =>
        q.eq('public_status', 'Public').eq('approved_for_marketing', true)
          .order('sort_order').order('tested_date', { ascending: false })),
      selectAll(sb, 'product_test_reports', 'product_id, test_report_id',
        (q: any) => q.order('product_id').order('test_report_id')),
      selectAll(sb, 'guides', GUIDE_COLS, (q: any) =>
        q.eq('status', 'Published').order('sort_order').order('published_date', { ascending: false })),
      /* Both were editable in /admin and read by nobody, so ticking them
         achieved exactly nothing. Now they OVERRIDE the automatic behaviour:
         per-product FAQs replace the global list, hand-picked related products
         replace the scenario-overlap guess. Leaving them empty keeps the
         automatic behaviour, so no SKU has to be maintained by hand. */
      selectAll(sb, 'product_faqs', 'product_id, faq_id',
        (q: any) => q.order('product_id').order('faq_id')),
      selectAll(sb, 'product_related_products', 'product_id, related_product_id',
        (q: any) => q.order('product_id').order('related_product_id')),
    ]);

  const scenarioById = new Map((scnRows || []).map((r: any) => [r.id, r]));
  const scenariosByProduct = new Map<string, string[]>();
  (linkRows || []).forEach((l: any) => {
    const scn = scenarioById.get(l.scenario_id);
    if (!scn) return;
    const arr = scenariosByProduct.get(l.product_id) || [];
    arr.push(scn.scenario_code);
    scenariosByProduct.set(l.product_id, arr);
  });

  /* Many-to-many, in both directions (Woody, 2026-07-29): one report can cover
     several SKUs and one SKU can carry several reports. Only reports that
     survived the two gates above are in `reportById`, so a link pointing at an
     internal or unapproved report simply produces nothing — the gate cannot be
     bypassed by adding a link in /admin. */
  const reportById = new Map((reportRows || []).map((r: any) => [r.id, r]));
  const reportKeysByProduct = new Map<string, string[]>();
  (reportLinkRows || []).forEach((l: any) => {
    if (!reportById.has(l.test_report_id)) return;
    const arr = reportKeysByProduct.get(l.product_id) || [];
    arr.push(l.test_report_id);
    reportKeysByProduct.set(l.product_id, arr);
  });

  /* Per-product FAQ and hand-picked related products. Both resolve to the PUBLIC
     key (faq_key / sku) rather than the uuid, so the front end can look them up
     in DB.faqs / DB.products without another id map. A link to an unpublished
     FAQ or product simply drops out — the visibility gate stays with the target
     row, not with the link. */
  const faqKeyById = new Map((faqRows || []).map((r: any) => [r.id, r.faq_key]));
  const faqKeysByProduct = new Map<string, string[]>();
  (faqLinkRows || []).forEach((l: any) => {
    const key = faqKeyById.get(l.faq_id);
    if (!key) return;
    const arr = faqKeysByProduct.get(l.product_id) || [];
    arr.push(key);
    faqKeysByProduct.set(l.product_id, arr);
  });

  const skuById = new Map((prodRows || [])
    .filter((r: any) => r.status === 'Published')
    .map((r: any) => [r.id, r.official_sku_code || r.product_id]));
  const relatedSkusByProduct = new Map<string, string[]>();
  (relatedLinkRows || []).forEach((l: any) => {
    const sku = skuById.get(l.related_product_id);
    if (!sku) return;   // unpublished or deleted target
    const arr = relatedSkusByProduct.get(l.product_id) || [];
    arr.push(sku);
    relatedSkusByProduct.set(l.product_id, arr);
  });

  /* Sort keys (sort_order / priority) are applied to the ROWS and then dropped:
     the array order in js/data.js is the contract, and the front end never read
     the numbers. Sorting before mapping instead of after is what lets them go. */
  const categories = (catRows || [])
    .filter((r: any) => r.status !== 'Hidden' && r.slug)
    .slice()
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((r: any) => ({
      id: r.slug,
      cat: r.internal_cat_mapping,
      status: r.visibility === 'Future' ? 'future' : 'published',
      art: r.art_key || '',
      name: langObj(r, 'name'),
      desc: langObj(r, 'desc'),
      seoTitle: langObj(r, 'seo_title'),
      seoDesc: langObj(r, 'seo_description'),
    }));

  const scenarios = (scnRows || [])
    .slice()
    .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
    .map((r: any) => ({
      code: r.scenario_code,
      id: r.slug,
      status: (r.status || 'Future').toLowerCase(),
      icon: r.icon || '',
      name: langObj(r, 'name'),
      desc: langObj(r, 'desc'),
      pain: langObj(r, 'pain_point'),
      img: r.hero_image_url || null,
      combo: (r.combo_skus || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    }))
    .filter((s: any) => s.status !== 'hidden');

  /* Built from the *published* category set only. A product pointing at a
     Hidden or deleted category must not emit a slug that isn't in
     DB.categories — the product page dereferences the category
     unconditionally and would render a blank page. */
  const publishedCategorySlugs = new Set(categories.map((c: any) => c.id));
  const categoryById = new Map((catRows || []).map((r: any) => [r.id, r.slug]));

  /* Two independent switches, deliberately:
       products.status  = "should this be on the site at all"
                          (only 'Published' is; Draft/Review/Hidden/
                          Discontinued are withheld entirely)
       products.launch_tier = "is it buyable yet"
                          ('Future' still shows, as a coming-soon card)
     Until 2026-07-28 `status` was ignored completely and visibility came only
     from launch_tier — so setting a product to Hidden left it live on the
     site while /admin's list badge implied otherwise. */
  const skipped: string[] = [];
  const withheld = (prodRows || []).filter((r: any) => r.status !== 'Published');
  const products = (prodRows || [])
    .filter((r: any) => r.status === 'Published')
    .map((r: any) => {
      const catSlug = categoryById.get(r.category_id) || null;
      const out: any = {
        sku: r.official_sku_code || r.product_id,
        slug: r.slug,
        status: r.launch_tier === 'Future' ? 'future' : 'published',
        /* launch_tier itself is NOT emitted. Nothing on the site read it, and its
           values ('A - Core', 'B - Test', 'C - Display') are an internal
           commercial classification that told anyone reading js/data.js which
           SKUs are trials or showroom-only. `status` above carries the only part
           the site needs. */
        category: catSlug && publishedCategorySlugs.has(catSlug) ? catSlug : null,
        scenarios: (scenariosByProduct.get(r.id) || []).slice().sort(),
        personas: r.persona || [],
        art: r.art_key || '',
        qi: QI_MAP[r.qi_status] || 'none',
        watt: r.charging_watt === 'None' || !r.charging_watt ? null : r.charging_watt,
        mount: (r.mount_type || []).map((m: string) => m.toLowerCase()),
        price: r.price_usd,
        rating: r.rating,
        reviews: r.review_count || 0,
        badge: r.badge,
        name: langObj(r, 'name'),
        claim: langObj(r, 'claim'),
        /* Report ids, resolved against DB.reports by the product page. Ids rather
           than embedded copies because a report covering 8 SKUs would otherwise
           be serialised 8 times into data.js. */
        reports: (reportKeysByProduct.get(r.id) || []).slice(),
        /* Fixed tag set (5 options), not prose — rendered through i18n labels, so
           adding a SKU costs no translation work. */
        pains: r.consumer_pain_point || [],
        gallery: r.gallery_urls || [],
        /* Per-product terms, falling back to config.warrantyMonths/exchangeDays
           in the front end when blank. */
        warranty: r.warranty_months || null,
        exchange: r.defect_exchange_days || null,
        seoTitle: langObj(r, 'seo_title'),
        seoDesc: langObj(r, 'seo_description'),
      };
      /* One item per line, split here rather than in the browser so the shape in
         data.js is already the list the page renders. Omitted entirely when
         blank: most products ship on their own, and an empty array per SKU is
         19 lines of noise that the front end would have to check for anyway. */
      const acc = langObj(r, 'accessories');
      const accLines: Record<string, string[]> = {};
      let accAny = false;
      for (const k of ['en', 'vi', 'id', 'zh'] as const) {
        const lines = String(acc[k] || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        accLines[k] = lines;
        if (lines.length) accAny = true;
      }
      if (accAny) out.accessories = accLines;
      if (r.spec_sheet_url) out.spec = r.spec_sheet_url;
      /* Empty arrays are the common case; omit them so data.js does not carry 19
         copies of `"faqs": []` and `"related": []`. */
      const ownFaqs = faqKeysByProduct.get(r.id);
      if (ownFaqs && ownFaqs.length) out.faqs = ownFaqs.slice();
      const ownRelated = relatedSkusByProduct.get(r.id);
      if (ownRelated && ownRelated.length) out.related = ownRelated.slice();
      if (r.hero_image_url) out.img = r.hero_image_url;
      /* Per-product Shopee link, falling back to the store-level URL. Without
         this every "Buy on Shopee" CTA on the site was a dead href="#" no
         matter what staff typed into the shopee_url field. */
      if (r.shopee_url) out.shopee = r.shopee_url;
      return out;
    })
    .filter((p: any) => {
      /* A row with no sku/slug can't be linked to, and one with no name in any
         language would publish as a blank card. Drop, but record it so the
         response says so instead of silently shrinking the catalog. */
      const named = p.name && (p.name.en || p.name.vi || p.name.id || p.name.zh);
      if (!p.sku || !p.slug || !named) { skipped.push(p.sku || p.slug || '(unnamed row)'); return false; }
      if (!p.category) skipped.push(`${p.sku} (no published category)`);
      return true;
    });

  const faqs = (faqRows || [])
    .map((r: any) => ({
      id: r.faq_key,
      cat: r.category || '',
      q: { en: r.question_en || '', vi: r.question_vi || '', id: r.question_id || '', zh: r.question_zh || '' },
      a: { en: r.answer_en || '', vi: r.answer_vi || '', id: r.answer_id || '', zh: r.answer_zh || '' },
    }))
    .filter((f: any) => f.id);

  /* Reports are emitted in the order the query returned (sort_order, then newest
     tested_date), and the product page preserves it. */
  const reports = (reportRows || []).map((r: any) => ({
    id: r.id,
    type: r.test_type || '',
    level: r.evidence_level || '',
    date: r.tested_date || null,
    file: r.report_file_url || null,
    title: langObj(r, 'title'),
    summary: langObj(r, 'summary'),
    limits: langObj(r, 'limitations'),
  })).filter((r: any) => r.title.en || r.title.vi || r.title.id || r.title.zh);

  const insights = (guideRows || []).map((r: any) => ({
    slug: r.slug,
    cat: r.category || '',
    date: r.published_date || null,
    img: r.hero_image_url || null,
    art: r.art_key || '',
    title: langObj(r, 'title'),
    excerpt: langObj(r, 'excerpt'),
    body: langObj(r, 'body'),
  })).filter((a: any) => a.slug && (a.title.en || a.title.vi || a.title.id || a.title.zh));

  /* Refuse to publish an obviously-broken catalog. Without this, one failed
     query or one bad filter would push an empty products array live and blank
     out the homepage, the product listing and every product page. */
  if (products.length === 0) {
    throw new Error('refusing to export: 0 publishable products (would blank the live site)');
  }

  const dbOut = { categories, scenarios, personas: STATIC.personas, products, tests: STATIC.tests, reports, insights, faqs, config: STATIC.config };

  const header = `/* ============================================================
   VIEMAG — Data Layer  (AUTO-GENERATED by supabase/functions/export-site-data)
   Source of truth: Supabase VIEMAG project. DO NOT edit by hand —
   edit in /admin and it re-exports automatically on save.
   Public fields only; internal margin/stock columns are not even SELECTed.
   zh (Traditional) is the base; zh-Hans auto-converts at runtime.
   ============================================================ */\n`;
  return {
    content: header + `window.DB = ${JSON.stringify(dbOut, null, 2)};\n`,
    counts: {
      categories: categories.length,
      scenarios: scenarios.length,
      products: products.length,
      faqs: faqs.length,
      reports: reports.length,
      insights: insights.length,
      productScenarioLinks: (linkRows || []).length,
      productReportLinks: (reportLinkRows || []).length,
      productFaqLinks: (faqLinkRows || []).length,
      productRelatedLinks: (relatedLinkRows || []).length,
    },
    skipped,
    /* Answers "why isn't my product on the site?" without needing DB access —
       the single most likely support question this pipeline generates. */
    withheld: withheld.map((r: any) => `${r.product_id} (status: ${r.status || 'empty'})`),
  };
}

/* UTF-8-safe base64. data.js always contains Chinese/Vietnamese/Indonesian
   text, so the naive btoa/atob pair mangles it: atob() returns a *byte*
   string, not decoded text, so comparing it against the original JS string
   never matched — which silently defeated the "nothing changed" check and
   made every single export produce an empty commit. */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function commitToGithub(content: string): Promise<{ committed: boolean; message: string }> {
  if (!GITHUB_PAT) return { committed: false, message: 'GITHUB_PAT secret not set — export built but not committed' };

  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'viemag-export-site-data',
  };

  /* Retry on 409: the GET-sha-then-PUT sequence is not atomic, so two exports
     overlapping (staff saving twice in a row, or two people editing at once)
     make the second PUT carry a stale sha and GitHub rejects it. Without this
     the later edit is silently never published. The Notion-era GitHub Action
     retried for the same reason; that retry was lost in the migration. */
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
    if (!getRes.ok && getRes.status !== 404) {
      throw new Error(`GitHub GET failed: ${getRes.status} ${await getRes.text()}`);
    }
    const existing = getRes.ok ? await getRes.json() : null;

    if (existing && base64ToUtf8(existing.content) === content) {
      return { committed: false, message: 'no changes — content identical' };
    }

    const body = {
      message: 'Export data.js from Supabase [skip ci]',
      content: utf8ToBase64(content),
      branch: GITHUB_BRANCH,
      ...(existing ? { sha: existing.sha } : {}),
    };
    const putRes = await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (putRes.ok) return { committed: true, message: 'committed to GitHub' };

    const errText = await putRes.text();
    const isConflict = putRes.status === 409 || putRes.status === 422;
    if (!isConflict || attempt === MAX_ATTEMPTS) {
      throw new Error(`GitHub PUT failed after ${attempt} attempt(s): ${putRes.status} ${errText}`);
    }
    // stale sha — re-read and retry with a short backoff
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  throw new Error('unreachable');
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
    const auth = await verifyCaller(req);
    if (!auth.ok) return json({ error: auth.reason }, 401);

    const built = await buildDataJs();
    const result = await commitToGithub(built.content);
    /* Return the row counts so a caller (and the /admin status line) can tell
       a real export from a silently-shrunken one. The Notion-era script logged
       these; losing them meant a partial export looked identical to a good one. */
    console.log('export ok', JSON.stringify({ ...result, counts: built.counts, skipped: built.skipped, withheld: built.withheld }));
    return json({ ...result, counts: built.counts, skipped: built.skipped, withheld: built.withheld });
  } catch (e) {
    /* Log the full error server-side, but don't echo it to the caller: for a
       GitHub failure String(e) embeds GitHub's response body, and this endpoint
       answers Access-Control-Allow-Origin: *. */
    console.error('export failed', e);
    const msg = e instanceof Error ? e.message : String(e);
    const safe = /^(refusing to export|query \w+ failed)/.test(msg) ? msg : 'export failed — see function logs';
    return json({ error: safe }, 500);
  }
});
