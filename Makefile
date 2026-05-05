# Makefile — z176d (extended z255n): bjj-app forcing function
#
# 「完璧」と宣言する前に必ず `make verify` を実行する。
# 6 つの lint が全パスすれば commit 可能、1 つでも 🔴 fail なら作業未完了。

.PHONY: verify locale-drift hidden-bugs schema-mismatch i18n-keys typecheck test all clean indexable-orphans missing-canonical wiki-url

# Run all anti-regression checks
verify: typecheck locale-drift hidden-bugs schema-mismatch i18n-keys dead-components indexable-orphans missing-canonical wiki-url
	@echo ""
	@echo "✅ All anti-regression checks passed."
	@echo "   Safe to commit."

# z255h: schema-code mismatch (supabase 不存在列を select で silent fail)
schema-mismatch:
	@echo "→ detect_schema_code_mismatch.py..."
	@python3 scripts/detect_schema_code_mismatch.py --ci

# z255m/n: i18n key reference + 翻訳品質 + 3 locale parity
i18n-keys:
	@echo "→ detect_i18n_missing_keys.py..."
	@python3 scripts/detect_i18n_missing_keys.py --ci

# z255o: dead component detection (warning level, 削除候補 catch)
dead-components:
	@echo "→ detect_dead_components.py..."
	@python3 scripts/detect_dead_components.py --ci

# z255dd: robots: { index: true } の static route が sitemap に含まれているか
indexable-orphans:
	@echo "→ detect_indexable_orphan_routes.py..."
	@python3 scripts/detect_indexable_orphan_routes.py --ci

# z255ee: public indexable static page に canonical metadata があるか
missing-canonical:
	@echo "→ detect_missing_canonical.py..."
	@python3 scripts/detect_missing_canonical.py --ci

# z255ff: bjj-app → wiki cross-product URL に .html extension があるか
wiki-url:
	@echo "→ detect_wiki_url_drift.py..."
	@python3 scripts/detect_wiki_url_drift.py --ci

typecheck:
	@echo "→ TypeScript type check..."
	@./node_modules/.bin/tsc --noEmit

# z157+z167+z168+z169+z170+z174+z176d: 11 patterns
locale-drift:
	@echo "→ detect_locale_drift.py..."
	@python3 scripts/detect_locale_drift.py --ci

# Critical bug class detection
hidden-bugs:
	@echo "→ detect_hidden_bugs.py..."
	@python3 scripts/detect_hidden_bugs.py 2>&1 | grep -E "🔴 CRITICAL: 0" || (echo "❌ CRITICAL bugs found" && exit 1)

# Run vitest unit tests
test:
	@echo "→ vitest..."
	@./node_modules/.bin/vitest run __tests__/cronAuth.test.ts __tests__/safeNextPath.test.ts __tests__/bjjDuration.test.ts

all: verify test
	@echo "All checks complete (incl. tests)."

clean:
	@find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
