#!/usr/bin/env python3
"""
detect_dead_components.py — z255o: components/ で未使用な component を検出

【経緯】
z255o UI 巡回で `components/StreakProtect.tsx` (62 行) と
`components/ui/ClickableDiv.tsx` (55 行) が dead code と判明。
StreakProtect は dashboard loading skeleton で コメント言及のみ。
ClickableDiv は自己 JSDoc 内の usage 例のみ。

これらは Next.js の tree-shaking で bundle には入らないが、
- code base の見通し悪化 (refactoring で残した残骸)
- ESLint / TypeScript で参照されない export を catch しない
- 新規開発者が「使われてる」と誤解する

を防ぐため、CI で dead component を 🟡 で報告する lint を導入。

【lint logic】
1. components/**/*.tsx の `export default` を抽出
2. app/ + components/ + lib/ + hooks/ で `from "@/components/X"` または
   dynamic `import("@/components/X")` を抽出
3. import されてない export を 🟡 で報告
4. KNOWN_DEAD: 既知の dead component (削除候補、削除すれば 🟢)

【CI】
warning level (🟡) — 即 fail はしないが PR で可視化。
KNOWN_DEAD list が増えた / 減った時に audit して掃除する forcing function。

Usage:
  python3 scripts/detect_dead_components.py [--ci]
"""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# z255o: 既知の dead component (削除候補だが sandbox 制限で残置)
# レビュー後に削除予定 (BACKLOG TODO 候補)
KNOWN_DEAD = {
    "components/StreakProtect.tsx",  # 62 行、dashboard loading skeleton で comment のみ
    "components/ui/ClickableDiv.tsx",  # 55 行、JSDoc 内 usage 例のみ
}


def find_exports() -> dict[str, str]:
    """components/**/*.tsx の default export 名を抽出"""
    exports: dict[str, str] = {}
    for fp in (REPO / "components").rglob("*.tsx"):
        if any(s in fp.parts for s in ("__tests__",)):
            continue
        try:
            content = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        m = re.search(r"export default (?:function|class)\s+(\w+)", content) or re.search(
            r"export default (\w+)", content
        )
        if m:
            exports[str(fp.relative_to(REPO))] = m.group(1)
    return exports


def find_import_paths() -> set[str]:
    """全 .ts/.tsx で import path を collect"""
    paths: set[str] = set()
    roots = [REPO / "app", REPO / "components", REPO / "lib", REPO / "hooks"]
    for root in roots:
        if not root.exists():
            continue
        for fp in list(root.rglob("*.tsx")) + list(root.rglob("*.ts")):
            if any(s in fp.parts for s in ("__tests__",)):
                continue
            try:
                content = fp.read_text(encoding="utf-8")
            except Exception:
                continue
            # standard import
            for m in re.finditer(
                r'from\s+["\'](@/components/[^"\']+|\.{1,2}/[^"\']+)["\']', content
            ):
                paths.add(m.group(1))
            # dynamic import
            for m in re.finditer(
                r'import\(["\'](@/components/[^"\']+|\.{1,2}/[^"\']+)["\']\)', content
            ):
                paths.add(m.group(1))
    return paths


def is_imported(component_path: str, import_paths: set[str]) -> bool:
    """component_path が import_paths のどれかにマッチするか"""
    rel = (
        Path(component_path).as_posix().replace("components/", "").replace(".tsx", "")
    )
    candidates = {
        f"@/components/{rel}",
        f"./{rel}",
        f"../components/{rel}",
        f"../../components/{rel}",
    }
    if any(ip in candidates for ip in import_paths):
        return True
    # path suffix match (relative path から)
    for ip in import_paths:
        if ip.endswith("/" + rel):
            return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()

    exports = find_exports()
    import_paths = find_import_paths()

    dead: list[tuple[str, str]] = []
    for fp_rel, exp_name in exports.items():
        if not is_imported(fp_rel, import_paths):
            dead.append((fp_rel, exp_name))

    print("=" * 70)
    print("🛡️  Dead component lint (z255o)")
    print("=" * 70)
    print()

    new_dead = [(fp, n) for fp, n in dead if fp not in KNOWN_DEAD]
    known_still_dead = [(fp, n) for fp, n in dead if fp in KNOWN_DEAD]

    if not new_dead and len(known_still_dead) == len(KNOWN_DEAD):
        print(f"✅ Clean — 新たな dead component なし (KNOWN_DEAD: {len(KNOWN_DEAD)} 件)")
        if KNOWN_DEAD:
            print("\nKNOWN_DEAD (削除候補):")
            for fp in sorted(KNOWN_DEAD):
                print(f"  • {fp}")
        return 0

    if new_dead:
        print(f"🟡 New dead components: {len(new_dead)}")
        for fp, name in new_dead:
            print(f"  🟡 {fp} (default export: {name})")
        print()
        print("Action: 削除する or KNOWN_DEAD に追加して理由を文書化")

    # KNOWN_DEAD で削除済み = 想定外に消えた = WHITELIST 更新が必要
    cleaned_known = [fp for fp in KNOWN_DEAD if fp not in {d[0] for d in known_still_dead}]
    if cleaned_known:
        print(f"\n🟢 KNOWN_DEAD entry が削除済み — KNOWN_DEAD set からも削除推奨:")
        for fp in cleaned_known:
            print(f"  🟢 {fp}")

    # warning level: --ci でも fail させない (1 を return するが exit 1 にしない)
    return 0


if __name__ == "__main__":
    sys.exit(main())
