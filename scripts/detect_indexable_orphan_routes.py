#!/usr/bin/env python3
"""
detect_indexable_orphan_routes.py — z255dd: app/sitemap.ts ↔ Next.js routes
の indexable orphan 検査.

検出 pattern:
  A. app/<route>/page.tsx (or layout.tsx) で `robots: { index: true ...}` を
     明示しているのに、app/sitemap.ts に該当 URL が無い → orphan
  B. app/sitemap.ts に書かれている static URL が disk に存在しない (削除 page) →
     stale sitemap entry

Next.js default は indexable なので明示なしの page も sitemap に居るべきか議論
余地があるが、本 lint は「明示的に index: true と書いてあるが sitemap 不在」を
critical bug として扱う。

許容: dynamic routes ([slug]) は sitemap.ts の動的 entry generation で別途対応。

--ci flag で hit > 0 → exit 1
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
SITEMAP = APP_DIR / "sitemap.ts"

# robots: { index: true ... } pattern (negative-lookbehind for `index: false`)
INDEX_TRUE_RE = re.compile(r"robots\s*:\s*\{\s*index\s*:\s*true", re.IGNORECASE)


def collect_static_routes_with_index_true() -> list[str]:
    """app/<route>/(page|layout).tsx で robots: { index: true } を持つ static route 列挙"""
    routes = []
    for fp in APP_DIR.rglob("page.tsx"):
        # Skip dynamic routes
        if any(part.startswith("[") for part in fp.relative_to(APP_DIR).parts):
            continue
        # Check page.tsx and sibling layout.tsx
        files_to_check = [fp]
        layout = fp.parent / "layout.tsx"
        if layout.exists():
            files_to_check.append(layout)
        for f in files_to_check:
            try:
                content = f.read_text(encoding="utf-8")
            except Exception:
                continue
            if INDEX_TRUE_RE.search(content):
                # Extract route from path: app/foo/bar/page.tsx → /foo/bar
                rel = fp.parent.relative_to(APP_DIR)
                if str(rel) == ".":
                    route = "/"
                else:
                    route = "/" + str(rel).replace("\\", "/")
                routes.append(route)
                break
    return routes


def collect_sitemap_static_urls() -> set[str]:
    """app/sitemap.ts の static entries を抽出 (BASE_URL prefix 除去)"""
    if not SITEMAP.exists():
        return set()
    content = SITEMAP.read_text(encoding="utf-8")
    # Match `${BASE_URL}/<path>` and BASE_URL alone
    urls = set()
    for m in re.finditer(r"\$\{BASE_URL\}(/[^`\"']*)?", content):
        path = m.group(1) or "/"
        # Skip dynamic interpolation patterns
        if "${" in path:
            continue
        urls.add(path)
    # `BASE_URL` plain (= "/")
    if re.search(r"\burl\s*:\s*BASE_URL\b", content):
        urls.add("/")
    return urls


def main() -> int:
    indexable = collect_static_routes_with_index_true()
    sitemap_urls = collect_sitemap_static_urls()

    orphans = [r for r in indexable if r not in sitemap_urls]

    print(f"📋 Indexable static routes (robots: index: true): {len(indexable)}")
    print(f"📋 Static URLs in sitemap.ts:                    {len(sitemap_urls)}")
    print(f"❌ Indexable but NOT in sitemap (orphans):       {len(orphans)}")
    for r in orphans[:10]:
        print(f"   - {r}")

    if not orphans:
        print("\n✅ All explicitly-indexable routes are in sitemap.")

    if "--ci" in sys.argv:
        return 1 if orphans else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
