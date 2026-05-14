#!/usr/bin/env python3
"""z261p: detect API routes that perform sensitive operations without auth check.

Heuristic:
  An API route is "auth-required" unless it carries an explicit opt-out marker:
    // auth: public          — intentionally public (e.g. health check, OG image)
    // auth: webhook         — webhook signed by 3rd party (Stripe, etc.)
    // auth: cron            — cron with CRON_SECRET header check

  For non-opt-out routes, we require at least one of:
    - supabase.auth.getUser()
    - getServerUserOrJson(...)   (project helper)
    - getServerSession(...)
    - requireAuth(...)
    - createSupabaseServerClient with .auth.getUser() in the file

Findings: WARNING (potential bypass), with route path + missing check.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_DIR = ROOT / "app" / "api"

OPT_OUT_RE = re.compile(
    r"//\s*auth:\s*(public|webhook|cron|optional)\b", re.IGNORECASE
)

AUTH_CHECK_PATTERNS = (
    "auth.getUser(",
    "getServerUserOrJson(",
    "getServerSession(",
    "requireAuth(",
    "checkUserAuth(",
    "CRON_SECRET",
    "STRIPE_WEBHOOK_SECRET",
    "verifyWebhookSignature",
    "verifySignature",
    "verifyCronAuth",
    "verifyUnsubscribeToken",
    "stripe.webhooks.constructEvent",
    "stripe-signature",
)


def has_method_handler(content: str) -> bool:
    """Does file export at least one HTTP method handler?"""
    return bool(
        re.search(
            r"^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b",
            content,
            re.MULTILINE,
        )
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()

    findings: list[tuple[str, str]] = []
    for fp in sorted(API_DIR.rglob("route.ts")):
        try:
            content = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        if not has_method_handler(content):
            continue
        if OPT_OUT_RE.search(content):
            continue
        if any(pat in content for pat in AUTH_CHECK_PATTERNS):
            continue
        rel = fp.relative_to(ROOT)
        findings.append((str(rel), "no auth check + no opt-out marker"))

    for path, msg in findings:
        print(f"  [WARN] {path}  — {msg}")
    print(f"\n❌ API routes missing auth check: {len(findings)}")
    if args.ci and findings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
