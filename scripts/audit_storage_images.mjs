#!/usr/bin/env node
/* Read-only audit for VIEMAG public Supabase Storage images.
 *
 * It scans js/data.js for image URLs, checks headers with HEAD, and writes a
 * CSV/JSON report under outputs/. It never writes to Supabase Storage.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "js", "data.js");
const DEFAULT_OUT_DIR = path.join(ROOT, "outputs", "storage-image-audit");
const SUPABASE_STORAGE_RE = /https:\/\/[^"'\s]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\s)]+/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i;

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((x) => x.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function estimateWebpBytes(bytes, ext) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (ext === "webp" || ext === "avif") return bytes;
  if (ext === "png") return Math.round(bytes * 0.3);
  if (ext === "jpg" || ext === "jpeg") return Math.round(bytes * 0.8);
  return bytes;
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function findImageRefs(value, trail = [], refs = []) {
  if (typeof value === "string") {
    if (SUPABASE_STORAGE_RE.test(value) && IMAGE_EXT_RE.test(value)) {
      refs.push({ url: value, field: trail.join(".") });
    }
    return refs;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => findImageRefs(item, trail.concat(String(i)), refs));
    return refs;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      findImageRefs(item, trail.concat(key), refs);
    }
  }
  return refs;
}

async function loadDb() {
  const code = await fs.readFile(DATA_PATH, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: DATA_PATH });
  return sandbox.window.DB;
}

async function head(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const elapsedMs = Date.now() - started;
    return {
      ok: res.ok,
      status: res.status,
      elapsedMs,
      bytes: Number(res.headers.get("content-length")) || null,
      contentType: res.headers.get("content-type") || "",
      cacheControl: res.headers.get("cache-control") || "",
      cfCacheStatus: res.headers.get("cf-cache-status") || "",
      etag: res.headers.get("etag") || "",
    };
  } catch (err) {
    return {
      ok: false,
      status: "ERROR",
      elapsedMs: Date.now() - started,
      bytes: null,
      contentType: "",
      cacheControl: "",
      cfCacheStatus: "",
      etag: "",
      error: err && err.message ? err.message : String(err),
    };
  }
}

function uniqueRefs(refs) {
  const byUrl = new Map();
  for (const ref of refs) {
    const prev = byUrl.get(ref.url);
    if (prev) prev.fields.push(ref.field);
    else byUrl.set(ref.url, { url: ref.url, fields: [ref.field] });
  }
  return [...byUrl.values()];
}

async function main() {
  const outDir = path.resolve(arg("out", DEFAULT_OUT_DIR));
  await fs.mkdir(outDir, { recursive: true });

  const db = await loadDb();
  const refs = uniqueRefs(findImageRefs(db));
  const rows = [];
  for (let i = 0; i < refs.length; i += 1) {
    const ref = refs[i];
    const ext = (new URL(ref.url).pathname.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    const meta = await head(ref.url);
    const estimatedWebpBytes = estimateWebpBytes(meta.bytes, ext);
    rows.push({
      index: i + 1,
      ext,
      fields: ref.fields.join(" | "),
      url: ref.url,
      status: meta.status,
      ok: meta.ok,
      bytes: meta.bytes,
      estimatedWebpBytes,
      estimatedSavingBytes:
        meta.bytes != null && estimatedWebpBytes != null ? Math.max(0, meta.bytes - estimatedWebpBytes) : null,
      contentType: meta.contentType,
      cacheControl: meta.cacheControl,
      cfCacheStatus: meta.cfCacheStatus,
      elapsedMs: meta.elapsedMs,
      etag: meta.etag,
      error: meta.error || "",
    });
    process.stderr.write(`checked ${i + 1}/${refs.length}\r`);
  }
  process.stderr.write("\n");

  const totals = rows.reduce(
    (acc, row) => {
      acc.count += 1;
      acc.bytes += row.bytes || 0;
      acc.estimatedWebpBytes += row.estimatedWebpBytes || 0;
      acc.estimatedSavingBytes += row.estimatedSavingBytes || 0;
      acc.byExt[row.ext] = (acc.byExt[row.ext] || 0) + 1;
      if (!String(row.cacheControl).includes("31536000")) acc.notLongCached += 1;
      return acc;
    },
    { count: 0, bytes: 0, estimatedWebpBytes: 0, estimatedSavingBytes: 0, byExt: {}, notLongCached: 0 },
  );

  const csvHeaders = Object.keys(rows[0] || { index: "" });
  const csv = [
    csvHeaders.join(","),
    ...rows.map((row) => csvHeaders.map((key) => csvCell(row[key])).join(",")),
  ].join("\n");
  await fs.writeFile(path.join(outDir, "storage-image-audit.csv"), csv + "\n", "utf8");
  await fs.writeFile(path.join(outDir, "storage-image-audit.json"), JSON.stringify({ totals, rows }, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        outputDir: outDir,
        count: totals.count,
        totalMB: +(totals.bytes / 1024 / 1024).toFixed(2),
        estimatedWebpMB: +(totals.estimatedWebpBytes / 1024 / 1024).toFixed(2),
        estimatedSavingMB: +(totals.estimatedSavingBytes / 1024 / 1024).toFixed(2),
        byExt: totals.byExt,
        notLongCached: totals.notLongCached,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
