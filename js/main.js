/* ============================================================
   VIEMAG — site engine
   i18n runtime · shared header/footer · SVG art · renderers
   ============================================================ */
(function () {
  'use strict';
  const DB = window.DB, DICT = window.I18N_DICT;
  const LANGS = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
    { code: 'id', label: 'Bahasa Indonesia', short: 'ID' },
    { code: 'zh-Hans', label: '简体中文', short: '简' },
    { code: 'zh', label: '繁體中文', short: '繁' }
  ];
  const SUPPORTED = LANGS.map((l) => l.code);

  /* Traditional→Simplified char map (generated offline via OpenCC tw→cn).
     zh (Traditional) is the writing base. zh-Hans is INDEPENDENT: a hand-tunable
     override (see DICT['zh-Hans'] in i18n.js, or a `zh-Hans` field on a data object)
     wins verbatim; any key/field with no override auto-converts from zh via toSimp().
     So the seed is editable without being clobbered, and new zh content still shows
     up Simplified for free. */
  const T2S = {"並":"并","來":"来","個":"个","們":"们","備":"备","僅":"仅","價":"价","儀":"仪","內":"内","創":"创","劃":"划","劇":"剧","動":"动","務":"务","協":"协","問":"问","單":"单","嗎":"吗","國":"国","圍":"围","圓":"圆","圖":"图","團":"团","報":"报","場":"场","墊":"垫","壞":"坏","壽":"寿","夥":"伙","夾":"夹","妝":"妆","學":"学","實":"实","審":"审","寫":"写","將":"将","專":"专","尋":"寻","對":"对","導":"导","屬":"属","幾":"几","廚":"厨","廠":"厂","廣":"广","強":"强","彎":"弯","後":"后","從":"从","態":"态","應":"应","戶":"户","換":"换","損":"损","撐":"撑","擁":"拥","擇":"择","擊":"击","擋":"挡","據":"据","擬":"拟","擴":"扩","攝":"摄","攤":"摊","數":"数","斷":"断","於":"于","時":"时","暫":"暂","曬":"晒","會":"会","條":"条","業":"业","構":"构","標":"标","樣":"样","機":"机","橫":"横","檢":"检","檻":"槛","欄":"栏","權":"权","殼":"壳","氣":"气","決":"决","沒":"没","況":"况","減":"减","測":"测","準":"准","溫":"温","潔":"洁","潤":"润","為":"为","無":"无","熱":"热","燙":"烫","營":"营","爛":"烂","狀":"状","環":"环","產":"产","畫":"画","異":"异","疊":"叠","發":"发","監":"监","盤":"盘","確":"确","種":"种","稱":"称","穩":"稳","節":"节","範":"范","篩":"筛","簡":"简","糾":"纠","紀":"纪","級":"级","細":"细","組":"组","結":"结","絡":"络","給":"给","統":"统","經":"经","維":"维","網":"网","緊":"紧","線":"线","緻":"致","繫":"系","續":"续","纏":"缠","聯":"联","脫":"脱","腳":"脚","膠":"胶","與":"与","艦":"舰","葉":"叶","著":"着","蓋":"盖","薦":"荐","處":"处","號":"号","螢":"萤","裝":"装","製":"制","複":"复","見":"见","規":"规","視":"视","觀":"观","觸":"触","計":"计","訊":"讯","設":"设","註":"注","評":"评","詞":"词","詢":"询","試":"试","話":"话","該":"该","詳":"详","認":"认","語":"语","說":"说","調":"调","談":"谈","請":"请","諾":"诺","證":"证","議":"议","護":"护","讓":"让","貨":"货","責":"责","貴":"贵","買":"买","費":"费","貼":"贴","資":"资","賣":"卖","質":"质","購":"购","車":"车","載":"载","輔":"辅","輕":"轻","輪":"轮","轉":"转","辦":"办","這":"这","週":"周","進":"进","運":"运","過":"过","達":"达","適":"适","選":"选","邊":"边","鉸":"铰","銷":"销","鎖":"锁","鏈":"链","長":"长","門":"门","開":"开","間":"间","關":"关","陣":"阵","陸":"陆","陽":"阳","隊":"队","際":"际","隨":"随","隱":"隐","隻":"只","雙":"双","電":"电","預":"预","頭":"头","顆":"颗","題":"题","額":"额","願":"愿","類":"类","顯":"显","風":"风","飯":"饭","驗":"验","體":"体","鬆":"松","麼":"么","點":"点","鐵":"铁","採":"采","壓":"压","軸":"轴","賴":"赖","藝":"艺"};
  /* TW→CN vocabulary overrides (phrase-level; char map can't localize these) */
  const T2S_PHRASE = { '螢幕': '屏幕', '行動電源': '移动电源', '影片': '视频', '回覆': '回复', '保固': '保修', '支援': '支持', '相容': '兼容', '視訊': '视频', '急煞': '急刹', '內建': '内置', '壓克力': '亚克力' };
  const toSimp = (s) => {
    if (s == null) return s;
    s = String(s);
    for (const k in T2S_PHRASE) s = s.split(k).join(T2S_PHRASE[k]);
    return s.replace(/[一-鿿]/g, (c) => T2S[c] || c);
  };

  /* ---------- i18n ---------- */
  /* First visit: detect from browser languages → supported code; else fall back to English.
     Only an explicit menu pick is persisted (setLang), so detection re-runs until the user chooses. */
  function detectLang() {
    const cands = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (const raw of cands) {
      const l = (raw || '').toLowerCase();
      if (l.startsWith('vi')) return 'vi';
      if (l.startsWith('id') || l.startsWith('in')) return 'id';   // 'in' = legacy Indonesian code
      if (l.startsWith('zh')) return /hant|-tw|-hk|-mo/.test(l) ? 'zh' : 'zh-Hans'; // TW/HK/MO → Traditional; else Simplified
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }
  let lang = localStorage.getItem('viemag-lang');
  if (!SUPPORTED.includes(lang)) lang = detectLang();
  const t = (key) => {
    if (lang === 'zh-Hans') {
      const ov = DICT['zh-Hans'];
      if (ov && ov[key] != null) return ov[key];       // hand-tuned seed/override wins verbatim
      const zh = DICT.zh || {};
      if (zh[key] != null) return toSimp(zh[key]);      // new/untuned key → auto-convert from zh
      return (DICT.en && DICT.en[key]) || key;
    }
    return (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || key;
  };
  const tf = (obj) => {
    if (!obj) return '';
    if (lang === 'zh-Hans') {
      if (obj['zh-Hans'] != null) return obj['zh-Hans']; // per-field override wins verbatim
      return toSimp(obj.zh || obj.en || '');             // no override → auto-convert
    }
    return obj[lang] || obj.en || '';
  };
  window.VIEMAG = { t, tf, get lang() { return lang; } };

  function setLang(next) {
    if (!SUPPORTED.includes(next)) return;
    localStorage.setItem('viemag-lang', next);
    location.reload();
  }

  /* ---------- icons (hand-drawn, lucide-style strokes) ---------- */
  const IC = {
    car: '<path d="M4 15l1.5-5.5A2 2 0 017.4 8h9.2a2 2 0 011.9 1.5L20 15M4 15h16M4 15v3.5a.5.5 0 00.5.5H6a1 1 0 001-1v-1h10v1a1 1 0 001 1h1.5a.5.5 0 00.5-.5V15M7.5 12h.01M16.5 12h.01"/>',
    desk: '<path d="M3 9h18M3 9v10M21 9v10M6 9V5.5A1.5 1.5 0 017.5 4h9A1.5 1.5 0 0118 5.5V9M8 19v-4h8v4"/>',
    plane: '<path d="M10.5 13.5L3 11l1.5-1.5L10 10l4-5.5L16 3l.5 2-2.5 5.5 3.5 1L19 10l2 1-8 3.5L11 21l-1.5-1 1-6.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    home: '<path d="M3 11l9-7 9 7M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    swap: '<path d="M4 8h13M14 4.5L17.5 8 14 11.5M20 16H7M10 12.5L6.5 16l3.5 3.5"/>',
    chat: '<path d="M21 12a8 8 0 01-8 8H4l2.4-2.9A8 8 0 1121 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    guide: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20M9 8h6"/>',
    magnet: '<path d="M6 4v7a6 6 0 0012 0V4M6 4h4v4H6zM14 4h4v4h-4z"/><path d="M10 21a9.5 9.5 0 01-4-3M14 21a9.5 9.5 0 004-3" stroke-dasharray="1.5 2.5"/>',
    thermo: '<path d="M10 4a2 2 0 014 0v9.5a4 4 0 11-4 0V4z"/><circle cx="12" cy="17" r="1.6"/>',
    wave: '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity=".45"/>',
    cycle: '<path d="M20 12a8 8 0 11-2.3-5.6M20 3v4h-4"/>',
    bolt: '<path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M8 10l4 4 4-4"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><path d="M16 5.5a3.5 3.5 0 010 6M18.5 20c-.2-2.3-1.2-4-2.8-4.9"/>'
  };
  const icon = (name, cls) =>
    `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`;
  window.VIEMAG.icon = icon;

  /* ---------- product art (placeholder illustrations) ---------- */
  const C = { navy: '#1A3A5C', mid: '#0F1F33', copper: '#C8941A', teal: '#2FA7A0', ivory: '#F8F5EF', line: '#D9D2C5' };
  const phone = (x, y, w, h, r) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${C.mid}"/>
    <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="${r - 2}" fill="#fff"/>
    <circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w * 0.26}" fill="none" stroke="${C.line}" stroke-width="2" stroke-dasharray="4 4"/>`;
  const bolt = (x, y, s) => `<path transform="translate(${x},${y}) scale(${s})" d="M6 0L0 8h3.6L2.8 15 9 6.6H5.2L6 0z" fill="${C.copper}"/>`;
  const ART = {
    vent: `<g><rect x="30" y="26" width="80" height="10" rx="5" fill="${C.ivory}" stroke="${C.line}"/><rect x="30" y="42" width="80" height="10" rx="5" fill="${C.ivory}" stroke="${C.line}"/><rect x="60" y="30" width="20" height="26" rx="6" fill="${C.navy}"/>${phone(46, 52, 48, 84, 10)}</g>`,
    dash: `<g><path d="M20 118q50-26 100 0v14H20z" fill="${C.ivory}" stroke="${C.line}"/><rect x="62" y="92" width="16" height="26" rx="5" fill="${C.navy}"/><circle cx="70" cy="92" r="12" fill="${C.navy}"/>${phone(46, 22, 48, 84, 10)}</g>`,
    suction: `<g><rect x="18" y="112" width="42" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><circle cx="39" cy="106" r="12" fill="${C.navy}"/><path d="M39 94q10-32 34-38" fill="none" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/><circle cx="76" cy="54" r="9" fill="${C.copper}"/>${phone(66, 16, 44, 78, 9)}</g>`,
    clip: `<g><rect x="20" y="20" width="64" height="44" rx="6" fill="${C.mid}"/><rect x="24" y="24" width="56" height="36" rx="4" fill="${C.teal}" opacity=".25"/><path d="M84 40h14" stroke="${C.navy}" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="40" r="8" fill="${C.navy}"/>${phone(84, 48, 42, 74, 9)}</g>`,
    tape: `<g><rect x="22" y="104" width="96 " height="10" rx="4" fill="${C.ivory}" stroke="${C.line}"/><rect x="52" y="84" width="36" height="20" rx="5" fill="${C.navy}"/><rect x="58" y="96" width="24" height="5" rx="2.5" fill="${C.copper}"/>${phone(46, 8, 48, 82, 10)}</g>`,
    pro: `<g><circle cx="70" cy="72" r="46" fill="none" stroke="${C.copper}" stroke-width="2.5" stroke-dasharray="6 6"/><circle cx="70" cy="72" r="34" fill="${C.navy}"/><circle cx="70" cy="72" r="24" fill="${C.ivory}"/><circle cx="70" cy="72" r="24" fill="none" stroke="${C.copper}" stroke-width="3"/><path d="M70 56a16 16 0 010 32" fill="none" stroke="${C.navy}" stroke-width="4" stroke-linecap="round"/></g>`,
    carcharge: `<g><rect x="30" y="26" width="80" height="10" rx="5" fill="${C.ivory}" stroke="${C.line}"/><rect x="60" y="30" width="20" height="22" rx="6" fill="${C.navy}"/>${phone(46, 48, 48, 84, 10)}${bolt(62, 74, 2.4)}</g>`,
    dashcharge: `<g><path d="M20 118q50-26 100 0v14H20z" fill="${C.ivory}" stroke="${C.line}"/><rect x="62" y="92" width="16" height="26" rx="5" fill="${C.navy}"/>${phone(46, 20, 48, 84, 10)}${bolt(62, 46, 2.4)}</g>`,
    fancharge: `<g>${phone(24, 26, 48, 86, 10)}<circle cx="94" cy="70" r="28" fill="${C.navy}"/><g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M94 70l0-16M94 70l14 8M94 70l-14 8"/></g><circle cx="94" cy="70" r="5" fill="${C.copper}"/><path d="M120 46q8 8 0 16M126 40q12 12 0 24" stroke="${C.teal}" stroke-width="2.5" fill="none" stroke-linecap="round"/>${bolt(40, 56, 2.2)}</g>`,
    suctioncharge: `<g><rect x="16" y="114" width="40" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><circle cx="36" cy="108" r="11" fill="${C.navy}"/><path d="M36 97q4-40 34-46" fill="none" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/>${phone(62, 14, 46, 80, 9)}${bolt(78, 42, 2.2)}</g>`,
    deskcharge: `<g><rect x="26" y="112" width="88" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><ellipse cx="70" cy="106" rx="34" ry="9" fill="${C.navy}"/>${phone(46, 20, 48, 82, 10)}${bolt(62, 48, 2.4)}</g>`,
    stand2in1: `<g><rect x="20" y="112" width="100" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><path d="M52 112l8-30" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/>${phone(42, 12, 44, 74, 9)}<rect x="88" y="94" width="30" height="18" rx="8" fill="${C.navy}"/><circle cx="98" cy="103" r="4" fill="#fff"/><circle cx="108" cy="103" r="4" fill="#fff"/>${bolt(58, 38, 2)}</g>`,
    fold: `<g><path d="M28 112L58 70h44l-6 42z" fill="${C.ivory}" stroke="${C.line}"/><rect x="52" y="30" width="46" height="46" rx="8" fill="${C.navy}"/><circle cx="75" cy="53" r="14" fill="none" stroke="${C.copper}" stroke-width="3"/>${bolt(70, 44, 1.8)}</g>`,
    ring: `<g><circle cx="70" cy="70" r="40" fill="none" stroke="${C.navy}" stroke-width="12"/><circle cx="70" cy="70" r="40" fill="none" stroke="${C.copper}" stroke-width="3" stroke-dasharray="8 10"/><rect x="62" y="24" width="16" height="6" rx="3" fill="${C.copper}"/></g>`,
    case: `<g>${phone(36, 18, 56, 100, 12)}<circle cx="64" cy="68" r="20" fill="none" stroke="${C.copper}" stroke-width="4"/><rect x="98" y="34" width="18" height="34" rx="6" fill="${C.navy}"/><circle cx="107" cy="44" r="4.5" fill="${C.ivory}"/></g>`,
    powerbank: `<g><rect x="30" y="34" width="52" height="88" rx="10" fill="${C.mid}"/><rect x="34" y="38" width="44" height="80" rx="7" fill="#fff"/><rect x="58" y="26" width="52" height="88" rx="10" fill="${C.navy}"/><circle cx="84" cy="70" r="18" fill="none" stroke="${C.copper}" stroke-width="3.5"/>${bolt(78, 58, 2.2)}</g>`,
    stand: `<g><rect x="24" y="112" width="92" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><path d="M70 112V84" stroke="${C.navy}" stroke-width="9" stroke-linecap="round"/><circle cx="70" cy="80" r="10" fill="${C.copper}"/>${phone(46, 10, 48, 72, 9)}</g>`,
    tripod: `<g><path d="M70 74L44 118M70 74l26 44M70 74v44" stroke="${C.navy}" stroke-width="7" stroke-linecap="round"/><circle cx="70" cy="66" r="11" fill="${C.copper}"/>${phone(48, 6, 44, 60, 8)}</g>`
  };
  const art = (key, label) =>
    `<svg viewBox="0 0 140 140" role="img" aria-label="${label || ''}">${ART[key] || ART.ring}</svg>`;
  window.VIEMAG.art = art;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stars = (r) => { const f = Math.round(r); return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f); };
  const money = (v) => v == null ? '' : `<small>US$</small>${v.toFixed(2).replace(/\.00$/, '')}`;
  const catById = (id) => DB.categories.find((c) => c.id === id);
  const scnByCode = (code) => DB.scenarios.find((s) => s.code === code);
  const prodBySku = (sku) => DB.products.find((p) => p.sku === sku);
  const published = DB.products.filter((p) => p.status === 'published');

  /* ---------- shared header / footer ---------- */
  const logoSvg = `<svg class="ring" viewBox="0 0 26 26" aria-hidden="true">
    <circle cx="13" cy="13" r="9.5" fill="none" stroke="${C.navy}" stroke-width="4"/>
    <path d="M13 3.5a9.5 9.5 0 019.5 9.5" fill="none" stroke="${C.copper}" stroke-width="4" stroke-linecap="round"/></svg>`;

  function header(active) {
    const nav = [
      ['products', 'products.html', 'nav.products'],
      ['scenarios', 'scenarios.html', 'nav.scenarios'],
      ['why', 'why-viemag.html', 'nav.why'],
      ['support', 'support.html', 'nav.support'],
      ['dealers', 'dealers.html', 'nav.dealers'],
      ['about', 'about.html', 'nav.about']
    ].map(([id, href, key]) =>
      `<a href="${href}" class="${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${t(key)}</a>`).join('');
    const langBtns = LANGS.map((l) =>
      `<button data-lang="${l.code}" class="${l.code === lang ? 'active' : ''}">${l.label}</button>`).join('');
    return `
    <header class="site-header">
      <div class="container header-inner">
        <a class="logo" href="index.html" aria-label="VIEMAG home">${logoSvg}VIEMAG</a>
        <nav class="main-nav" id="mainNav" aria-label="Main">${nav}</nav>
        <div class="header-actions">
          <div class="lang-switch">
            <button class="lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false">${icon('globe')}${(LANGS.find((l) => l.code === lang) || {}).short || lang.toUpperCase()}${icon('chevron')}</button>
            <div class="lang-menu" id="langMenu" role="menu">${langBtns}</div>
          </div>
          <a class="btn btn-primary btn-sm header-cta" href="${DB.config.shopeeUrl}" target="_blank" rel="noopener">${t('cta.shopee')}</a>
          <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">${icon('menu')}</button>
        </div>
      </div>
    </header>`;
  }

  function footer() {
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="logo" href="index.html">${logoSvg.replace(C.navy, '#F8F5EF')}VIEMAG</a>
            <p>${t('footer.desc')}</p>
            <div class="tagline">VIEMAG — Value . Innovation . Excellence.</div>
          </div>
          <div>
            <h4>${t('footer.products')}</h4>
            <ul>${DB.categories.filter((c) => c.status === 'published').map((c) =>
              `<li><a href="products.html?cat=${c.id}">${esc(tf(c.name))}</a></li>`).join('')}</ul>
          </div>
          <div>
            <h4>${t('footer.support')}</h4>
            <ul>
              <li><a href="support.html">${t('footer.warranty')}</a></li>
              <li><a href="support.html#faq">${t('footer.faq')}</a></li>
              <li><a href="why-viemag.html">${t('nav.why')}</a></li>
            </ul>
          </div>
          <div>
            <h4>${t('footer.company')}</h4>
            <ul>
              <li><a href="about.html">${t('footer.about')}</a></li>
              <li><a href="dealers.html">${t('footer.dealer')}</a></li>
              <li><a href="scenarios.html">${t('nav.scenarios')}</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-trust">
          <span>${icon('shield')}${t('footer.trust1')}</span>
          <span>${icon('swap')}${t('footer.trust2')}</span>
          <span>${icon('chat')}${t('footer.trust3')}</span>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${t('footer.rights')}</span>
          <span style="max-width:560px">${t('footer.legal')}</span>
        </div>
      </div>
    </footer>`;
  }

  /* ---------- renderers ---------- */
  function qiChip(p) {
    if (p.qi === 'none' || !p.qi) return '';
    return `<span class="chip qi">${t('qi.' + p.qi)}</span>`;
  }
  function productCard(p) {
    const cat = catById(p.category);
    const future = p.status === 'future';
    const badge = p.badge ? `<span class="badge ${p.badge}">${p.badge === 'soon' ? t('cats.soon') : p.badge === 'new' ? 'New' : 'Best seller'}</span>` : '';
    const ratingHtml = p.rating
      ? `<div class="rating"><span class="stars" aria-hidden="true">${stars(p.rating)}</span><b>${p.rating.toFixed(1)}</b><span>(${p.reviews})</span></div>` : '';
    const foot = future
      ? `<div class="foot"><span class="chip">${t('cats.soon')}</span></div>`
      : `<div class="foot"><span class="price">${money(p.price)}</span><span class="btn btn-ghost btn-sm">${t('cta.view')}</span></div>`;
    return `
    <a class="prod-card" href="product.html?sku=${encodeURIComponent(p.sku)}" aria-label="${esc(tf(p.name))}">
      <div class="thumb">${badge}${art(p.art, tf(p.name))}</div>
      <div class="body">
        <span class="cat-label">${cat ? esc(tf(cat.name)) : ''}</span>
        <h3>${esc(tf(p.name))}</h3>
        <p class="claim">${esc(tf(p.claim))}</p>
        <div class="meta-chips">${qiChip(p)}${(p.mount || []).slice(0, 2).map((m) => `<span class="chip">${t('mount.' + m)}</span>`).join('')}</div>
        ${ratingHtml}
        ${foot}
      </div>
    </a>`;
  }
  function categoryCard(c) {
    const count = published.filter((p) => p.category === c.id).length;
    const future = c.status === 'future';
    return `
    <a class="cat-card" href="products.html?cat=${c.id}">
      ${future ? `<span class="soon">${t('cats.soon')}</span>` : ''}
      <div class="cat-art">${art(c.art, tf(c.name))}</div>
      <div>
        <div class="code">${c.cat}</div>
        <h3>${esc(tf(c.name))}</h3>
        <p>${esc(tf(c.desc))}</p>
        <div class="count">${future ? '' : `${count} ${t('cats.count')}`} ${icon('arrow')}</div>
      </div>
    </a>`;
  }
  function scenarioCard(s) {
    return `
    <a class="scn-card" href="scenarios.html#${s.id}">
      <span class="tag">${t('scns.tag.' + s.status)}</span>
      <div class="scn-icon">${icon(s.icon)}</div>
      <div class="scn-code">${s.code}</div>
      <h3>${esc(tf(s.name))}</h3>
      <p>${esc(tf(s.desc))}</p>
    </a>`;
  }
  function personaCard(pe) {
    const picks = pe.picks.map((id) => catById(id)).filter(Boolean)
      .map((c) => `<a class="chip" href="products.html?cat=${c.id}">${esc(tf(c.name))}</a>`).join(' ');
    return `
    <div class="persona-card">
      <div class="avatar">${icon(pe.icon)}</div>
      <div class="age">${pe.age}</div>
      <h3>${esc(tf(pe.name))}</h3>
      <p>${esc(tf(pe.desc))}</p>
      <div class="picks">${t('personas.picks')}</div>
      <div class="meta-chips">${picks}</div>
    </div>`;
  }
  function faqItem(f) {
    return `
    <details class="faq-item">
      <summary>${esc(tf(f.q))}</summary>
      <div class="answer">${esc(tf(f.a))}</div>
    </details>`;
  }

  /* ---------- boot ---------- */
  function applyI18nAttrs(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n')); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  }

  function boot() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
    const active = document.body.dataset.page || '';
    document.body.insertAdjacentHTML('afterbegin', header(active));
    document.body.insertAdjacentHTML('beforeend', footer());
    if (document.body.dataset.keepTitle !== '1') document.title = t('meta.title');

    /* language menu */
    const langBtn = document.getElementById('langBtn');
    const langMenu = document.getElementById('langMenu');
    langBtn.addEventListener('click', () => {
      const open = langMenu.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.lang-switch')) { langMenu.classList.remove('open'); langBtn.setAttribute('aria-expanded', 'false'); }
    });
    langMenu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

    /* mobile nav */
    const navToggle = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
      navToggle.innerHTML = icon(open ? 'close' : 'menu');
    });

    applyI18nAttrs(document);

    /* per-page render hook (injects dynamic .reveal content) */
    if (typeof window.renderPage === 'function') window.renderPage({ t, tf, icon, art, productCard, categoryCard, scenarioCard, personaCard, faqItem, stars, money, esc, catById, scnByCode, prodBySku, published, applyI18nAttrs });

    /* scroll reveal — observe AFTER dynamic content exists so injected cards animate in */
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
