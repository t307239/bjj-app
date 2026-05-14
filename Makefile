# Makefile — z176d (extended z255n): bjj-app forcing function
#
# 「完璧」と宣言する前に必ず `make verify` を実行する。
# 6 つの lint が全パスすれば commit 可能、1 つでも 🔴 fail なら作業未完了。

.PHONY: verify locale-drift hidden-bugs schema-mismatch i18n-keys typecheck test all clean indexable-orphans missing-canonical wiki-url internal-links unsafe-settimeout localstorage-hazards optimistic-rollback unmount-race router-push-session-end unsafe-localstorage-setitem zindex-hardcode a11y-input-label

# Run all anti-regression checks
verify: typecheck locale-drift hidden-bugs schema-mismatch i18n-keys dead-components indexable-orphans missing-canonical wiki-url internal-links unsafe-settimeout localstorage-hazards optimistic-rollback unmount-race router-push-session-end unsafe-localstorage-setitem zindex-hardcode a11y-input-label
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

# z255gg: 内部 href の route/anchor 整合性 (renaming 後の dead link / typo / 未存在 #frag)
internal-links:
	@echo "→ detect_internal_link_drift.py..."
	@python3 scripts/detect_internal_link_drift.py --ci

# z257: bare setTimeout(setState) なし — capture id + clearTimeout in cleanup
unsafe-settimeout:
	@echo "→ detect_unsafe_settimeout.py..."
	@python3 scripts/detect_unsafe_settimeout.py --ci

# z257: JSON.parse(localStorage.getItem(...)) は try/catch 必須 (corrupted value crash 防止)
localstorage-hazards:
	@echo "→ detect_localstorage_hazards.py..."
	@python3 scripts/detect_localstorage_hazards.py --ci

# z258: optimistic UI update without rollback (= silent data divergence)
optimistic-rollback:
	@echo "→ detect_optimistic_no_rollback.py..."
	@python3 scripts/detect_optimistic_no_rollback.py --ci

# z260y: `await Promise.all` + setState without mounted guard (unmount race)
unmount-race:
	@echo "→ detect_unmount_setstate_race.py..."
	@python3 scripts/detect_unmount_setstate_race.py --ci

# z260y: error.tsx / signOut() / session_expired 後の router.push (history pollution + back trap)
router-push-session-end:
	@echo "→ detect_router_push_session_end.py..."
	@python3 scripts/detect_router_push_session_end.py --ci

# z261b: bare localStorage.setItem (quota / SSR / private mode silent fail)
unsafe-localstorage-setitem:
	@echo "→ detect_unsafe_localstorage_setitem.py..."
	@python3 scripts/detect_unsafe_localstorage_setitem.py --ci

# z261c: z-index hardcode (require semantic token from tailwind.config.ts)
zindex-hardcode:
	@echo "→ detect_zindex_hardcode.py..."
	@python3 scripts/detect_zindex_hardcode.py --ci

# z261k: <input> elements without aria-label / <label> association (a11y)
a11y-input-label:
	@echo "→ detect_a11y_input_no_label.py..."
	@python3 scripts/detect_a11y_input_no_label.py --ci

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
