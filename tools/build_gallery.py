#!/usr/bin/env python3
"""Build the local VIEMAG Supabase image gallery.

The generated page intentionally loads images through
/storage/v1/object/public/. It never uses /storage/v1/render/image/, so opening
the gallery does not consume Supabase image transformation quota.
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "product-assets" / "_圖庫檢視器.html"

HTML = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VIEMAG Image Gallery</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      --border: #d8dee8;
      --text: #172033;
      --muted: #5c667a;
      --bg: #f6f8fb;
      --panel: #ffffff;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
    }

    header {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.96);
      padding: 18px 24px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.2;
    }

    p {
      margin: 6px 0;
      color: var(--muted);
      line-height: 1.5;
    }

    main {
      padding: 22px 24px 40px;
    }

    .toolbar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    input,
    select {
      min-height: 38px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      padding: 0 12px;
      font: inherit;
    }

    input {
      min-width: min(420px, 100%);
      flex: 1 1 280px;
    }

    .status {
      margin-bottom: 18px;
      font-weight: 700;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 14px;
    }

    .item {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
    }

    .thumb {
      display: block;
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: contain;
      background: #eef2f7;
    }

    .meta {
      padding: 10px;
      border-top: 1px solid var(--border);
    }

    .path {
      overflow-wrap: anywhere;
      font-size: 12px;
      line-height: 1.35;
      color: var(--muted);
    }

    .folder {
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
    }

    code {
      color: var(--text);
    }

    a {
      color: #0d5bd7;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <header>
    <h1>VIEMAG Image Gallery</h1>
    <p>All images load from <code>/storage/v1/object/public/</code>. This page never touches <code>/storage/v1/render/image/</code>, so it consumes zero Supabase image-transformation quota.</p>
    <p>Use this instead of the Storage explorer in the Supabase Dashboard. Rebuild with <code>python3 tools/build_gallery.py</code>.</p>
    <div class="toolbar">
      <input id="search" type="search" placeholder="Filter by product, folder, or filename">
      <select id="folder">
        <option value="">All folders</option>
      </select>
    </div>
  </header>
  <main>
    <div id="status" class="status">Loading images from viemag.biz...</div>
    <div id="grid" class="grid"></div>
  </main>

  <script>
    (function () {
      var OBJECT = "/storage/v1/object/public/";
      var RENDER = "/storage/v1/render/image/";
      var images = [];
      var grid = document.getElementById("grid");
      var status = document.getElementById("status");
      var search = document.getElementById("search");
      var folder = document.getElementById("folder");

      function folderName(url) {
        var rest = url.split(OBJECT)[1] || "";
        var parts = rest.split("/");
        return parts.slice(0, Math.max(1, parts.length - 1)).join("/");
      }

      function fileName(url) {
        return decodeURIComponent((url.split("/").pop() || "").replace(/\+/g, " "));
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (ch) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          }[ch];
        });
      }

      function render() {
        var q = search.value.trim().toLowerCase();
        var f = folder.value;
        var visible = images.filter(function (item) {
          return (!f || item.folder === f) &&
            (!q || item.url.toLowerCase().indexOf(q) >= 0);
        });

        status.textContent = visible.length + " of " + images.length +
          " images in " + new Set(images.map(function (item) { return item.folder; })).size +
          " folders - list read live from viemag.biz - " + new Date().toLocaleString();

        grid.innerHTML = visible.map(function (item) {
          return '<article class="item">' +
            '<a href="' + item.url + '" target="_blank" rel="noopener">' +
              '<img class="thumb" src="' + item.url + '" loading="lazy" alt="">' +
            '</a>' +
            '<div class="meta">' +
              '<div class="folder">' + escapeHtml(item.folder) + '</div>' +
              '<div class="path">' + escapeHtml(fileName(item.url)) + '</div>' +
            '</div>' +
          '</article>';
        }).join("");
      }

      function collectUrls(node, found) {
        if (!node) return;
        if (typeof node === "string") {
          var matches = node.match(/https:\/\/zqmpjenlpzmeozoufvzy\.supabase\.co\/storage\/v1\/object\/public\/[^"'\s)<>]+?\.(?:png|jpe?g|webp|gif)/gi);
          if (matches) matches.forEach(function (url) { found.push(url); });
          return;
        }
        if (typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(function (item) { collectUrls(item, found); });
          return;
        }
        Object.keys(node).forEach(function (key) {
          collectUrls(node[key], found);
        });
      }

      function setImages(db) {
        var found = [];
        collectUrls(db, found);
        var seen = new Set();
        images = found
          .filter(function (url) {
            if (url.indexOf(RENDER) >= 0 || url.indexOf(OBJECT) < 0 || seen.has(url)) return false;
            seen.add(url);
            return true;
          })
          .map(function (url) {
            return { url: url, folder: folderName(url) };
          })
          .sort(function (a, b) {
            return a.folder.localeCompare(b.folder) || a.url.localeCompare(b.url);
          });

        Array.from(new Set(images.map(function (item) { return item.folder; }))).forEach(function (name) {
          var option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          folder.appendChild(option);
        });

        render();
      }

      window.addEventListener("error", function (event) {
        if (event.target && event.target.id === "data-script") {
          status.textContent = "Could not load https://viemag.biz/js/data.js";
        }
      }, true);

      var script = document.createElement("script");
      script.id = "data-script";
      script.src = "https://viemag.biz/js/data.js?v=" + Date.now();
      script.onload = function () {
        if (!window.DB) {
          status.textContent = "Loaded data.js, but window.DB was not found.";
          return;
        }
        setImages(window.DB);
      };
      document.head.appendChild(script);

      search.addEventListener("input", render);
      folder.addEventListener("change", render);
    })();
  </script>
</body>
</html>
'''


def main() -> None:
    dangerous = (
        'src="https://zqmpjenlpzmeozoufvzy.supabase.co/storage/v1/render/image/',
        'href="https://zqmpjenlpzmeozoufvzy.supabase.co/storage/v1/render/image/',
    )
    if any(s in HTML for s in dangerous):
        raise SystemExit("refusing to write gallery: render/image URL found")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(HTML, encoding="utf-8", newline="\n")
    print("Wrote product-assets gallery HTML.")
    print("Open it locally in a browser. It uses object/public image URLs only.")


if __name__ == "__main__":
    main()
