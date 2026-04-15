#!/usr/bin/env bash
# Q-33: Scaffold a new API route with best practices baked in.
# Usage: ./scripts/new-api-route.sh <route-path> [method]
# Example: ./scripts/new-api-route.sh records/export GET
#          → creates app/api/records/export/route.ts

set -euo pipefail

ROUTE_PATH="${1:?Usage: $0 <route-path> [method]}"
METHOD="${2:-POST}"
METHOD_UPPER=$(echo "$METHOD" | tr '[:lower:]' '[:upper:]')

DIR="app/api/${ROUTE_PATH}"
FILE="${DIR}/route.ts"

if [ -f "$FILE" ]; then
  echo "❌ ${FILE} already exists"
  exit 1
fi

mkdir -p "$DIR"

cat > "$FILE" << 'TEMPLATE'
/**
 * @route METHOD /api/ROUTE_PATH
 * @description TODO: Describe what this endpoint does
 * @auth Required
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function METHOD_FN(req: Request) {
  const log = logger.child({ route: "/api/ROUTE_PATH", requestId: crypto.randomUUID() });

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log.warn("auth.failed", { reason: authError?.message ?? "no session" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    log.info("ROUTE_PATH.start", { userId: user.id });

    // TODO: Implement logic here

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("ROUTE_PATH.error", {}, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
TEMPLATE

# Replace placeholders
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s|METHOD_FN|${METHOD_UPPER}|g" "$FILE"
  sed -i '' "s|METHOD|${METHOD_UPPER}|g" "$FILE"
  sed -i '' "s|ROUTE_PATH|${ROUTE_PATH}|g" "$FILE"
else
  sed -i "s|METHOD_FN|${METHOD_UPPER}|g" "$FILE"
  sed -i "s|METHOD|${METHOD_UPPER}|g" "$FILE"
  sed -i "s|ROUTE_PATH|${ROUTE_PATH}|g" "$FILE"
fi

echo "✅ Created ${FILE} (${METHOD_UPPER})"
echo "   → logger.child with requestId"
echo "   → auth check boilerplate"
echo "   → error boundary with Sentry forwarding"
