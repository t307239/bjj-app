# Makefile — z176d (extended z255n): bjj-app forcing function
#
# 「完璧」と宣言する前に必ず `make verify` を実行する。
# 6 つの lint が全パスすれば commit 可能、1 つでも 🔴 fail なら作業未完了。

.PHONY: verify locale-drift hidden-bugs schema-mismatch i18n-keys typecheck test all clean indexable-orphans missing-canonical wiki-url internal-links unsafe-settimeout localstorage-hazards optimistic-rollback unmount-race router-push-session-end unsafe-localstorage-setitem zindex-hardcode a11y-input-label img-no-dimensions input-autocomplete a11y-table-label unsafe-dynamic-href api-auth-bypass supabase-rls-gap silent-catch-observability supabase-select-star mobile-touch-target

# Run all anti-regression checks
verify: typecheck locale-drift hidden-bugs schema-mismatch i18n-keys dead-components indexable-orphans missing-canonical wiki-url internal-links unsafe-settimeout localstorage-hazards optimistic-rollback unmount-race router-push-session-end unsafe-localstorage-setitem zindex-hardcode a11y-input-label img-no-dimensions input-autocomplete a11y-table-label unsafe-dynamic-href api-auth-bypass supabase-rls-gap silent-catch-observability supabase-select-star mobile-touch-target
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

# z261k: <img>/<Image> missing width/height (CLS hazard / Core Web Vitals)
img-no-dimensions:
	@echo "→ detect_img_no_dimensions.py..."
	@python3 scripts/detect_img_no_dimensions.py --ci

# z261m: <input type=email/password/tel/url> missing autoComplete (WCAG 1.3.5)
input-autocomplete:
	@echo "→ detect_input_no_autocomplete.py..."
	@python3 scripts/detect_input_no_autocomplete.py --ci

# z261n: <table> without accessible name (caption/aria-label/aria-labelledby/role=presentation)
a11y-table-label:
	@echo "→ detect_a11y_table_no_label.py..."
	@python3 scripts/detect_a11y_table_no_label.py --ci

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

# z261p: <a href={X}> 動的 URL injection 防御 (javascript: / data: XSS scheme guard)
unsafe-dynamic-href:
	@echo "→ detect_unsafe_dynamic_href.py..."
	@python3 scripts/detect_unsafe_dynamic_href.py --ci

# z261p: API route の auth check 不在検出 (public/webhook/cron opt-out marker 必須)
api-auth-bypass:
	@echo "→ detect_api_auth_bypass.py..."
	@python3 scripts/detect_api_auth_bypass.py --ci

# z261p: user-scoped table の mutation で owner filter 不在 (defence-in-depth audit)
supabase-rls-gap:
	@echo "→ detect_supabase_rls_gap.py..."
	@python3 scripts/detect_supabase_rls_gap.py --ci

# z261q: catch block で logger / Sentry / opt-out marker のどれも無い silent swallow を block
silent-catch-observability:
	@echo "→ detect_silent_catch_observability.py..."
	@python3 scripts/detect_silent_catch_observability.py --ci

# z261r: DB perf — .select("*") over-fetch を block ({count, head:true} 例外 + // select-star: ok opt-out)
supabase-select-star:
	@echo "→ detect_supabase_select_star.py..."
	@python3 scripts/detect_supabase_select_star.py --ci

# z261r: mobile UX — icon-only square button (min-w-[NN] && min-h-[NN]) で < 44px を block
mobile-touch-target:
	@echo "→ detect_mobile_touch_target.py..."
	@python3 scripts/detect_mobile_touch_target.py --ci

# Run vitest unit tests
test:
	@echo "→ vitest..."
	@./node_modules/.bin/vitest run __tests__/cronAuth.test.ts __tests__/safeNextPath.test.ts __tests__/bjjDuration.test.ts

all: verify test
	@echo "All checks complete (incl. tests)."

clean:
	@find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
