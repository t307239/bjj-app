#!/usr/bin/env python3
"""
detect_schema_code_mismatch.py — z255h: schema-code 不整合の永続防止 lint

【経緯】
z255g で /wiki/[lang]/[slug] が全 4,665 page で 404 だった重大 bug を発見。
原因: app/wiki/[lang]/[slug]/page.tsx の supabase select に 'created_at' が
含まれていたが、wiki_translations テーブルには created_at 列が存在しない。

z255h で全 .from().select() を AST 的に scan、information_schema.columns と
cross-check し 5 件の不整合を発見・修正。
  - records/[id] training_logs.{instructor,partner} → silent "Not found"
  - gym/upgrade profiles.avatar_url → silent fallback
  - admin/users profiles.created_at → null 値で sort 壊れる
  - wiki/[slug] wiki_translations.created_at → 全 article 404

これらは全て supabase が不存在列を select するとerror を返し、.single()
が null data → notFound() / fallback UI で silent に発生する class の bug。

【本 lint】
- 全 .from(table).select("col1, col2") を抽出
- pg-meta or 静的 SCHEMA_SNAPSHOT と diff
- 不整合あれば 🔴 fail で CI block

Usage:
  python3 scripts/detect_schema_code_mismatch.py [--ci]
"""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# z255h: snapshot of public schema columns (information_schema.columns 由来)
# 更新方法: Supabase SQL で
#   SELECT table_name, array_agg(column_name ORDER BY ordinal_position)
#   FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name;
SCHEMA_SNAPSHOT: dict[str, set[str]] = {
    "belt_history": {"id", "user_id", "belt", "promoted_at", "notes", "created_at"},
    "competition_goals": {"id", "user_id", "name", "date", "notes", "created_at"},
    "email_send_log": {"id", "user_id", "email_type", "sent_at", "email_to", "metadata"},
    "gyms": {"id", "owner_id", "name", "invite_code", "is_active", "created_at",
             "curriculum_url", "curriculum_set_at", "outreach_sent_at"},
    "profiles": {
        "id", "display_name", "belt", "stripe", "gym", "updated_at", "weekly_goal",
        "monthly_goal", "bio", "start_date", "streak_freeze_count", "streak_freeze_last_used",
        "technique_goal", "is_pro", "stripe_customer_id", "gym_name", "training_disclaimer_agreed",
        "training_disclaimer_agreed_at", "gym_id", "is_gym_owner", "share_data_with_gym",
        "locale", "signup_source", "gym_kick_notified", "curriculum_completed_at",
        "body_status", "referral_code", "ai_coach_cache", "ai_coach_last_generated",
        "subscription_status", "target_weight", "target_weight_date", "timezone",
        "deleted_at", "body_status_dates", "body_notes", "email_marketing_opted_out",
        "paid_ref", "paid_at", "paid_plan",
        # z255ooo Auto Trial: no-CC 7-day complimentary Pro trial
        "complimentary_trial_until",
    },
    "push_subscriptions": {"id", "user_id", "endpoint", "p256dh", "auth_key", "created_at",
                          "timezone", "notification_preferences"},
    "technique_edges": {"id", "user_id", "source_id", "target_id", "label", "created_at", "notes"},
    "technique_nodes": {"id", "user_id", "name", "description", "pos_x", "pos_y", "created_at",
                       "mastery_level", "tags"},
    "techniques": {"id", "user_id", "name", "category", "position", "notes", "mastery_level",
                  "created_at", "is_pinned"},
    "training_logs": {"id", "user_id", "date", "duration_min", "type", "notes", "created_at",
                     "partner_username", "instructor_name", "weight"},
    "weight_logs": {"id", "user_id", "weight", "measured_at", "note", "created_at"},
    "wiki_pages": {"id", "slug", "created_at", "video_url"},
    "wiki_translations": {"id", "page_id", "language_code", "title", "description",
                         "content_html", "content_type", "updated_at", "quality_score",
                         "quality_flags"},
}

# 不整合検出時の suggested fix (table → 旧列名 → 新列名)
COLUMN_RENAMES: dict[tuple[str, str], str] = {
    ("training_logs", "instructor"): "instructor_name",
    ("training_logs", "partner"): "partner_username",
}


def scan() -> list[dict]:
    findings: list[dict] = []
    pattern = re.compile(
        r'\.from\([\"\'](\w+)[\"\']\)[^.]*?\.select\(\s*[`"\']([^`"\']+)[`"\']',
        re.DOTALL,
    )

    for fp in list(REPO.rglob("*.ts")) + list(REPO.rglob("*.tsx")):
        if any(s in fp.parts for s in ("node_modules", ".next", "__tests__")):
            continue
        try:
            content = fp.read_text(encoding="utf-8")
        except Exception:
            continue

        for m in pattern.finditer(content):
            table = m.group(1)
            cols_raw = m.group(2)
            if table not in SCHEMA_SNAPSHOT:
                continue  # tracked tables only

            # Strip JOIN syntax like `wiki_pages!inner(slug)` or `profiles!inner` first
            # since those are relationship joins, not columns of `table`.
            cols_clean = re.sub(r"\b\w+!\w+(\([^)]*\))?", "", cols_raw)
            # Also strip plain `tableName(col1, col2)` JOIN syntax
            cols_clean = re.sub(r"\b\w+\([^)]*\)", "", cols_clean)

            for col in re.split(r"[,\s]+", cols_clean):
                col = col.strip()
                if not col or col == "*" or col.startswith(("-", "\\n")):
                    continue
                # if col is the name of another tracked table, it's likely a join target
                if col in SCHEMA_SNAPSHOT and col != table:
                    continue
                if col not in SCHEMA_SNAPSHOT[table]:
                    line_no = content[: m.start()].count("\n") + 1
                    suggestion = COLUMN_RENAMES.get((table, col))
                    findings.append({
                        "file": str(fp.relative_to(REPO)),
                        "line": line_no,
                        "table": table,
                        "missing_column": col,
                        "suggestion": suggestion,
                    })
    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true", help="CI mode: exit 1 if 🔴 > 0")
    args = ap.parse_args()

    findings = scan()

    print("=" * 70)
    print("🛡️  Schema-Code mismatch lint (z255h)")
    print("=" * 70)
    print()

    if not findings:
        print("✅ Clean — 全 .from(table).select() の column が DB schema に存在")
        print()
        print("Snapshot updated: 2026-05-05 (z255h)")
        return 0

    print(f"🔴 Found {len(findings)} schema-code mismatch:")
    print()
    for f in findings:
        print(f"  🔴 {f['file']}:{f['line']}  {f['table']}.{f['missing_column']}")
        if f["suggestion"]:
            print(f"      → suggestion: rename to '{f['suggestion']}'")
    print()
    print("これらは supabase が不存在列で error を返すため silent な data fetch fail を起こす。")
    print("(.single() → null data → notFound() / fallback UI / 'Not found' 表示)。")
    print()
    print("Fix:")
    print("  1. Code 側で正しい列名に変更 (推奨)")
    print("  2. または DB に migration で列追加")
    print()
    print("Snapshot 更新: 新しい列を schema に追加した場合は SCHEMA_SNAPSHOT を更新。")

    return 1 if args.ci else 0


if __name__ == "__main__":
    sys.exit(main())
