#!/usr/bin/env python3
"""
detect_optimistic_no_rollback.py — z258: optimistic-UI-without-rollback audit.

CLAUDE.md rule (Round 4 UI bug sweep):
  Optimistic state updates (setState before await) MUST roll back on
  server error. Otherwise the UI shows "saved" but the database stayed at
  the old value → silent data divergence.

検出 (genuine pattern):
  Function body contains:
    1. setX(<value>) call (DATA setter, not loading flag)   ← optimistic
    2. await supabase.from(...).update|delete(...)          ← server call
    3. NO matching setX call inside an `if (error)` / catch / `else` block
       AND no `prev`/`snapshot`/`<existingState>` rollback call

許容パターン (false positive 抑制):
  - 同じ setter が error / catch / else branch 内で再度呼ばれている (= 復元)
  - 関数内で `const snapshot = ...` `const prev = ...` 変数を捕捉してから
    使っている (= manual rollback)
  - setLoading / setSaving / setBusy / setError* / setToast / setDismissing
    等のステータス setter は data 状態でないため除外
  - setX(true)/setX(false) 純粋 boolean toggle は除外

scope:
  app/, components/, hooks/ の .ts/.tsx のみ。tests / api server route 除外。

--ci → hit > 0 で exit 1
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "hooks"]
SCAN_EXTS = (".ts", ".tsx")
EXCLUDE_FRAGMENTS = (
    "/api/",
    "/__tests__/",
    ".test.",
    ".spec.",
    "/scripts/",
)

# Match `await supabase ... .update|delete(` (the destructive ops we care about).
# We don't catch insert because new-row creation has no prior state to roll back.
DESTRUCTIVE_AWAIT_RE = re.compile(
    r"await\s+(?:[\w.]+\.)?supabase[\s\S]{0,300}?\.(?P<op>update|delete)\s*\(",
)

# Status / UI / message setters that are NOT data optimistic updates.
# Endings (case-sensitive on the suffix part).
STATUS_SUFFIXES = (
    "Loading", "Saving", "Submitting", "Busy", "Pending",
    "Toggling", "Processing", "Updating", "Uploading", "Searching",
    "Fetching", "Refreshing", "Reloading", "Deleting", "DeletingId",
    "Dismissing", "Leaving", "Joining", "Connecting", "Disconnecting",
    "Loading", "Sending", "Posting",
)

# Whole-name prefixes that aren't data state.
NON_DATA_PREFIXES = (
    "setError", "setErrors", "setErrorMsg", "setMessage", "setMsg",
    "setToast", "setStatus", "setProgress", "setCount", "setHasError",
    "setMounted", "setReady", "setSavingPref", "setIsOnline",
    "setKickTarget", "setSavingFlag", "setNetworkError",
    "setLoading", "setSaving", "setBusy", "setSubmitting",
    "setPending", "setRefreshKey", "setReloadKey", "setRequestId",
    "setActivePart", "setSavingPart", "setActiveTab", "setActiveStep",
    "setSavedToast", "setShowToast", "setShowError", "setHasOptedIn",
    "setDeleting", "setUpdating", "setEditing", "setLeaving",
)

# Is/Has/Show/Hide/Will/Should/Can/Did boolean UI state setters.
BOOLEAN_UI_RE = re.compile(r"^set(Is|Has|Show|Hide|Will|Should|Can|Did|Open|Close|Toggle|Confirm)[A-Z]")


def find_handler_blocks(src: str) -> list[tuple[int, int, str, str]]:
    """Find all named handler/callback blocks.

    Returns list of (start_offset, end_offset, body, handler_name).
    Patterns matched:
      const handlerName = useCallback(async (...) => { ... }, [...]);
      const handlerName = async (...) => { ... };
      const handlerName = async function(...) { ... };
      async function handlerName(...) { ... }
      handlerName: async (...) => { ... }      (object method)
    """
    blocks: list[tuple[int, int, str, str]] = []

    # Pattern 1: const NAME = (useCallback\(\s*)?async (...) => {
    pat1 = re.compile(
        r"const\s+(?P<name>\w+)\s*=\s*(?:useCallback\s*\(\s*)?async\s*(?:\([^)]*\)|\w+)\s*=>\s*\{",
    )
    # Pattern 2: const NAME = async function(...) {
    pat2 = re.compile(
        r"const\s+(?P<name>\w+)\s*=\s*async\s+function[^(]*\([^)]*\)\s*\{",
    )
    # Pattern 3: async function NAME(...) {
    pat3 = re.compile(
        r"async\s+function\s+(?P<name>\w+)\s*\([^)]*\)\s*\{",
    )

    for pat in (pat1, pat2, pat3):
        for m in pat.finditer(src):
            name = m.group("name")
            # Find brace open and balance braces
            brace_open = src.find("{", m.start())
            if brace_open < 0:
                continue
            end = balance_braces(src, brace_open)
            if end < 0:
                continue
            body = src[brace_open : end + 1]
            blocks.append((m.start(), end, body, name))
    return blocks


def balance_braces(src: str, brace_open: int) -> int:
    """Given index of '{', return index of matching '}'. -1 on failure."""
    depth = 1
    i = brace_open + 1
    n = len(src)
    while i < n and depth > 0:
        c = src[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        elif c == "/" and i + 1 < n and src[i + 1] == "/":
            # Line comment: skip to newline
            nl = src.find("\n", i)
            if nl < 0:
                return -1
            i = nl
        elif c == "/" and i + 1 < n and src[i + 1] == "*":
            # Block comment: skip to */
            close = src.find("*/", i + 2)
            if close < 0:
                return -1
            i = close + 1
        elif c in ('"', "'", "`"):
            quote = c
            i += 1
            while i < n and src[i] != quote:
                if src[i] == "\\":
                    i += 2
                    continue
                # template-literal interpolation `${...}`
                if quote == "`" and src[i] == "$" and i + 1 < n and src[i + 1] == "{":
                    inner_close = balance_braces(src, i + 1)
                    if inner_close < 0:
                        return -1
                    i = inner_close + 1
                    continue
                i += 1
        i += 1
    return -1


def is_data_setter(name: str) -> bool:
    """Return True if `name` is plausibly a data state setter (not status/UI)."""
    if any(name.endswith(suf) for suf in STATUS_SUFFIXES):
        return False
    if any(name.startswith(pre) for pre in NON_DATA_PREFIXES):
        return False
    if BOOLEAN_UI_RE.match(name):
        return False
    return True


def find_optimistic_setters(body: str) -> list[str]:
    """Return list of setter names called BEFORE the first destructive await
    that look like data optimistic updates (i.e., NOT status/UI flags)."""
    m = DESTRUCTIVE_AWAIT_RE.search(body)
    if not m:
        return []
    head = body[: m.start()]
    optimistic: list[str] = []
    for sm in re.finditer(r"(?<![.\w])(set[A-Z]\w*)\s*\(", head):
        # `(?<![.\w])` ensures we skip `localStorage.setItem(...)` and similar
        # method calls — only top-level `setX(...)` calls count.
        name = sm.group(1)
        # Inspect the call to see what argument it gets — pure boolean toggles
        # like setX(true)/setX(false) are status flags.
        call_start = sm.end()
        # Grab arg approximation
        arg = head[call_start : call_start + 20]
        if re.match(r"\s*(?:true|false|null|undefined)\s*[\),]", arg):
            continue
        if not is_data_setter(name):
            continue
        if name not in optimistic:
            optimistic.append(name)
    return optimistic


def has_rollback_for_setter(body: str, setter: str) -> bool:
    """Return True if `setter` is invoked inside an error branch / catch /
    else block, OR the function uses an explicit `prev/snapshot` rollback
    pattern referencing this setter."""

    # Strategy 1: find `if (error)`, `else if (error)`, `if (!error) {...} else`,
    # or `catch (...)` and check whether `setter(...)` appears inside.
    error_branches = []

    # if (error) { ... }
    for em in re.finditer(r"if\s*\(\s*[^)]*\berror\b[^)]*\)\s*\{", body):
        # Skip `if (!error)` / `if (!error && ...)` — that's the success branch
        cond = body[em.start() : em.end()]
        if re.search(r"!\s*error\b", cond):
            # success branch — but the matching `else` is the error branch
            close = balance_braces(body, em.end() - 1)
            if close < 0:
                continue
            after = body[close + 1 :]
            else_m = re.match(r"\s*else\s*\{", after)
            if else_m:
                else_open = close + 1 + else_m.end() - 1
                else_close = balance_braces(body, else_open)
                if else_close >= 0:
                    error_branches.append(body[else_open : else_close + 1])
            continue
        # actual error branch (covers `if (error)` / `if (error || ...)`)
        close = balance_braces(body, em.end() - 1)
        if close < 0:
            continue
        error_branches.append(body[em.end() - 1 : close + 1])

    # catch (e) { ... }
    for cm in re.finditer(r"\bcatch\s*\([^)]*\)\s*\{", body):
        close = balance_braces(body, cm.end() - 1)
        if close < 0:
            continue
        error_branches.append(body[cm.end() - 1 : close + 1])

    setter_call = re.compile(r"\b" + re.escape(setter) + r"\s*\(")
    for branch in error_branches:
        if setter_call.search(branch):
            return True

    # Strategy 2: explicit `prev`/`snapshot` variable + setter(prev) somewhere
    # in body (the rollback may not be inside an `if (error)` if e.g. the
    # function uses early-return-on-error).
    snapshot_assign = re.compile(
        r"\b(?:const|let)\s+(?P<var>(?:prev|prior|previous|snapshot|backup|original)\w*)\s*=",
    )
    snap_vars = [m.group("var") for m in snapshot_assign.finditer(body)]
    if snap_vars:
        for v in snap_vars:
            if re.search(setter + r"\s*\(\s*" + re.escape(v) + r"\b", body):
                return True

    # Strategy 3: the setter is called with an outer-scope state value as the
    # rollback target (common pattern: `setStatus(status)` where `status` is
    # the captured snapshot of the prior state). Detected by setter call
    # appearing inside `if (error) { ... setX(<bareWord>) ... }` already
    # caught by Strategy 1.

    return False


def scan_file(path: Path) -> list[str]:
    try:
        src = path.read_text(encoding="utf-8")
    except Exception:
        return []
    if not DESTRUCTIVE_AWAIT_RE.search(src):
        return []
    findings: list[str] = []
    for start, end, body, name in find_handler_blocks(src):
        # Allow opt-out comment immediately above the handler
        comment_window = src[max(0, start - 200) : start]
        if "optimistic-no-rollback: ok" in comment_window:
            continue
        if not DESTRUCTIVE_AWAIT_RE.search(body):
            continue
        optimistic = find_optimistic_setters(body)
        if not optimistic:
            continue
        # All optimistic setters must have rollback for the function to be safe.
        missing = [s for s in optimistic if not has_rollback_for_setter(body, s)]
        if not missing:
            continue
        line_no = src[:start].count("\n") + 1
        rel = path.relative_to(REPO_ROOT)
        op_match = DESTRUCTIVE_AWAIT_RE.search(body)
        op = op_match.group("op") if op_match else "?"
        for s in missing:
            findings.append(
                f"{rel}:{line_no}: handler `{name}` calls `{s}(...)` before supabase.{op}() with no rollback"
            )
    return findings


def main(argv: list[str]) -> int:
    ci_mode = "--ci" in argv
    findings: list[str] = []
    for d in SCAN_DIRS:
        base = REPO_ROOT / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if not p.is_file() or not p.suffix in SCAN_EXTS:
                continue
            sp = str(p)
            if any(frag in sp for frag in EXCLUDE_FRAGMENTS):
                continue
            findings.extend(scan_file(p))
    if findings:
        print(f"⚠️  optimistic-no-rollback: {len(findings)} hit(s)")
        for f in findings:
            print(f"  {f}")
        if ci_mode:
            return 1
        return 0
    print("✅ optimistic-no-rollback: 0 hit")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
