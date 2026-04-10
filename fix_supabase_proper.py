#!/usr/bin/env python3
"""
Fix Supabase queries - properly handle scope conflicts.
For each query, destructure error, then check it immediately.
If error variable is already in scope, use a block scope with try.
"""

import re
import os
from pathlib import Path

def find_source_files():
    """Find all .ts and .tsx files (exclude node_modules)."""
    result = []
    for root, dirs, files in os.walk('/sessions/determined-charming-bohr/mnt/bjj-app'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', 'dist', '.git']]
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                result.append(os.path.join(root, file))
    return result

def fix_file(filepath):
    """
    Fix Supabase queries by destructuring error and checking it.
    Returns number of fixes.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    fixed_count = 0

    i = 0
    while i < len(lines):
        line = lines[i]

        # Pattern: const/let { data[: var] } = await supabase...from(
        # Check if it has the pattern
        if re.search(r'(?:const|let)\s*{\s*[^}]*data\s*(?::\s*\w+)?\s*[^}]*}\s*=\s*await\s+\w*supabase', line):
            # Check if error is already destructured
            if 'error' in line.split('=')[0]:  # error in the destructuring part
                i += 1
                continue

            # Check if this line has await supabase.from(
            if '.from(' not in line:
                i += 1
                continue

            # Extract the destructuring part
            match = re.search(r'(?:const|let)\s*(\{\s*[^}]+\s*})\s*=', line)
            if not match:
                i += 1
                continue

            destructuring = match.group(1)

            # Add error to destructuring
            # Remove trailing whitespace and }
            new_destructuring = destructuring.rstrip().rstrip('}').rstrip() + ', error }'

            # Build new line
            new_line = line[:match.start(1)] + new_destructuring + line[match.end(1):]
            lines[i] = new_line

            # Find the end of the query (;)
            query_end_idx = i
            for j in range(i + 1, min(i + 30, len(lines))):
                if ';' in lines[j]:
                    query_end_idx = j
                    break

            # Check if error handling already exists on next line
            next_idx = query_end_idx + 1
            if next_idx < len(lines) and 'if (error)' in lines[next_idx]:
                fixed_count += 1
                i += 1
                continue

            # Extract indentation
            indent_match = re.match(r'^(\s*)', line)
            indent = indent_match.group(1) if indent_match else ""

            # Build error check
            filename = Path(filepath).name
            is_api = "/api/" in filepath or "auth/callback" in filepath

            if is_api:
                error_check = (f'{indent}if (error) {{\n'
                              f'{indent}  console.error("{filename}:query", error);\n'
                              f'{indent}  return NextResponse.json({{ error: error.message }}, {{ status: 500 }});\n'
                              f'{indent}}}')
            else:
                error_check = f'{indent}if (error) console.error("{filename}:query", error);'

            # Insert after query
            lines.insert(query_end_idx + 1, error_check)
            fixed_count += 1

        i += 1

    # Write back
    if fixed_count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    return fixed_count

# Main
os.chdir('/sessions/determined-charming-bohr/mnt/bjj-app')
files = find_source_files()

total = 0
for fpath in files:
    count = fix_file(fpath)
    if count > 0:
        relpath = os.path.relpath(fpath, '/sessions/determined-charming-bohr/mnt/bjj-app')
        print(f"✅ {relpath}: {count} fix(es)")
        total += count

print(f"\n{'='*60}")
print(f"✅ Total: {total} fixes")
print(f"{'='*60}")
