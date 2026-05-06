#!/usr/bin/env python3
"""
detect_internal_link_drift.py — z255gg: bjj-app 内部 link 整合性検査.

検出 class:
  A. href="/foo" / Link href="/foo" の `/foo` が app/ に対応する route を
     持たない (route renaming 後の dead link / typo)
  B. href="/route#frag" の `#frag` が target route の page.tsx に
     `id="frag"` を持たない (anchor 不在で scroll 失敗)

許容除外:
  - /api/, /_next/, /auth/, /.well-known
  - public/ 配下の static asset (.svg, .ico, .png, .json, ...)
  - 動的 route pattern (`[slug]`, `[...catchall]`) は regex match
  - href="#..." (page-internal anchor) は対象外 (z255z で wiki 側 catch、
    bjj-app は client component の動的 anchor が多く DOM scan 必須で別扱い)
  - 外部 URL (http://, https://, mailto:, tel:, etc.)
  - 空 href / `#` のみ

--ci flag で hit > 0 → exit 1
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
PUBLIC_DIR = REPO_ROOT / "public"
SCAN_DIRS = ["app", "components", "lib", "hooks"]
SCAN_EXTS = (".ts", ".tsx")

ALLOWED_PREFIXES = ("/api/", "/_next/", "/auth/", "/.well-known", "/manifest.json")


def collect_routes() -> tuple[set[str], list[str]]:
    """Return (static_routes, dynamic_route_regex_patterns)"""
    static = set()
    dynamic = []
    for fp in APP_DIR.rglob("page.tsx"):
        rel = fp.parent.relative_to(APP_DIR)
        parts = str(rel).split("/") if str(rel) != "." else []
        if any(p.startswith("[") for p in parts):
            regex = []
            for p in parts:
                if p.startswith("[..."):
                    regex.append(r".+")
                elif p.startswith("["):
                    regex.append(r"[^/]+")
                else:
                    regex.append(re.escape(p))
            dynamic.append("^/" + "/".join(regex) + "/?$")
        else:
            static.add("/" if str(rel) == "." else "/" + str(rel).replace("\\", "/"))
    return static, dynamic


def collect_public_files() -> set[str]:
    files = set()
    if not PUBLIC_DIR.exists():
        return files
    for fp in PUBLIC_DIR.rglob("*"):
        if not fp.is_file():
            continue
        rel = fp.relative_to(PUBLIC_DIR)
        files.add("/" + str(rel).replace("\\", "/"))
    return files


def is_valid(path: str, static: set[str], dyn: list[str], public: set[str]) -> bool:
    p = path.split("?")[0].split("#")[0]
    if not p:
        return True
    if any(p.startswith(pref) for pref in ALLOWED_PREFIXES):
        return True
    if p in public:
        return True
    p_norm = p.rstrip("/") or "/"
    if p_norm in static:
        return True
    for pat in dyn:
        if re.match(pat, p_norm):
            return True
    return False


def collect_ids_for_route(route: str) -> set[str]:
    """Find page.tsx (and direct children .tsx files) for the route, scan id="..." attributes."""
    if route == "/":
        target = APP_DIR / "page.tsx"
    else:
        target = APP_DIR / route.lstrip("/") / "page.tsx"
    if not target.exists():
        return set()
    try:
        content = target.read_text(encoding="utf-8")
    except Exception:
        return set()
    return set(re.findall(r'\bid\s*=\s*["\']([^"\'{}]+)["\']', content))


def main() -> int:
    static, dyn = collect_routes()
    public = collect_public_files()

    bad_routes: list[tuple[str, int, str]] = []
    bad_anchors: list[tuple[str, int, str, str]] = []

    href_re = re.compile(
        r'href\s*=\s*["\'](\/[^"\'{}]*)["\']',
    )

    for d in SCAN_DIRS:
        root = REPO_ROOT / d
        if not root.exists():
            continue
        for fp in root.rglob("*"):
            if not fp.is_file() or fp.suffix not in SCAN_EXTS:
                continue
            try:
                content = fp.read_text(encoding="utf-8")
            except Exception:
                continue
            content_clean = re.sub(r"//[^\n]*", "", content)
            for m in href_re.finditer(content_clean):
                href = m.group(1)
                if href.startswith("//"):
                    continue
                line_no = content[: m.start()].count("\n") + 1
                rel = fp.relative_to(REPO_ROOT)

                # Class A: route validity
                if not is_valid(href, static, dyn, public):
                    bad_routes.append((str(rel), line_no, href))
                    continue

                # Class B: fragment anchor validity (only for routes, not public files)
                if "#" in href:
                    base, frag = href.split("#", 1)
                    if not frag or frag in ("top", "main"):
                        continue
                    base_clean = base.rstrip("/") or "/"
                    if base_clean in static:
                        ids = collect_ids_for_route(base_clean)
                        if frag not in ids:
                            bad_anchors.append((str(rel), line_no, href, base_clean))

    print(f"❌ A. href to non-existent route:        {len(bad_routes)}")
    for f, ln, h in bad_routes[:8]:
        print(f"   {f}:L{ln}: {h}")
    print(f"❌ B. href#fragment with no matching id: {len(bad_anchors)}")
    for f, ln, h, _ in bad_anchors[:8]:
        print(f"   {f}:L{ln}: {h}")

    total = len(bad_routes) + len(bad_anchors)
    if total == 0:
        print("\n✅ All internal hrefs resolve to valid routes/anchors.")

    if "--ci" in sys.argv:
        return 1 if total > 0 else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
