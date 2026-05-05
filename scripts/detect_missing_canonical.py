#!/usr/bin/env python3
"""
detect_missing_canonical.py — z255ee: public indexable static page で
canonical metadata 欠落検査.

Public 静的 page (auth-required や noindex を除く) で `alternates: { canonical }`
metadata が無いと、Google が tracking parameter 付き URL を canonical 採用する
可能性があり、ranking signal の dilution と duplicate content 判定の risk。

検査対象:
  - app/<route>/(page|layout).tsx の static routes ([slug] 除外)
  - 以下の path prefix は auth-required と判定して除外:
    /admin, /dashboard, /profile, /records, /settings, /techniques,
    /gym/dashboard, /gym/upgrade, /account-deleted, /unsubscribe
  - robots: { index: false } を明示している page は除外
  - 残り = public indexable で canonical 必須

--ci flag で hit > 0 → exit 1
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"

AUTH_REQUIRED_PREFIXES = (
    "/admin",
    "/dashboard",
    "/profile",
    "/records",
    "/settings",
    "/techniques",
    "/gym/dashboard",
    "/gym/upgrade",
    "/account-deleted",
    "/unsubscribe",
    "/invite",  # public-tokenized but each is unique → no canonical needed
)


def main() -> int:
    missing: list[str] = []

    for fp in APP_DIR.rglob("page.tsx"):
        if any(p.startswith("[") for p in fp.relative_to(APP_DIR).parts):
            continue  # skip dynamic routes

        rel = fp.parent.relative_to(APP_DIR)
        route = "/" if str(rel) == "." else "/" + str(rel).replace("\\", "/")

        if any(route.startswith(p) for p in AUTH_REQUIRED_PREFIXES):
            continue

        # Inspect page.tsx + sibling layout.tsx
        files = [fp]
        layout = fp.parent / "layout.tsx"
        if layout.exists():
            files.append(layout)

        has_canonical = False
        is_noindex = False
        for f in files:
            try:
                c = f.read_text(encoding="utf-8")
            except Exception:
                continue
            if re.search(r"canonical\s*:", c):
                has_canonical = True
            if re.search(r"robots\s*:\s*\{[^}]*index\s*:\s*false", c):
                is_noindex = True

        if is_noindex:
            continue
        if not has_canonical:
            missing.append(route)

    print(f"❌ Public indexable static routes without canonical: {len(missing)}")
    for r in missing[:10]:
        print(f"   - {r}")
    if not missing:
        print("\n✅ All public indexable routes have canonical metadata.")

    if "--ci" in sys.argv:
        return 1 if missing else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
