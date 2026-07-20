/* ============================================================
   VIEMAG — Notion → js/data.js exporter (build-time)
   Reads the VIEMAG 後台 Notion databases and regenerates
   js/data.js. Runs in CI (GitHub Actions) or locally.

   Usage:  NOTION_TOKEN=secret_xxx node scripts/export-notion.mjs

   SECURITY: this is a PUBLIC repo. Only the whitelisted public
   fields below are ever written to js/data.js. Internal fields
   (Minimum/Target Gross Margin, Promo Floor, Inventory First
   Batch, Certification Notes, Owner, cost/stock) are NEVER read
   or emitted. Do not add them.
   ============================================================ */

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) { console.error('Missing NOTION_TOKEN env var'); process.exit(1); }

const API = 'https://api.notion.com/v1';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// Database IDs under 「VIEMAG 後台」 (single-source databases)
const DB = {
  products: 'e5aaaf67b6e94d9c95c7095087faf6b5',
  categories: '980d48794ffb4ad8863d2c6ad865ce2a',
  scenarios: '1b273820a3354be0a4453eb16f1deecb',
  faq: '38264c50d1194d78b84ab03f40d30b1f',
};

/* ---- Notion query with pagination ---- */
async function queryAll(dbId) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`${API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion query ${dbId} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    rows.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return rows;
}

/* ---- property readers ---- */
const P = (page, name) => page.properties[name];
const txt = (p) => (p && p.type === 'rich_text' ? (p.rich_text.map((t) => t.plain_text).join('') || null) : null);
const titleOf = (p) => (p && p.type === 'title' ? (p.title.map((t) => t.plain_text).join('') || null) : null);
const sel = (p) => (p && p.type === 'select' ? (p.select ? p.select.name : null) : null);
const multi = (p) => (p && p.type === 'multi_select' ? p.multi_select.map((o) => o.name) : []);
const num = (p) => (p && p.type === 'number' ? p.number : null);
const rel = (p) => (p && p.type === 'relation' ? p.relation.map((r) => r.id.replace(/-/g, '')) : []);
const idOf = (page) => page.id.replace(/-/g, '');
const fileUrl = (p) => {
  if (!p || p.type !== 'files' || !p.files.length) return null;
  const f = p.files[0];
  const u = f.type === 'external' ? (f.external && f.external.url) : (f.file && f.file.url);
  return u ? { url: u, name: f.name || '' } : null;
};

const langObj = (page, prefix) => ({
  en: txt(P(page, `${prefix} EN`)) || '',
  vi: txt(P(page, `${prefix} VI`)) || '',
  id: txt(P(page, `${prefix} ID`)) || '',
  zh: txt(P(page, `${prefix} ZH`)) || '',
});

/* ---- value maps (Notion → frontend) ---- */
const TIER = { 'A 主力': 'A', 'B 測試': 'B', 'C 陳列': 'C', Future: 'Future' };
const QI = { 'Not applicable': 'none', Compatible: 'compatible', Testing: 'testing', Certified: 'certified', Pending: 'testing' };
const MOUNT = { Vent: 'vent', Dashboard: 'dashboard', Suction: 'suction', Tape: 'tape', Screen: 'screen', Desktop: 'desktop' };
const SCN_STATUS = { Primary: 'primary', Secondary: 'secondary', Supporting: 'supporting', Future: 'future', Hidden: 'hidden' };

/* ---- static blocks (no Notion source): personas, tests, config ----
   Maintained here by hand; carried through unchanged on every export. */
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
    dealerEndpoint: 'https://hook.us1.make.com/tns4rhmwtjcm36s4pwb8yn66xssy4uwt',
    supportEndpoint: 'https://hook.us1.make.com/j3qdnv692j5lwqjglno44vj21hf1zog4',
  },
};

/* ---- main ---- */
async function main() {
  const [catRows, scnRows, prodRows, faqRows] = await Promise.all([
    queryAll(DB.categories), queryAll(DB.scenarios), queryAll(DB.products), queryAll(DB.faq),
  ]);

  // id → slug/code maps for relation resolution
  const catById = new Map(catRows.map((r) => [idOf(r), txt(P(r, 'Slug'))]));
  const scnById = new Map(scnRows.map((r) => [idOf(r), sel(P(r, 'Scenario Code'))]));

  const categories = catRows
    .filter((r) => sel(P(r, 'Status')) !== 'Hidden' && txt(P(r, 'Slug')))
    .map((r) => ({
      id: txt(P(r, 'Slug')),
      cat: sel(P(r, 'Internal CAT Mapping')),
      status: sel(P(r, 'Public / Internal')) === 'Future' ? 'future' : 'published',
      sort: num(P(r, 'Sort Order')) || 0,
      art: txt(P(r, 'Art Key')) || '',
      name: langObj(r, 'Name'),
      desc: langObj(r, 'Desc'),
    }))
    .sort((a, b) => a.sort - b.sort);

  const scenarios = scnRows
    .map((r) => ({
      code: sel(P(r, 'Scenario Code')),
      id: txt(P(r, 'Slug')),
      priority: num(P(r, 'Priority')) || 0,
      status: SCN_STATUS[sel(P(r, 'Status'))] || 'future',
      icon: txt(P(r, 'Icon')) || '',
      name: langObj(r, 'Name'),
      desc: langObj(r, 'Desc'),
      combo: (txt(P(r, 'Combo SKUs')) || '').split(',').map((s) => s.trim()).filter(Boolean),
    }))
    .filter((s) => s.status !== 'hidden')
    .sort((a, b) => a.priority - b.priority);

  const products = prodRows
    .map((r) => {
      return {
        sku: txt(P(r, 'Official SKU Code')) || titleOf(P(r, 'Product ID')),
        slug: txt(P(r, 'Slug')),
        status: TIER[sel(P(r, 'Launch Tier'))] === 'Future' ? 'future' : 'published',
        tier: TIER[sel(P(r, 'Launch Tier'))] || 'Future',
        category: rel(P(r, 'Public Category')).map((id) => catById.get(id)).filter(Boolean)[0] || null,
        scenarios: rel(P(r, 'Scenario')).map((id) => scnById.get(id)).filter(Boolean),
        personas: multi(P(r, 'Persona')),
        art: sel(P(r, 'Art Key')) || '',
        _hero: fileUrl(P(r, 'Hero Image')),
        qi: QI[sel(P(r, 'Qi Status'))] || 'none',
        watt: sel(P(r, 'Charging Watt')) === 'None' ? null : sel(P(r, 'Charging Watt')),
        mount: multi(P(r, 'Mount Type')).map((m) => MOUNT[m]).filter(Boolean),
        price: num(P(r, 'Price USD')),
        rating: num(P(r, 'Rating')),
        reviews: num(P(r, 'Review Count')) || 0,
        badge: sel(P(r, 'Badge')),
        name: langObj(r, 'Name'),
        claim: langObj(r, 'Claim'),
      };
    })
    .filter((p) => p.sku && p.slug);

  /* ---- download Hero Images → assets/products/<sku>.<ext> (build-time,
     so Notion's expiring signed URLs never reach the front-end) ---- */
  {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const dir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../assets/products');
    fs.mkdirSync(dir, { recursive: true });
    for (const p of products) {
      const hero = p._hero; delete p._hero;
      if (!hero) continue;
      let ext = path.extname((hero.name || '').split('?')[0]).toLowerCase();
      if (!/^\.(jpe?g|png|webp|gif|avif)$/.test(ext)) ext = '.jpg';
      try {
        const res = await fetch(hero.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(path.join(dir, p.sku + ext), Buffer.from(await res.arrayBuffer()));
        p.img = `assets/products/${p.sku}${ext}`;
      } catch (e) { console.error(`Hero download failed for ${p.sku}: ${e.message}`); }
    }
  }

  const faqs = faqRows
    .filter((r) => sel(P(r, 'Status')) === 'Published')
    .map((r) => ({
      id: titleOf(P(r, 'FAQ Key')),
      q: { en: txt(P(r, 'Question EN')) || '', vi: txt(P(r, 'Question VI')) || '', id: txt(P(r, 'Question ID')) || '', zh: txt(P(r, 'Question ZH')) || '' },
      a: { en: txt(P(r, 'Answer EN')) || '', vi: txt(P(r, 'Answer VI')) || '', id: txt(P(r, 'Answer ID')) || '', zh: txt(P(r, 'Answer ZH')) || '' },
    }))
    .filter((f) => f.id);

  const dbOut = { categories, scenarios, personas: STATIC.personas, products, tests: STATIC.tests, faqs, config: STATIC.config };

  const header = `/* ============================================================
   VIEMAG — Data Layer  (AUTO-GENERATED by scripts/export-notion.mjs)
   Source of truth: Notion 「VIEMAG 後台」. DO NOT edit by hand —
   edit in Notion and re-run the exporter (or the GitHub Action).
   Public fields only; internal cost/margin/stock never exported.
   zh (Traditional) is the base; zh-Hans auto-converts at runtime.
   ============================================================ */\n`;
  const body = `window.DB = ${JSON.stringify(dbOut, null, 2)};\n`;

  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = await import('node:path');
  const outPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../js/data.js');
  fs.writeFileSync(outPath, header + body);
  console.log(`Wrote ${outPath}: ${categories.length} categories, ${scenarios.length} scenarios, ${products.length} products, ${faqs.length} faqs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
