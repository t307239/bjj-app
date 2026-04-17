#!/usr/bin/env node
/**
 * scripts/check-env.mjs — Build-time environment variable validator
 *
 * Q-106: Prevents silent failures by checking that all required env vars
 * are set before the build starts. CI uses placeholder values for
 * NEXT_PUBLIC_* vars, so we only enforce server-side secrets in production.
 *
 * Usage:
 *   node scripts/check-env.mjs              # check build-essential vars
 *   node scripts/check-env.mjs --strict     # also check server secrets (prod only)
 */

const REQUIRED_BUILD = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const REQUIRED_RUNTIME = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VAPID_PRIVATE_KEY",
  "VAPID_PUBLIC_KEY",
];

const isStrict = process.argv.includes("--strict");
const vars = isStrict ? [...REQUIRED_BUILD, ...REQUIRED_RUNTIME] : REQUIRED_BUILD;

const missing = vars.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error("\n❌ Missing required environment variables:\n");
  for (const name of missing) {
    console.error(`   • ${name}`);
  }
  console.error(
    "\n💡 Check Vercel dashboard → Settings → Environment Variables.\n" +
    "   For local dev, copy .env.local.example to .env.local\n"
  );
  process.exit(1);
}

console.log(`✅ Environment check passed (${vars.length} vars, mode=${isStrict ? "strict" : "build"})`);
