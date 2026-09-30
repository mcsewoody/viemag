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
   by anyone), same as schema.js. The brand block below therefore holds only what
   is already printed on a retail box and handed to strangers in shops. Nothing
   about suppliers, costs or manufacturing origin may ever be added to it. */
(function () {
  "use strict";

  /* Identical on every SKU, so it does not belong in a column that would be
     retyped fourteen times and disagree with itself by the third.

     TODO: move to a single-row brand_settings table once the Vietnamese entity's
     full registered name is confirmed. It is deliberately not a table yet: the
     name is the one open question that can actually block a print run, and
     building an editor for a value nobody knows is building before knowing what
     is being built. Until then, changing an address here is a code change — which
     is honest about the fact that nobody is allowed to change it casually.

     Every line below must be confirmed by the Vietnamese importer or a
     regulatory adviser against the actual manufacturing contract BEFORE any file
     goes to print (Article 44). */
  var BRAND = {
    responsibleCompany: "", // full registered legal name — Article 42
    responsibleAddress: "",
    importerName: "", // the Vietnam importer — required for imported goods
    importerAddress: "",
    customerContact: "", // phone or e-mail, labelled in Vietnamese
  };

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
      types: ["Magnetic bracket", "Combined product"],
      label: {
        vi: "6A. Giá đỡ nam châm",
        en: "6A. Magnetic bracket",
        id: "6A. Braket magnetik",
        zh: "6A. 磁吸支架",
      },
    },
    {
      prefix: "charging_specs",
      types: ["Charging product", "Combined product"],
      label: {
        vi: "6B. Sản phẩm sạc",
        en: "6B. Charging product",
        id: "6B. Produk pengisi daya",
        zh: "6B. 充電產品",
      },
    },
    {
      prefix: "power_bank_specs",
      types: ["Power bank", "Combined product"],
      label: {
        vi: "6C. Sạc dự phòng",
        en: "6C. Power bank",
        id: "6C. Power bank",
        zh: "6C. 充電寶",
      },
    },
  ];

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
     boxes are printed. */
  function ean13Valid(code) {
    if (!/^\d{13}$/.test(code)) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) {
      sum += Number(code[i]) * (i % 2 ? 3 : 1);
    }
    return (10 - (sum % 10)) % 10 === Number(code[12]);
  }

  /* The checks are advisory on purpose, and they are in the FILE rather than in
     the form. Blocking Save would only produce placeholder barcodes; putting the
     verdict at the top of the document the designer actually opens puts it in
     front of the person who is about to act on it.

     Not a compliance certificate: labelling correctly is not the same as being
     approved for sale. Conformity certification and the CR mark are decided per
     model with the importer, and no generic checklist can stand in for that. */
  function preflight(pkg, product) {
    var out = [];
    var type = str(pkg.packaging_product_type);
    var electric = type === "Charging product" || type === "Power bank" || type === "Combined product";

    if (pick(pkg.packaging_name_vi, product.name_vi)) {
      out.push("[ok]   Vietnamese product name present");
    } else {
      out.push("[FAIL] No Vietnamese product name — required by Article 42, and a brand or model code does not count as one");
    }

    if (!type) {
      out.push("[WARN] No packaging product type chosen — no technical specification block could be selected");
    }

    var ean = str(pkg.barcode_ean_upc);
    if (!ean) {
      out.push("[FAIL] Barcode EAN/UPC is empty — do not send to print before the code has been issued");
    } else if (!ean13Valid(ean)) {
      out.push("[FAIL] Barcode " + ean + " is not a valid EAN-13 (13 digits, last one a check digit)");
    } else {
      out.push("[ok]   Barcode EAN-13 " + ean + " passes its check digit");
    }

    /* The V3 coding manual dropped the certification marker from the SKU itself
       (section 7.2): the code no longer tells anyone whether the Qi logo may be
       printed, and the manual says that gate has to be rebuilt in process. This
       line is that gate. */
    if (str(product.qi_status) === "Certified") {
      var qiId = str(product.qi_id);
      out.push(
        qiId
          ? "[ok]   Qi logo may be printed — certified, WPC ID " + qiId
          : "[FAIL] Qi status is Certified but no Qi ID is recorded — do not print the Qi logo until the ID is filled in",
      );
    } else {
      out.push(
        "[WARN] Qi logo and the word Certified MUST NOT appear on this box (Qi status: " +
          (str(product.qi_status) || "not set") +
          ")",
      );
    }

    if (electric) {
      out.push("[WARN] Year of manufacture is required for electrical goods and changes per batch — fill it in at print time");
    }

    if (!BRAND.responsibleCompany || !BRAND.importerName) {
      out.push("[FAIL] Responsible company and/or Vietnam importer is not yet filled in — see the brand block below");
    }

    out.push("[note] Labelling is not certification. Conformity approval and the CR mark are confirmed per model with the importer; this checklist does not replace that.");
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
      ["Year of manufacture", "____  (per production batch)"],
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

  function brandBlock() {
    var lines = ["BRAND INFORMATION — identical on every SKU"];
    var pairs = [
      ["Responsible company", BRAND.responsibleCompany],
      ["Address", BRAND.responsibleAddress],
      ["Vietnam importer", BRAND.importerName],
      ["Importer address", BRAND.importerAddress],
      ["Customer contact", BRAND.customerContact],
    ];
    var any = false;
    pairs.forEach(function (p) {
      if (p[1]) {
        any = true;
        lines.push(pad(p[0]) + p[1]);
      }
    });
    if (!any) {
      lines.push("   NOT YET FILLED IN. The responsible company's registered name and");
      lines.push("   the Vietnam importer's name and address are legally required on the");
      lines.push("   box and must be added before this file can go to a printer.");
    }
    return lines.join("\n");
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

    add(S.name, pick(pkg["packaging_name_" + lang], product["name_" + lang]));
    add(S.model, pick(pkg.model_number, product.official_sku_code, product.product_id), true);
    add(S.instructions, pkg["instructions_precautions_" + lang]);
    add(S.contents, pick(pkg["package_contents_" + lang], product["accessories_" + lang]));
    add(S.material, pkg["main_material_" + lang]);

    var type = str(pkg.packaging_product_type);
    var specParts = [];
    SPEC_BLOCKS.forEach(function (b) {
      if (b.types.indexOf(type) === -1) return;
      var body = str(pkg[b.prefix + "_" + lang]);
      /* 6A/6B/6C sit one level under "6. Technical specifications", so the
         sub-heading is indented too — at column 0 it reads as a sibling of 6
         rather than a part of it, which matters when a Combined product stacks
         three of them. */
      if (body) specParts.push("   " + b.label[lang] + "\n" + indent(body, 6));
    });
    /* Only when NO block matched the type at all do we fall back to the site's
       technical content. Falling back per-block would mix a generic spec table
       into a labelled 6A/6B/6C section and make it look reviewed when it is not. */
    if (!specParts.length) {
      var fallback = str(product["technical_content_" + lang]);
      if (fallback) specParts.push(indent(fallback));
    }
    if (specParts.length) {
      parts.push(S.specs + "\n" + specParts.join("\n\n"));
      translated++;
    }

    add(S.barcode, pkg.barcode_ean_upc, true);

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
     today   — ISO date string, passed in so this stays a pure function */
  function build(pkg, product, today) {
    pkg = pkg || {};
    product = product || {};
    var blocks = [
      header(pkg, product, today),
      "--- PRE-PRINT CHECKS ---\n" + preflight(pkg, product).join("\n"),
    ];
    LANGS.forEach(function (l) {
      var b = languageBlock(l.code, pkg, product);
      if (b) blocks.push(b);
    });
    blocks.push(brandBlock());
    return blocks.join("\n\n") + "\n";
  }

  function fileName(product) {
    var sku = pick(
      (product || {}).official_sku_code,
      (product || {}).product_id,
      "product",
    );
    return sku.replace(/[^A-Za-z0-9._-]+/g, "-") + "-packaging.txt";
  }

  window.VIEMAG_PACKAGING = {
    build: build,
    fileName: fileName,
    ean13Valid: ean13Valid,
  };
})();
