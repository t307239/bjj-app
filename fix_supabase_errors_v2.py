#!/usr/bin/env python3
"""
Fix Supabase queries - smarter version that detects existing error handling.
"""

import re
import os
from pathlib import Path

def is_api_route(filepath):
    return "/api/" in filepath or "auth/callback" in filepath

def fix_file(filepath):
    """
    Read file and fix all Supabase error patterns.
    Returns number of fixes made.
    """
    full_path = Path(filepath)
    if not full_path.exists():
        return 0

    # Read with UTF-8
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    original_lines = lines.copy()
    fixes = 0

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for Supabase query patterns
        # Pattern: const { data[: varname] } = await supabase
        if "const {" in line and "await supabase" in line and ".from(" in line:
            # Check if error is already in the destructuring
            if ", error" in line or ",error" in line:
                # Skip - already has error
                i += 1
                continue

            # Check pattern matches
            if not re.search(r'const\s*{\s*data\s*(?::\s*\w+)?[^}]*}', line):
                i += 1
                continue

            # Add error to destructuring
            # Find the closing } before =
            match = re.search(r'(const\s*{\s*[^}]+?)\s*}\s*=\s*await\s+supabase', line)
            if match:
                prefix = match.group(1)
                rest_of_line = line[match.end():]

                # Replace } with , error }
                modified_line = prefix + ', error } = await supabase' + rest_of_line
                lines[i] = modified_line
                fixes += 1

                # Find the end of query (;)
                query_end_idx = i
                for j in range(i + 1, min(i + 30, len(lines))):
                    if ";" in lines[j] and not lines[j].strip().startswith("//"):
                        query_end_idx = j
                        break

                # Check if error handling already exists on next line
                next_line_idx = query_end_idx + 1
                if next_line_idx < len(lines):
                    next_line = lines[next_line_idx]
                    if "if (error)" in next_line:
                        # Already has error check
                        i += 1
                        continue

                # Extract indentation
                indent_match = re.match(r'^(\s*)', line)
                indent = indent_match.group(1) if indent_match else ""

                # Build error check
                filename = Path(filepath).name
                if is_api_route(filepath):
                    error_check = (f'{indent}if (error) {{\n'
                                  f'{indent}  console.error("{filename}:query", error);\n'
                                  f'{indent}  return NextResponse.json({{ error: error.message }}, {{ status: 500 }});\n'
                                  f'{indent}}}')
                else:
                    error_check = f'{indent}if (error) console.error("{filename}:query", error);'

                # Insert after query
                lines.insert(query_end_idx + 1, error_check)
                i = query_end_idx + 2  # Skip past the inserted lines

        i += 1

    # Write back if changed
    if lines != original_lines:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    return fixes

# Find all files with Supabase patterns
os.chdir('/sessions/determined-charming-bohr/mnt/bjj-app')

print("🔍 Scanning for unfixed Supabase queries...\n")

total_fixes = 0
for root, dirs, files in os.walk('.'):
    # Skip node_modules and build dirs
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', 'dist', '.git']]

    for file in files:
        if file.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, file).lstrip('./')
            fixes = fix_file(filepath)
            if fixes > 0:
                print(f"✅ {filepath}: {fixes} fix(es)")
                total_fixes += fixes

print(f"\n{'='*60}")
print(f"✅ Total: {total_fixes} fixes")
print(f"{'='*60}")
