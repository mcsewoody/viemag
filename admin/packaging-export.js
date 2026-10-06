/* VIEMAG Admin — packaging text export.
   Turns one product's Packaging tab into a plain .txt the packaging designer can
   work straight from. Kept out of admin.js because that file is already long
   enough that finding anything in it is a search rather than a read.

   Two rules decide everything this file does:

     1. Nothing empty is printed. Woody, 2026-09-29: "designers get exactly the
        information they need — no more, no less. Don't export what won't be
        used." A heading with nothing under it is worse than a missing heading,
        because it reads as "this was considered and left blank on purpose".
     2. Whatever the form already knows, the designer should not have to retype.
        Every section falls back to the product's existing fields, so a SKU whose
        Packaging tab is untouched still exports something usable.

   Legal frame: Decree 37/2026/ND-CP, in force 2026-01-23, replacing 43/2017 and
   111/2021. Articles 39-47 and Appendix I. Nothing here is legal advice and the
   checks below are not a compliance certificate — see PRE-PRINT CHECKS.

   This file is PUBLIC (https://viemag.biz/admin/packaging-export.js is fetchable
   by anyone), same as schema.js. That is why the brand block is no longer a
   constant in here: it is a row of brand_settings, passed in as an argument, so
   a registered company address lives behind a login instead of on the open web.
   Nothing about suppliers, costs or manufacturing origin may ever be added here.

   Every line in the brand block must be confirmed by the Vietnamese importer or
   a regulatory adviser against the actual manufacturing contract BEFORE any file
   goes to print (Article 44). */
(function () {
  "use strict";

  /* The product-type rules come from admin/schema.js, which admin/index.html
     loads first. One declaration, read by both the form that collects the data
     and the export that prints it — previously each file had its own copy and a
     comment asking the other to stay in step, which they did not. */
  var PKG = window.VIEMAG_PKG_TYPES;

  var LANGS = [
    { code: "vi", label: "VI — Tiếng Việt" },
    { code: "en", label: "EN — English" },
    { code: "id", label: "ID — Bahasa Indonesia" },
    { code: "zh", label: "ZH — 繁體中文" },
  ];

  /* Section headings, numbered as Woody listed them so a line in the file can be
     matched against the request it came from without translating anything. */
  var SECTIONS = {
    vi: {
      name: "1. Tên sản phẩm",
      model: "2. Mã model",
      instructions: "3. Hướng dẫn sử dụng và lưu ý",
      contents: "4. Nội dung bên trong",
      material: "5. Chất liệu / thành phần chính",
      specs: "6. Thông số kỹ thuật",
      barcode: "7. Mã vạch EAN/UPC",
    },
    en: {
      name: "1. Product name",
      model: "2. Model number",
      instructions: "3. Instructions for use and precautions",
      contents: "4. Contents",
      material: "5. Main material / composition",
      specs: "6. Technical specifications",
      barcode: "7. Barcode EAN/UPC",
    },
    id: {
      name: "1. Nama produk",
      model: "2. Nomor model",
      instructions: "3. Petunjuk penggunaan dan peringatan",
      contents: "4. Isi kemasan",
      material: "5. Material / komposisi utama",
      specs: "6. Spesifikasi teknis",
      barcode: "7. Barcode EAN/UPC",
    },
    zh: {
      name: "1. 品名",
      model: "2. 型號",
      instructions: "3. 使用與注意事項",
      contents: "4. 內容物",
      material: "5. 主要材質／成分",
      specs: "6. 技術規格",
      barcode: "7. 條碼 EAN/UPC",
    },
  };

  /* Which spec block belongs to which product type. Combined product gets more
     than one, which is the entire reason that option exists — a magnetic power
     bank is genuinely two of these at once and picking one would mean typing the
     other into the wrong box. */
  var SPEC_BLOCKS = [
    {
      prefix: "magnetic_bracket_specs",
      types: PKG.bracket,
      label: {
        vi: "6A. Giá đỡ nam châm",
        en: "6A. Magnetic bracket",
        id: "6A. Braket magnetik",
        zh: "6A. 磁吸支架",
      },
    },
    {
      prefix: "charging_specs",
      types: PKG.charging,
      label: {
        vi: "6B. Sản phẩm sạc",
        en: "6B. Charging product",
        id: "6B. Produk pengisi daya",
        zh: "6B. 充電產品",
      },
    },
    {
      prefix: "power_bank_specs",
      types: PKG.battery,
      label: {
        vi: "6C. Sạc dự phòng",
        en: "6C. Power bank",
        id: "6C. Power bank",
        zh: "6C. 充電寶",
      },
    },
  ];

  /* The measurable attributes of each spec block, in printing order.

     The VALUES carry no language — "9V", "N52", "10000" are the same characters
     in all four — so they are stored in one column each and printed verbatim.
     Only the LABEL in front of them is translated, which is why the dictionary
     is here rather than in the schema: it is a printing concern.

     They are counted as neutral when deciding whether a language block has
     anything in it, for the same reason the model number is. Four blocks of
     identical numbers under four translated labels would read as three
     abandoned translations. */
  var SPEC_ATTRS = {
    magnetic_bracket_specs: [
      { name: "magnet_grade",         vi: "Cấp nam châm",          en: "Magnet grade",            id: "Kelas magnet",              zh: "磁鐵規格" },
      { name: "clamp_range_mm",       vi: "Dải kẹp",               en: "Clamping range",          id: "Rentang jepit",             zh: "夾持範圍",       unit: "mm" },
    ],
    charging_specs: [
      { name: "input_voltage",        vi: "Điện áp vào",           en: "Input voltage",           id: "Tegangan masuk",            zh: "輸入電壓" },
      { name: "input_current",        vi: "Dòng vào",              en: "Input current",           id: "Arus masuk",                zh: "輸入電流" },
      { name: "input_power",          vi: "Công suất vào",         en: "Input power",             id: "Daya masuk",                zh: "輸入功率" },
      { name: "wireless_output_power",vi: "Công suất sạc không dây",en: "Wireless output",        id: "Keluaran nirkabel",         zh: "無線輸出功率" },
      { name: "max_output_power",     vi: "Công suất tối đa",      en: "Maximum output",          id: "Keluaran maksimum",         zh: "最高輸出功率" },
      { name: "connector_type",       vi: "Loại cổng",             en: "Connector",               id: "Jenis konektor",            zh: "接口形式" },
      { name: "wired_output_voltage", vi: "Điện áp ra (có dây)",   en: "Wired output voltage",    id: "Tegangan keluar berkabel",  zh: "有線輸出電壓" },
      { name: "wired_output_current", vi: "Dòng ra (có dây)",      en: "Wired output current",    id: "Arus keluar berkabel",      zh: "有線輸出電流" },
      { name: "wired_output_power",   vi: "Công suất ra (có dây)", en: "Wired output power",      id: "Daya keluar berkabel",      zh: "有線輸出功率" },
    ],
    power_bank_specs: [
      { name: "battery_type",         vi: "Loại pin",              en: "Battery type",            id: "Jenis baterai",             zh: "電池種類" },
      { name: "battery_capacity_mah", vi: "Dung lượng",            en: "Capacity",                id: "Kapasitas",                 zh: "電池容量",       unit: "mAh" },
      { name: "rated_voltage",        vi: "Điện áp danh định",     en: "Rated voltage",           id: "Tegangan nominal",          zh: "標稱電壓" },
      { name: "watt_hour_wh",         vi: "Watt-giờ",              en: "Watt-hours",              id: "Watt-jam",                  zh: "瓦時",           unit: "Wh" },
      { name: "port1_spec",           vi: "Cổng 1",                en: "Port 1",                  id: "Port 1",                    zh: "接口 1" },
      { name: "port2_spec",           vi: "Cổng 2",                en: "Port 2",                  id: "Port 2",                    zh: "接口 2" },
      { name: "port3_spec",           vi: "Cổng 3",                en: "Port 3",                  id: "Port 3",                    zh: "接口 3" },
      { name: "max_combined_output",  vi: "Tổng công suất tối đa", en: "Maximum combined output", id: "Total keluaran maksimum",   zh: "多口同時輸出上限" },
    ],
  };

  /* Headings for the sections 20260930120000 did not have columns for. Same
     numbering convention as SECTIONS so a designer can match a line in the file
     to the request it came from. */
  var EXTRA_SECTIONS = {
    vi: { storage: "3B. Hướng dẫn bảo quản", lithium: "6D. Cảnh báo pin lithium", notes: "Ghi chú cho designer (KHÔNG in lên hộp)" },
    en: { storage: "3B. Storage instructions", lithium: "6D. Lithium battery warning", notes: "Notes for the designer (NOT printed)" },
    id: { storage: "3B. Petunjuk penyimpanan", lithium: "6D. Peringatan baterai litium", notes: "Catatan untuk desainer (TIDAK dicetak)" },
    zh: { storage: "3B. 保存方法", lithium: "6D. 鋰電池警語", notes: "給設計師的備註（不印在盒上）" },
  };

  function str(v) {
    return v == null ? "" : String(v).trim();
  }

  /* First non-empty wins. The packaging value, then whatever the product already
     holds — so an untouched Packaging tab still exports a usable file instead of
     a form with the words missing. */
  function pick() {
    for (var i = 0; i < arguments.length; i++) {
      var v = str(arguments[i]);
      if (v) return v;
    }
    return "";
  }

  /* Each line trimmed then re-indented, so text pasted out of a spreadsheet with
     its own leading spaces lines up with text typed by hand. `pad` is the number
     of spaces; the spec sub-blocks sit one level deeper than everything else. */
  function indent(text, pad) {
    var lead = new Array((pad || 3) + 1).join(" ");
    return str(text)
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim() ? lead + line.trim() : "";
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  /* An EAN-13 is 13 digits whose last one is a checksum over the other twelve.
     Verifying it here costs four lines and catches the single most expensive
     mistake in this whole workflow: a transposed digit is invisible to a
     proofreader and only shows up as a scanner that reads nothing, after the
     boxes are printed.

     The packaging-source discussion tightened this to EAN-13 only. UPC-A can
     be represented in EAN-13 space, but the administered code must still be the
     exact 13-digit value that maps to the SKU, carton, and marketplace record.

     String() first, and not just for the regex: the regex coerces on its own,
     but code[i] on a Number is undefined and the checksum would then be NaN and
     always fail. The function is on window, so it can be called with whatever a
     caller happens to hold. */
  function ean13Valid(code) {
    code = String(code == null ? "" : code).trim();
    if (!/^\d{13}$/.test(code)) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) {
      sum += Number(code[i]) * (i % 2 ? 3 : 1);
    }
    return (10 - (sum % 10)) % 10 === Number(code[12]);
  }

  /* The pre-print checks, one entry per verdict, four languages each.

     They were English-only string literals until buildSubLabel() started
     appending them: a designer handed a file headed NHÃN PHỤ TIẾNG VIỆT read
     nine Vietnamese sections and then hit thirteen English sentences,
     including the two [FAIL] lines that are the entire reason the checks
     exist. The checks are the part a human must act on, so they are the part
     that most needed translating.

     {0} is the one value a line carries — a barcode, a Qi ID, a year. One slot
     is enough for every check here and keeps the table readable. */
  var CHECKS = {
    nameOk:        { vi: "[ok]   Có tên sản phẩm tiếng Việt", en: "[ok]   Vietnamese product name present", id: "[ok]   Nama produk bahasa Vietnam tersedia", zh: "[ok]   已有越南文品名" },
    nameMissing:   { vi: "[FAIL] Thiếu tên sản phẩm tiếng Việt — Điều 42 bắt buộc, và tên thương hiệu hay mã model không được tính là tên sản phẩm", en: "[FAIL] No Vietnamese product name — required by Article 42, and a brand or model code does not count as one", id: "[FAIL] Tidak ada nama produk bahasa Vietnam — diwajibkan Pasal 42; merek atau kode model tidak dihitung", zh: "[FAIL] 沒有越南文品名——第 42 條強制要求，品牌名或型號不算品名" },
    noType:        { vi: "[WARN] Chưa chọn loại bao bì — không chọn được khối thông số kỹ thuật nào", en: "[WARN] No packaging product type chosen — no technical specification block could be selected", id: "[WARN] Jenis produk kemasan belum dipilih — tidak ada blok spesifikasi yang dapat dipilih", zh: "[WARN] 尚未選擇包裝產品類型——無法選出對應的技術規格區塊" },
    eanMissing:    { vi: "[FAIL] Mã vạch EAN/UPC còn trống — không gửi in khi mã chưa được cấp", en: "[FAIL] Barcode EAN/UPC is empty — do not send to print before the code has been issued", id: "[FAIL] Barcode EAN/UPC kosong — jangan kirim ke percetakan sebelum kode diterbitkan", zh: "[FAIL] 條碼 EAN/UPC 空白——條碼未配發前不得送印" },
    eanInvalid:    { vi: "[FAIL] Mã vạch {0} không phải EAN-13 hợp lệ (13 chữ số, số cuối là chữ số kiểm tra)", en: "[FAIL] Barcode {0} is not a valid EAN-13 (13 digits, last one a check digit)", id: "[FAIL] Barcode {0} bukan EAN-13 yang sah (13 digit, digit terakhir adalah check digit)", zh: "[FAIL] 條碼 {0} 不是有效的 EAN-13（13 位數字，最後一位為檢查碼）" },
    eanOk:         { vi: "[ok]   Mã vạch EAN-13 {0} đúng chữ số kiểm tra", en: "[ok]   Barcode EAN-13 {0} passes its check digit", id: "[ok]   Barcode EAN-13 {0} lolos check digit", zh: "[ok]   條碼 EAN-13 {0} 檢查碼正確" },
    qiOk:          { vi: "[ok]   Được in logo Qi — đã chứng nhận, mã WPC {0}", en: "[ok]   Qi logo may be printed — certified, WPC ID {0}", id: "[ok]   Logo Qi boleh dicetak — bersertifikat, WPC ID {0}", zh: "[ok]   可印 Qi 標誌——已認證，WPC ID {0}" },
    qiNoId:        { vi: "[FAIL] Trạng thái Qi là Certified nhưng chưa có mã Qi — không in logo Qi cho tới khi điền mã", en: "[FAIL] Qi status is Certified but no Qi ID is recorded — do not print the Qi logo until the ID is filled in", id: "[FAIL] Status Qi adalah Certified tetapi Qi ID belum dicatat — jangan cetak logo Qi sebelum ID diisi", zh: "[FAIL] Qi 狀態為 Certified 但未登錄 Qi ID——填入 ID 前不得印 Qi 標誌" },
    qiForbidden:   { vi: "[WARN] KHÔNG được in logo Qi và chữ Certified lên hộp này (trạng thái Qi: {0})", en: "[WARN] Qi logo and the word Certified MUST NOT appear on this box (Qi status: {0})", id: "[WARN] Logo Qi dan kata Certified TIDAK BOLEH muncul pada kotak ini (status Qi: {0})", zh: "[WARN] 本盒不得出現 Qi 標誌與 Certified 字樣（Qi 狀態：{0}）" },
    originMissing: { vi: "[FAIL] Chưa điền xuất xứ — Điều 42 bắt buộc trên mọi nhãn, không phân biệt loại hàng", en: "[FAIL] Country of origin is empty — Article 42 requires it on every label, whatever the product is", id: "[FAIL] Negara asal kosong — Pasal 42 mewajibkannya pada setiap label, apa pun produknya", zh: "[FAIL] 未填原產地——第 42 條要求每一張標示都必須標明，不分商品類別" },
    yearFilled:    { vi: "[WARN] Năm sản xuất ghi {0} — năm thay đổi theo lô, hãy đối chiếu với lô đang in", en: "[WARN] Year of manufacture reads {0} — it changes per batch, so confirm it against the run being printed", id: "[WARN] Tahun pembuatan tertulis {0} — berubah per batch, cocokkan dengan produksi yang dicetak", zh: "[WARN] 製造年份為 {0}——此值逐批不同，請與本次印製的批次核對" },
    yearMissing:   { vi: "[WARN] Hàng điện bắt buộc có năm sản xuất, và năm thay đổi theo lô — điền lúc gửi in", en: "[WARN] Year of manufacture is required for electrical goods and changes per batch — fill it in at print time", id: "[WARN] Tahun pembuatan wajib untuk barang elektrik dan berubah per batch — isi saat akan dicetak", zh: "[WARN] 帶電產品必須標製造年份，且逐批不同——送印時填入" },
    whOk:          { vi: "[ok]   Đã khai watt-giờ ({0} Wh) — con số vận chuyển hàng không yêu cầu", en: "[ok]   Watt-hours declared ({0} Wh) — the figure air freight asks for", id: "[ok]   Watt-jam dinyatakan ({0} Wh) — angka yang diminta angkutan udara", zh: "[ok]   已申報瓦時（{0} Wh）——空運所需的數值" },
    whMissing:     { vi: "[FAIL] Sản phẩm có pin nhưng chưa khai watt-giờ — vận chuyển hàng không sẽ không nhận hàng", en: "[FAIL] No watt-hour figure for a product with cells — air freight will not accept the goods without it", id: "[FAIL] Produk berbaterai tanpa angka watt-jam — angkutan udara tidak akan menerima barang", zh: "[FAIL] 含電芯產品未申報瓦時——空運不會收貨" },
    lithiumMissing:{ vi: "[FAIL] Thiếu cảnh báo pin lithium tiếng Việt — bắt buộc với mọi sản phẩm có pin", en: "[FAIL] No Vietnamese lithium-cell warning — required on anything containing cells", id: "[FAIL] Tidak ada peringatan sel litium bahasa Vietnam — wajib untuk produk berbaterai", zh: "[FAIL] 缺越南文鋰電池警語——含電芯產品一律必填" },
    brandMissing:  { vi: "[FAIL] Chưa điền công ty chịu trách nhiệm và/hoặc nhà nhập khẩu Việt Nam — điền một lần ở trang Thông tin pháp lý trên bao bì", en: "[FAIL] Responsible company and/or Vietnam importer is not yet filled in — set it once on the Packaging legal block page", id: "[FAIL] Perusahaan penanggung jawab dan/atau importir Vietnam belum diisi — isi sekali di halaman blok legal kemasan", zh: "[FAIL] 尚未填寫責任公司及／或越南進口商——請於「包裝法規資訊」頁一次設定" },
    notCert:       { vi: "[note] Ghi nhãn không phải là chứng nhận. Việc hợp quy và dấu CR được xác nhận theo từng model với nhà nhập khẩu; danh sách này không thay thế việc đó.", en: "[note] Labelling is not certification. Conformity approval and the CR mark are confirmed per model with the importer; this checklist does not replace that.", id: "[note] Pelabelan bukan sertifikasi. Persetujuan kesesuaian dan tanda CR dikonfirmasi per model dengan importir; daftar ini tidak menggantikannya.", zh: "[note] 標示不等於認證。合規核可與 CR 標誌須就各型號與進口商確認；本檢核表不能取代該程序。" },
  };

  function check(key, lang, value) {
    var row = CHECKS[key];
    var text = (row && (row[lang] || row.en)) || key;
    return text.replace("{0}", value == null ? "" : String(value));
  }

  /* The checks are advisory on purpose, and they are in the FILE rather than in
     the form. Blocking Save would only produce placeholder barcodes; putting the
     verdict at the top of the document the designer actually opens puts it in
     front of the person who is about to act on it.

     Not a compliance certificate: labelling correctly is not the same as being
     approved for sale. Conformity certification and the CR mark are decided per
     model with the importer, and no generic checklist can stand in for that. */
  function preflight(pkg, product, brand, lang) {
    lang = lang || "en";
    var out = [];
    var type = str(pkg.packaging_product_type);
    var electric = PKG.charging.indexOf(type) !== -1;
    var add = function (key, value) {
      out.push(check(key, lang, value));
    };

    add(pick(pkg.packaging_name_vi, product.name_vi) ? "nameOk" : "nameMissing");

    if (!type) add("noType");

    var ean = str(pkg.barcode_ean_upc);
    if (!ean) add("eanMissing");
    else if (!ean13Valid(ean)) add("eanInvalid", ean);
    else add("eanOk", ean);

    /* The V3 coding manual dropped the certification marker from the SKU itself
       (section 7.2): the code no longer tells anyone whether the Qi logo may be
       printed, and the manual says that gate has to be rebuilt in process. This
       line is that gate. */
    if (str(product.qi_status) === "Certified") {
      var qiId = str(product.qi_id);
      add(qiId ? "qiOk" : "qiNoId", qiId);
    } else {
      add("qiForbidden", str(product.qi_status) || "—");
    }

    if (!str(pkg.country_of_origin)) add("originMissing");

    if (electric) {
      /* Appendix I category 40. A filled-in year is still only right for the
         batch it was typed for, so the warning stays either way — it just
         changes from "nothing is here" to "check this is still the batch". */
      var year = str(pkg.manufacturing_year);
      add(year ? "yearFilled" : "yearMissing", year);
    }

    if (PKG.battery.indexOf(type) !== -1) {
      var wh = str(pkg.watt_hour_wh);
      add(wh ? "whOk" : "whMissing", wh);
      if (!pick(pkg.lithium_warning_vi)) add("lithiumMissing");
    }

    if (!str(brand.responsible_company) || !str(brand.importer_name)) {
      add("brandMissing");
    }

    add("notCert");
    return out;
  }

  function header(pkg, product, today) {
    var lines = [];
    var sku = pick(product.official_sku_code, product.product_id);
    lines.push("VIEMAG PACKAGING TEXT");
    lines.push("SKU: " + (sku || "(no SKU)") + "                  Exported: " + today);
    if (str(pkg.packaging_product_type)) lines.push("Packaging type: " + str(pkg.packaging_product_type));
    if (str(pkg.packaging_status)) lines.push("Packaging status: " + str(pkg.packaging_status));
    lines.push("");

    var pairs = [
      ["Model number", pick(pkg.model_number, product.official_sku_code, product.product_id)],
      ["Barcode EAN/UPC", str(pkg.barcode_ean_upc)],
      ["Country of origin", str(pkg.country_of_origin)],
      /* Still a fill-in line when the column is empty: the value belongs to a
         production batch, so a blank for the printer is the honest output and
         an invented year is the one thing worse than no year. */
      ["Year of manufacture", pick(pkg.manufacturing_year, "____  (per production batch)")],
      ["Mount type", [].concat(product.mount_type || []).join(", ")],
      ["Charging", str(product.charging_watt) === "None" ? "" : str(product.charging_watt)],
      ["Warranty", product.warranty_months ? product.warranty_months + " months" : ""],
      ["Main image", str(product.hero_image_url)],
    ];
    pairs.forEach(function (p) {
      if (p[1]) lines.push(pad(p[0]) + p[1]);
    });

    var gallery = [].concat(product.gallery_urls || []).filter(Boolean);
    gallery.forEach(function (url, i) {
      lines.push(pad(i === 0 ? "Gallery images" : "") + url);
    });
    if (str(product.spec_sheet_url)) lines.push(pad("Spec sheet") + str(product.spec_sheet_url));

    return lines.join("\n");
  }

  function pad(label) {
    var s = label ? label + ":" : "";
    while (s.length < 21) s += " ";
    return s;
  }

  function brandBlock(brand, product) {
    var lines = ["BRAND INFORMATION — identical on every SKU"];
    var pairs = [
      ["Responsible company", str(brand.responsible_company)],
      ["Address", str(brand.responsible_address)],
      ["Manufacturer", str(brand.manufacturer_name)],
      ["Manufacturer address", str(brand.manufacturer_address)],
      ["Vietnam importer", str(brand.importer_name)],
      ["Importer address", str(brand.importer_address)],
      ["Customer contact", str(brand.customer_contact)],
      /* The warranty NUMBERS are per SKU and the sentence around them is not,
         so they only come together here. */
      ["Warranty", product.warranty_months ? product.warranty_months + " months" : ""],
      ["Defect exchange", product.defect_exchange_days ? product.defect_exchange_days + " days" : ""],
    ];
    var any = false;
    pairs.forEach(function (p) {
      if (p[1]) {
        any = true;
        lines.push(pad(p[0]) + p[1]);
      }
    });
    /* Deliberately does NOT set `any`. The warning below is about the registered
       names and addresses, which are the legally required part; a warranty
       sentence with no company behind it is not a filled-in brand block, and
       counting it suppressed the warning on a block that was still missing
       everything that matters. */
    LANGS.forEach(function (l) {
      var terms = str(brand["warranty_terms_" + l.code]);
      if (!terms) return;
      lines.push("");
      lines.push("   " + l.label);
      lines.push(indent(terms, 6));
    });
    if (!any) {
      lines.push("   NOT YET FILLED IN. The responsible company's registered name and");
      lines.push("   the Vietnam importer's name and address are legally required on the");
      lines.push("   box and must be added before this file can go to a printer.");
      lines.push("   Set them once on the Packaging legal block page in /admin.");
    }
    return lines.join("\n");
  }

  /* Section 6 for one language: the 6A/6B/6C blocks the product type opens, each
     one its measurable attributes then its prose.

     Returns `prose` separately from `text` because the two mean different things
     to the caller. The attribute rows are the same characters in every language
     — "9V", "N52", "10000" — so they must not make a language block look
     translated, for the same reason the model number does not. The prose does.

     Extracted so that languageBlock, buildSubLabel and build's figures-only
     fallback all read the same assembly instead of three copies of it;
     buildSubLabel's copy had already started to differ in how it joined rows. */
  function specSection(lang, pkg, product) {
    var type = str(pkg.packaging_product_type);
    var parts = [];
    var prose = false;
    SPEC_BLOCKS.forEach(function (b) {
      if (b.types.indexOf(type) === -1) return;
      /* Measurable attributes first, then the prose. A designer reading down the
         block gets the figures that go in the spec table before the sentence
         that qualifies them. A value of "0" is printed: it is a number someone
         chose, not an empty box, so the test is against "" rather than
         falsiness. */
      var rows = [];
      (SPEC_ATTRS[b.prefix] || []).forEach(function (a) {
        var v = str(pkg[a.name]);
        if (v === "") return;
        rows.push("      " + a[lang] + ": " + v + (a.unit ? " " + a.unit : ""));
      });
      var body = str(pkg[b.prefix + "_" + lang]);
      if (!rows.length && !body) return;
      /* 6A/6B/6C sit one level under "6. Technical specifications", so the
         sub-heading is indented too — at column 0 it reads as a sibling of 6
         rather than a part of it, which matters when a Combined product stacks
         three of them. */
      var piece = "   " + b.label[lang];
      if (rows.length) piece += "\n" + rows.join("\n");
      if (body) {
        piece += "\n" + indent(body, 6);
        prose = true;
      }
      parts.push(piece);
    });
    /* Only when NO block matched the type at all do we fall back to the site's
       technical content. Falling back per-block would mix a generic spec table
       into a labelled 6A/6B/6C section and make it look reviewed when it is not. */
    if (!parts.length) {
      var fallback = str(product["technical_content_" + lang]);
      if (fallback) {
        parts.push(indent(fallback));
        prose = true;
      }
    }
    return { text: parts.join("\n\n"), prose: prose };
  }

  /* One language block. Returns "" when the language has nothing at all in it,
     so a file for a SKU translated into two languages contains two blocks rather
     than two blocks and two headings over empty space. */
  function languageBlock(lang, pkg, product) {
    var S = SECTIONS[lang];
    var parts = [];
    /* The model and the barcode are the same characters in all four languages,
       so they must not count towards "does this language have anything in it".
       Without that distinction every SKU exports four blocks, three of which
       contain only a part number — which looks like three translations that were
       started and abandoned. */
    var translated = 0;

    function add(heading, body, neutral) {
      var text = str(body);
      if (!text) return;
      parts.push(heading + "\n" + indent(text));
      if (!neutral) translated++;
    }

    var X = EXTRA_SECTIONS[lang];

    add(S.name, pick(pkg["packaging_name_" + lang], product["name_" + lang]));
    add(S.model, pick(pkg.model_number, product.official_sku_code, product.product_id), true);
    add(S.instructions, pkg["instructions_precautions_" + lang]);
    add(X.storage, pkg["storage_instructions_" + lang]);
    add(S.contents, pick(pkg["package_contents_" + lang], product["accessories_" + lang]));
    add(S.material, pkg["main_material_" + lang]);

    var spec = specSection(lang, pkg, product);
    if (spec.text) {
      parts.push(S.specs + "\n" + spec.text);
      /* Only prose counts. A block holding nothing but the shared figures is
         the same four identical copies the model number was made neutral for. */
      if (spec.prose) translated++;
    }

    add(X.lithium, pkg["lithium_warning_" + lang]);
    add(S.barcode, pkg.barcode_ean_upc, true);
    add(X.notes, pkg["packaging_notes_" + lang]);

    if (!translated) return "";
    return (
      "====================\n" +
      LANGS.filter(function (l) {
        return l.code === lang;
      })[0].label +
      "\n====================\n\n" +
      parts.join("\n\n")
    );
  }

  /* pkg     — the Packaging tab's values
     product — the product row, for the fallbacks and the Qi gate
     today   — date string, passed in so this stays a pure function
     brand   — the brand_settings row; {} is a valid argument and produces the
               NOT YET FILLED IN block plus its [FAIL] line */
  function build(pkg, product, today, brand) {
    pkg = pkg || {};
    product = product || {};
    brand = brand || {};
    var blocks = [
      header(pkg, product, today),
      /* English here: the full export is the four-language document and its
         scaffolding has always been English. The Vietnamese sub-label asks for
         Vietnamese instead — see buildSubLabel. */
      "--- PRE-PRINT CHECKS ---\n" + preflight(pkg, product, brand, "en").join("\n"),
    ];
    var anyLanguage = false;
    LANGS.forEach(function (l) {
      var b = languageBlock(l.code, pkg, product);
      if (b) {
        anyLanguage = true;
        blocks.push(b);
      }
    });
    /* Nothing the operator typed may fall out of the file. A record whose specs
       are all figures and whose name is still blank produces no language block
       at all — the figures are neutral by design, so they cannot make one — and
       eight filled boxes used to vanish while the Vietnamese sticker printed
       them. Print them once, unwrapped, when that happens. */
    if (!anyLanguage) {
      var only = specSection("en", pkg, product);
      if (only.text) {
        blocks.push(SECTIONS.en.specs + "\n" + only.text);
      }
    }
    blocks.push(brandBlock(brand, product));
    if (str(pkg.iata_notes)) {
      blocks.push("AIR FREIGHT / IATA NOTES\n" + indent(pkg.iata_notes));
    }
    return blocks.join("\n\n") + "\n";
  }

  /* The Vietnamese supplementary label, on its own.

     The 2026-09-28 meeting settled on a shared English box plus a Vietnamese
     sticker, which makes the sticker a separate artefact with a separate
     content list: only what Decree 37/2026 makes mandatory, only in Vietnamese,
     in the order the back-of-box block was drafted in. Handing the designer the
     full four-language export and asking them to work out which lines are
     legally required is the step this is here to remove. */
  function buildSubLabel(pkg, product, brand) {
    pkg = pkg || {};
    product = product || {};
    brand = brand || {};
    var type = str(pkg.packaging_product_type);
    var electric = PKG.charging.indexOf(type) !== -1;
    var out = [];

    function sec(heading, body) {
      var text = str(body);
      if (!text) return;
      out.push(heading);
      out.push(indent(text));
      out.push("");
    }

    out.push("NHÃN PHỤ TIẾNG VIỆT — " + pick(product.official_sku_code, product.product_id, "(chưa có SKU)"));
    out.push("Theo Nghị định 37/2026/NĐ-CP. Chỉ gồm nội dung bắt buộc.");
    out.push("");

    sec("Tên sản phẩm và model", function () {
      var name = pick(pkg.packaging_name_vi, product.name_vi);
      var model = pick(pkg.model_number, product.official_sku_code, product.product_id);
      return name && model ? name + "\n" + model : name || model;
    }());
    sec("Tổ chức chịu trách nhiệm về hàng hóa", function () {
      var a = str(brand.responsible_company), b = str(brand.responsible_address);
      return a && b ? a + "\n" + b : a || b;
    }());
    sec("Nhà sản xuất", function () {
      var a = str(brand.manufacturer_name), b = str(brand.manufacturer_address);
      return a && b ? a + "\n" + b : a || b;
    }());
    sec("Nhà nhập khẩu", function () {
      var a = str(brand.importer_name), b = str(brand.importer_address);
      return a && b ? a + "\n" + b : a || b;
    }());
    sec("Xuất xứ", pkg.country_of_origin);
    /* Appendix I category 40 only. A bare bracket printing a year of manufacture
       is not wrong, but it is one more line to keep true on a sticker that has
       no room to spare. */
    if (electric) sec("Năm sản xuất", pick(pkg.manufacturing_year, "____"));

    /* The same assembly the full export uses, so the sticker and the main sheet
       cannot disagree about what this product's specs are. `sec` re-indents, so
       the block headings and leading spaces specSection adds for the .txt are
       stripped back out here. */
    sec("Thông số kỹ thuật", specSection("vi", pkg, product).text);

    sec("Hướng dẫn sử dụng", pkg.instructions_precautions_vi);
    sec("Hướng dẫn bảo quản", pkg.storage_instructions_vi);
    sec("Cảnh báo", pkg.lithium_warning_vi);

    var service = [];
    if (str(brand.customer_contact)) service.push(str(brand.customer_contact));
    if (product.warranty_months) service.push("Bảo hành " + product.warranty_months + " tháng");
    if (str(brand.warranty_terms_vi)) service.push(str(brand.warranty_terms_vi));
    sec("Liên hệ và bảo hành", service.join("\n"));

    /* The checks run against the same data, so a sticker generated from an
       incomplete record carries the reason it is incomplete rather than looking
       finished. */
    out.push("--- KIỂM TRA TRƯỚC KHI IN ---");
    out.push(preflight(pkg, product, brand, "vi").join("\n"));
    return out.join("\n") + "\n";
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* Only images served from our own storage are embedded. A hero_image_url is
     staff-entered free text, and an <img src> pointing anywhere a staff account
     chooses is the one thing on this page that would reach off-origin. */
  function safeImg(url) {
    var u = str(url);
    return /^https:\/\/[A-Za-z0-9.-]+\.supabase\.co\//.test(u) ? u : "";
  }

  /* A printable sheet rather than a generated PDF.

     The designer's actual complaint about the .txt is that the main image is a
     URL they have to copy into a browser. A page the browser prints solves that
     with no library at all: the images are <img> tags, Ctrl+P saves a PDF, and
     the repo stays at its one dependency. A PDF or ZIP would mean adding a CDN
     script to a page whose whole output is already in the DOM. */
  function buildPrintHtml(pkg, product, today, brand, draft) {
    pkg = pkg || {};
    product = product || {};
    brand = brand || {};
    var sku = pick(product.official_sku_code, product.product_id, "(no SKU)");
    var html = "";
    html += '<header class="ps-head">';
    html += "<h1>" + escHtml(sku) + " — packaging</h1>";
    html += "<p>" + escHtml(today);
    if (str(pkg.packaging_product_type)) html += " · " + escHtml(pkg.packaging_product_type);
    if (str(pkg.packaging_status)) html += " · " + escHtml(pkg.packaging_status);
    html += "</p>";
    if (draft) html += '<p class="ps-draft">UNSAVED DRAFT — this sheet shows what is on screen, not what is stored.</p>';
    html += "</header>";

    var imgs = [safeImg(product.hero_image_url)]
      .concat([].concat(product.gallery_urls || []).map(safeImg))
      .filter(Boolean);
    if (imgs.length) {
      html += '<section class="ps-images">';
      imgs.forEach(function (u) {
        html += '<figure><img src="' + escHtml(u) + '" alt="' + escHtml(sku) + '" loading="lazy">';
        html += "<figcaption>" + escHtml(u) + "</figcaption></figure>";
      });
      html += "</section>";
    }

    /* The text half is the .txt verbatim inside a <pre>. Two renderers of the
       same content would drift, and the designer who wants to copy a line out
       of the sheet gets exactly the line the .txt has. */
    html += '<pre class="ps-body">' + escHtml(build(pkg, product, today, brand)) + "</pre>";
    return html;
  }

  /* encodeURIComponent rather than a character class: collapsing runs to "-"
     gave "VQ09 WH" and "VQ09/WH" the SAME file name, so two designers' files
     overwrote each other in one Downloads folder, and a Chinese SKU came out as
     "--01-packaging.txt" with the SKU gone entirely. */
  function fileName(product, suffix) {
    var sku = pick(
      (product || {}).official_sku_code,
      (product || {}).product_id,
      "product",
    );
    return encodeURIComponent(sku) + (suffix || "-packaging.txt");
  }

  window.VIEMAG_PACKAGING = {
    build: build,
    /* Exported for the test suite only — nothing in /admin calls it directly.
       It is the piece most worth asserting on: thirteen sentences a human acts
       on, in four languages. */
    preflight: preflight,
    buildSubLabel: buildSubLabel,
    buildPrintHtml: buildPrintHtml,
    fileName: fileName,
    ean13Valid: ean13Valid,
  };
})();
