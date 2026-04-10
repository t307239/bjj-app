#!/usr/bin/env python3
"""
Fix all Supabase queries to properly handle errors.
Converts: const { data: ... } = await supabase...
To: const { data: ..., error } = await supabase... + error check
"""

import re
import os
from pathlib import Path

# File list with line numbers from detect_hidden_bugs.py
FILES_TO_FIX = {
    # API routes (server-side)
    "app/api/ai-coach/generate/route.ts": [175, 204],
    "app/api/gym/curriculum/route.ts": [50, 61],
    "app/api/gym/kick/route.ts": [62, 73],
    "app/api/gym/regenerate-invite/route.ts": [54],
    "app/api/stripe/portal/route.ts": [56],
    # Auth callback
    "app/auth/callback/route.ts": [45],
    # Server pages (SSR)
    "app/dashboard/page.tsx": [277],
    "app/gym/dashboard/page.tsx": [63],
    "app/gym/join/[invite_code]/page.tsx": [84],
    "app/techniques/skillmap/page.tsx": [44],
    "app/wiki/[lang]/[slug]/page.tsx": [184],
    # Client components
    "components/BodyManagementSection.tsx": [38],
    "components/CompetitionStats.tsx": [98],
    "components/GoalTracker.tsx": [107, 150],
    "components/GymRanking.tsx": [76, 104],
    "components/PartnerStatsCard.tsx": [58],
    "components/PersonalBests.tsx": [88],
    "components/ProfileForm.tsx": [77, 86, 686],
    "components/RollAnalyticsCard.tsx": [168],
    "components/StreakFreeze.tsx": [150],
    "components/TrainingBarChart.tsx": [86, 143],
    "components/TrainingChart.tsx": [53],
    "components/TrainingLog.tsx": [121, 137],
    "components/TrainingTypeChart.tsx": [273],
}

def is_api_route(filepath):
    """Check if file is an API route."""
    return "/api/" in filepath or "auth/callback" in filepath

def fix_supabase_query(content, filepath, line_number):
    """
    Fix a single Supabase query at a given line.
    Returns tuple: (modified_content, was_fixed)
    """
    lines = content.split('\n')
    if line_number < 1 or line_number > len(lines):
        return content, False

    # Working with 0-indexed array
    idx = line_number - 1

    # Look for the pattern starting from this line
    # Pattern: const { data[: varname] } = await supabase...
    line = lines[idx]

    # Check if this line has the Supabase pattern
    if "const {" not in line or "await supabase" not in line:
        # Try searching nearby lines (within -3 to +3 range)
        found = False
        for search_offset in range(-3, 4):
            search_idx = idx + search_offset
            if 0 <= search_idx < len(lines):
                if "const {" in lines[search_idx] and "await supabase" in lines[search_idx]:
                    idx = search_idx
                    found = True
                    break
        if not found:
            return content, False

    line = lines[idx]

    # Check if error is already in the destructuring
    if ", error" in line or ",error" in line:
        return content, False

    # Pattern: const { data: varname } = or const { data } =
    # Need to add ", error" before the closing }

    # Find the destructuring pattern
    match = re.search(r'const\s*{\s*data\s*(?::\s*\w+)?\s*}', line)
    if not match:
        return content, False

    # Extract the matched pattern and modify it
    old_pattern = match.group(0)
    # Replace } with , error }
    new_pattern = old_pattern.rstrip('}') + ', error }'
    modified_line = line[:match.start()] + new_pattern + line[match.end():]

    lines[idx] = modified_line

    # Find the end of the query (looking for the line ending with ;)
    query_end_idx = idx
    for i in range(idx + 1, min(idx + 30, len(lines))):
        if ";" in lines[i] and not lines[i].strip().startswith("//"):
            query_end_idx = i
            break

    # Extract indentation from the const line
    indent_match = re.match(r'^(\s*)', line)
    indent = indent_match.group(1) if indent_match else ""

    # Build error handling statement
    filename = Path(filepath).name

    if is_api_route(filepath):
        # For API routes, add error check with return
        error_check = (f'{indent}if (error) {{\n'
                      f'{indent}  console.error("{filename}:query", error);\n'
                      f'{indent}  return NextResponse.json({{ error: error.message }}, {{ status: 500 }});\n'
                      f'{indent}}}')
    else:
        # For client/SSR pages, just log the error
        error_check = f'{indent}if (error) console.error("{filename}:query", error);'

    # Insert error check after the query
    lines.insert(query_end_idx + 1, error_check)

    return '\n'.join(lines), True

def main():
    os.chdir('/sessions/determined-charming-bohr/mnt/bjj-app')

    total_fixed = 0
    total_files = 0

    for filepath, line_numbers in FILES_TO_FIX.items():
        full_path = Path(filepath)
        if not full_path.exists():
            continue

        print(f"📄 {filepath}")
        total_files += 1

        # Read file with UTF-8
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
        except Exception as e:
            print(f"  ❌ Error reading file: {e}")
            continue

        modified_content = original_content
        files_fixed_count = 0

        # Fix each line (in reverse order to maintain line numbers)
        for line_num in sorted(line_numbers, reverse=True):
            modified_content, was_fixed = fix_supabase_query(modified_content, filepath, line_num)
            if was_fixed:
                print(f"  ✅ Fixed line {line_num}")
                files_fixed_count += 1
                total_fixed += 1

        # Write back only if changed
        if modified_content != original_content:
            try:
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(modified_content)
                print(f"  💾 Written back ({files_fixed_count} fixes)")
            except Exception as e:
                print(f"  ❌ Error writing file: {e}")

    print(f"\n{'='*60}")
    print(f"✅ Total: {total_fixed} fixes across {total_files} files")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
