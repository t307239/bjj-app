#!/usr/bin/env node
/**
 * scripts/verify-backup.mjs — Supabase backup recency verification
 *
 * Q-111: Data pillar — automated backup health check.
 * Verifies that the most recent Supabase backup is within the expected window.
 *
 * Usage:
 *   node scripts/verify-backup.mjs                     # default 25h threshold
 *   node scripts/verify-backup.mjs --max-age-hours 48  # custom threshold
 *   node scripts/verify-backup.mjs --json              # JSON output for CI
 *
 * Exit codes:
 *   0 — backup is fresh (within threshold)
 *   1 — backup is stale or check failed
 *
 * Requirements:
 *   SUPABASE_ACCESS_TOKEN — personal access token (Settings → Access Tokens)
 *   SUPABASE_PROJECT_REF  — project reference ID (e.g. "abcdefghijklmnop")
 */

const DEFAULT_MAX_AGE_HOURS = 25; // daily backups + 1h tolerance

function parseArgs() {
  const args = process.argv.slice(2);
  let maxAgeHours = DEFAULT_MAX_AGE_HOURS;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max-age-hours" && args[i + 1]) {
      maxAgeHours = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--json") {
      jsonOutput = true;
    }
  }

  return { maxAgeHours, jsonOutput };
}

async function checkBackup() {
  const { maxAgeHours, jsonOutput } = parseArgs();

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!token || !projectRef) {
    const msg = "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF";
    if (jsonOutput) {
      console.log(JSON.stringify({ status: "error", message: msg }));
    } else {
      console.error(`❌ ${msg}`);
      console.error("   Set these in your environment or .env.local");
    }
    process.exit(1);
  }

  try {
    // Supabase Management API — list backups
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/backups`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }

    const data = await res.json();
    const backups = data.backups ?? data ?? [];

    if (!Array.isArray(backups) || backups.length === 0) {
      const msg = "No backups found";
      if (jsonOutput) {
        console.log(JSON.stringify({ status: "warn", message: msg, backups: 0 }));
      } else {
        console.warn(`⚠️  ${msg}`);
      }
      process.exit(1);
    }

    // Find the most recent backup
    const sorted = backups
      .filter((b) => b.inserted_at || b.created_at)
      .sort((a, b) => {
        const dateA = new Date(a.inserted_at ?? a.created_at).getTime();
        const dateB = new Date(b.inserted_at ?? b.created_at).getTime();
        return dateB - dateA;
      });

    const latest = sorted[0];
    const latestDate = new Date(latest.inserted_at ?? latest.created_at);
    const ageMs = Date.now() - latestDate.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const isFresh = ageHours <= maxAgeHours;

    const result = {
      status: isFresh ? "ok" : "stale",
      latestBackup: latestDate.toISOString(),
      ageHours: Math.round(ageHours * 10) / 10,
      maxAgeHours,
      totalBackups: sorted.length,
      backupStatus: latest.status ?? "unknown",
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result));
    } else {
      const icon = isFresh ? "✅" : "🔴";
      console.log(`${icon} Backup check: ${result.status}`);
      console.log(`   Latest: ${result.latestBackup}`);
      console.log(`   Age: ${result.ageHours}h (threshold: ${maxAgeHours}h)`);
      console.log(`   Status: ${result.backupStatus}`);
      console.log(`   Total backups: ${result.totalBackups}`);
    }

    process.exit(isFresh ? 0 : 1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (jsonOutput) {
      console.log(JSON.stringify({ status: "error", message: msg }));
    } else {
      console.error(`❌ Backup check failed: ${msg}`);
    }
    process.exit(1);
  }
}

checkBackup();
