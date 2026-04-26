# Makefile — z176d: bjj-app forcing function
#
# 「完璧」と宣言する前に必ず `make verify` を実行する。
# 4 つの lint が全パスすれば commit 可能、1 つでも 🔴 fail なら作業未完了。

.PHONY: verify locale-drift hidden-bugs typecheck test all clean

# Run all anti-regression checks
verify: typecheck locale-drift hidden-bugs
	@echo ""
	@echo "✅ All anti-regression checks passed."
	@echo "   Safe to commit."

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
