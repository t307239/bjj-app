#!/usr/bin/env python3
"""
detect_wiki_url_drift.py — z255ff: bjj-app から wiki への cross-product link
の URL convention 整合性検査.

Wiki (bjj-wiki) は `.html` extension を全 internal/sitemap link で使う:
  - sitemap.xml: <loc>https://wiki.bjj-app.net/en/heel-hook.html</loc>
  - <a href="armbar.html">
  - 4,697 sitemap entries 全て .html

bjj-app から wiki に link する際 (techniques/page.tsx, app/page.tsx, etc.) も
同じ convention に揃えないと:
  - GitHub Pages の clean URL fallback は site config / Jekyll 設定次第
  - 現在 _config.yml 無しの static GH Pages なので保証なし
  - 一部 URL のみ extension 無いと UX 不一致 + risk of 404

検査対象:
  - bjj-app の app/, components/, lib/, hooks/ 配下の .ts/.tsx file
  - https://wiki.bjj-app.net/<lang>/<path> 形式の URL
  - <path> が .html / .xml / / で終わらず、かつ /<lang> 直下のページ参照

許容例外:
  - https://wiki.bjj-app.net/<lang>/ (index page)
  - https://wiki.bjj-app.net (root)

--ci flag で hit > 0 → exit 1
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "lib", "hooks"]
SCAN_EXTS = (".ts", ".tsx")

URL_RE = re.compile(
    r'https://wiki\.bjj-app\.net(/[a-z]+/[a-zA-Z0-9._-]+?)(["\'`])'
)


def main() -> int:
    issues: list[tuple[str, int, str]] = []
    for d in SCAN_DIRS:
        root = REPO_ROOT / d
        if not root.exists():
            continue
        for fp in root.rglob("*"):
            if not fp.is_file():
                continue
            if fp.suffix not in SCAN_EXTS:
                continue
            try:
                content = fp.read_text(encoding="utf-8")
            except Exception:
                continue
            for m in URL_RE.finditer(content):
                path = m.group(1)
                if path.endswith((".html", ".xml", "/")):
                    continue
                line_no = content[: m.start()].count("\n") + 1
                rel = fp.relative_to(REPO_ROOT)
                issues.append((str(rel), line_no, path))

    print(f"❌ Wiki URL missing .html extension: {len(issues)}")
    for fp, ln, path in issues[:10]:
        print(f"   {fp}:L{ln}: {path}")
    if not issues:
        print("\n✅ All wiki URLs use .html extension consistently.")

    if "--ci" in sys.argv:
        return 1 if issues else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
