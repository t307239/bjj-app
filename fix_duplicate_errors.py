#!/usr/bin/env python3
"""
Fix duplicate error declarations by renaming to errorN format.
"""

import re
from pathlib import Path

def fix_file(filepath):
    """
    For each file, rename error variables to be unique within the function.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    fixed_count = 0
    error_counter = {}  # Track error count per line context

    i = 0
    while i < len(lines):
        line = lines[i]

        # Find lines with ", error " in Supabase queries
        if '{ data' in line and ', error ' in line and 'await supabase' in line:
            # This is a Supabase query with error destructuring
            # We need to rename it to be unique

            # Check what comes after in context - find which query number this is
            # Count occurrences of this pattern in lines 0..i
            query_num = sum(1 for j in range(i) if ', error ' in lines[j] and 'await supabase' in lines[j])

            # If query_num > 0, we need to rename this error
            if query_num > 0:
                # Rename error to error1, error2, etc.
                error_var = f"error{query_num}"

                # Replace ", error " with ", error{query_num} "
                new_line = re.sub(r',\s*error\s*([}\)])', f', {error_var} \\1', line)
                lines[i] = new_line
                fixed_count += 1

                # Now find and update all references to this error in the following lines
                # Look for "if (error)" and replace with "if (errorN)"
                for j in range(i + 1, min(i + 30, len(lines))):
                    if 'if (error)' in lines[j] and j > i:  # Error check should come right after
                        lines[j] = lines[j].replace('if (error)', f'if ({error_var})')
                        lines[j] = lines[j].replace(f'error.message', f'{error_var}.message')
                        lines[j] = lines[j].replace(f'"error":', f'"{error_var}":')
                        break
                    if 'const' in lines[j] or 'const {' in lines[j]:
                        break  # Stop if we hit another const

        i += 1

    # Write back
    if fixed_count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    return fixed_count

# Fix all API route files
api_files = [
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/api/ai-coach/generate/route.ts',
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/api/gym/curriculum/route.ts',
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/api/gym/kick/route.ts',
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/api/gym/regenerate-invite/route.ts',
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/api/stripe/portal/route.ts',
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/auth/callback/route.ts',
    '/sessions/determined-charming-bohr/mnt/bjj-app/app/wiki/[lang]/[slug]/page.tsx',
    '/sessions/determined-charming-bohr/mnt/bjj-app/components/GymRanking.tsx',
    '/sessions/determined-charming-bohr/mnt/bjj-app/components/ProfileForm.tsx',
]

total = 0
for fpath in api_files:
    p = Path(fpath)
    if p.exists():
        count = fix_file(fpath)
        if count > 0:
            print(f"✅ {p.name}: {count} renames")
            total += count

print(f"\nTotal: {total} renames")
