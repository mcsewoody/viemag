#!/usr/bin/env python3
"""Shrink the images already published in Supabase Storage.

WHY: the 123 images referenced by js/data.js weigh 126.5 MB, and Storage answers
`cache-control: no-cache` on all of them, so a visitor re-downloads the lot on
every page view. Forty of them are PNG studio renders at 5000 px wide — one is
13 MB — for slots the site never draws wider than ~1600 px. A sample of four
re-encoded to WebP at 1600 px lost 98.5% of their weight with no visible
difference: 13,195 KB -> 46 KB, 8,568 KB -> 35 KB.

WHAT IT DOES: overwrites each object at its EXISTING path, so every URL in the
database stays valid and nothing else has to change — no row updates, no
re-export, no code. Content-Type becomes image/webp (browsers honour the header,
not the .png in the name) and Cache-Control becomes a year, which is safe
because every path is already stamped with a timestamp and a random suffix.

Originals are downloaded to --backup before anything is written, and the script
refuses to upload if that directory is missing a file it is about to replace.

USAGE:
    export SUPABASE_SERVICE_KEY=...        # Settings -> API -> service_role
    python scripts/compress_storage_images.py                  # dry run
    python scripts/compress_storage_images.py --apply          # writes

The service_role key bypasses Row Level Security. Keep it in the environment for
the length of one run; do not paste it into a file in this repo.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("cần Pillow:  pip install Pillow")

REPO = Path(__file__).resolve().parent.parent
PROJECT = "zqmpjenlpzmeozoufvzy"
BUCKET = "viemag-media"
PUBLIC_PREFIX = f"https://{PROJECT}.supabase.co/storage/v1/object/public/{BUCKET}/"

MAX_WIDTH = 1600   # widest slot the site renders; taller portraits keep their height
QUALITY = 82       # visually lossless for product renders on white
MIN_SAVING = 0.15  # leave a file alone if WebP would not beat it by this much
CACHE_A_YEAR = "31536000"


def image_urls() -> dict[str, list[str]]:
    """Every Storage URL the site references, mapped to where it is used."""
    used: dict[str, list[str]] = {}

    def scan(path: Path, label_of):
        if not path.exists():
            return
        text = path.read_text(encoding="utf-8")
        blob = text[text.index("= ") + 2:]
        for m in re.finditer(re.escape(PUBLIC_PREFIX) + r'[^\s"\\)\]]+', blob):
            used.setdefault(m.group(0), []).append(label_of)

    scan(REPO / "js" / "data.js", "data.js")
    scan(REPO / "js" / "data-articles.js", "bài viết")
    return used


def convert(raw: bytes) -> tuple[bytes | None, str]:
    """Return (webp_bytes, note). None means: not worth replacing."""
    im = Image.open(io.BytesIO(raw))
    w, h = im.size
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    note = f"{w}x{h}"
    if w > MAX_WIDTH:
        im = im.resize((MAX_WIDTH, round(h * MAX_WIDTH / w)), Image.LANCZOS)
        note += f" -> {im.size[0]}x{im.size[1]}"
    out = io.BytesIO()
    im.save(out, "WEBP", quality=QUALITY, method=6)
    if out.tell() > len(raw) * (1 - MIN_SAVING):
        return None, note + " (WebP không nhỏ hơn đáng kể — bỏ qua)"
    return out.getvalue(), note


def upload(path_in_bucket: str, data: bytes, key: str) -> None:
    req = urllib.request.Request(
        f"https://{PROJECT}.supabase.co/storage/v1/object/{BUCKET}/{path_in_bucket}",
        data=data,
        method="PUT",  # PUT = overwrite; POST would fail on an existing object
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "image/webp",
            "Cache-Control": f"max-age={CACHE_A_YEAR}",
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        if r.status not in (200, 201):
            raise RuntimeError(f"upload trả về {r.status}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="thực sự ghi đè lên Storage (mặc định chỉ thử)")
    ap.add_argument("--backup", default=str(REPO.parent / "viemag-image-backup"),
                    help="thư mục lưu ảnh gốc trước khi ghi đè")
    ap.add_argument("--limit", type=int, default=0, help="chỉ xử lý N ảnh đầu (để thử)")
    args = ap.parse_args()

    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if args.apply and not key:
        return print("thiếu SUPABASE_SERVICE_KEY") or 1

    backup = Path(args.backup)
    backup.mkdir(parents=True, exist_ok=True)

    urls = image_urls()
    items = sorted(urls)[: args.limit or None]
    print(f"{len(items)} ảnh | chế độ: {'GHI ĐÈ' if args.apply else 'thử (không ghi)'}")
    print(f"bản gốc lưu tại: {backup}\n")

    before = after = skipped = failed = 0
    for i, url in enumerate(items, 1):
        rel = url[len(PUBLIC_PREFIX):]
        name = rel.rsplit("/", 1)[-1]
        dest = backup / rel.replace("/", "__")

        # Read the backup when one exists. A dry run already pulled every
        # original down; re-downloading them for the real run would spend
        # another 188 MB of Supabase egress to fetch bytes sitting on disk.
        if dest.exists():
            raw = dest.read_bytes()
        else:
            try:
                raw = urllib.request.urlopen(url, timeout=300).read()
            except (urllib.error.URLError, TimeoutError) as e:
                print(f"  [{i:3}/{len(items)}] TẢI LỖI {name[:40]}: {e}")
                failed += 1
                continue
            dest.write_bytes(raw)

        webp, note = convert(raw)
        before += len(raw)
        if webp is None:
            after += len(raw)
            skipped += 1
            print(f"  [{i:3}/{len(items)}] giữ nguyên {name[:38]:40} {note}")
            continue
        after += len(webp)

        verb = "ghi đè" if args.apply else "sẽ giảm"
        print(f"  [{i:3}/{len(items)}] {verb} {name[:38]:40} "
              f"{len(raw)/1024:8.0f}KB -> {len(webp)/1024:7.0f}KB  {note}")
        if args.apply:
            try:
                upload(rel, webp, key)
            except Exception as e:  # noqa: BLE001 — report and keep going
                print(f"        UPLOAD LỖI: {e}")
                failed += 1

    print(f"\ntổng: {before/1024/1024:.1f} MB -> {after/1024/1024:.1f} MB "
          f"(giảm {100*(1-after/max(before,1)):.1f}%)")
    print(f"giữ nguyên {skipped} ảnh, lỗi {failed} ảnh")
    if not args.apply:
        print("\nchưa ghi gì lên Storage. Thêm --apply để thực hiện.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
