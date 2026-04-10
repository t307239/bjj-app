#!/usr/bin/env python3
"""
Properly fix all Supabase error handling.
Strategy: For multiple queries in same scope, rename to errorQueryType or errorN.
"""

import re
from pathlib import Path

def fix_file_comprehensive(filepath):
    """Comprehensive fix for Supabase errors"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')

    # Find all Supabase queries
    query_indices = []
    for i, line in enumerate(lines):
        if 'await supabase' in line and '.from(' in line and 'const {' in line:
            query_indices.append(i)

    # If multiple queries in same function, they likely need renaming
    # But let's be smarter: find function boundaries
    function_boundaries = []
    current_func_start = 0
    brace_count = 0

    for i, line in enumerate(lines):
        if 'export ' in line or 'function ' in line or ' => {' in line:
            current_func_start = i
        brace_count += line.count('{') - line.count('}')

        # Track functions for context
        if brace_count == 0 and i > current_func_start + 5:
            function_boundaries.append((current_func_start, i))
            current_func_start = i + 1

    # For each query, check if there's a duplicate error in same function
    for idx, line_no in enumerate(query_indices):
        line = lines[line_no]

        # Check how many queries exist in the same function
        same_func_queries = [
            q for q in query_indices
            if any(start <= q <= end for start, end in function_boundaries
                   if start <= line_no <= end)
        ]

        # If this is the 2nd+ query, needs renaming
        query_position_in_func = same_func_queries.index(line_no) if line_no in same_func_queries else 0

        if query_position_in_func > 0:
            # Rename this error to error{N}
            error_name = f"error{query_position_in_func + 1}"

            # Fix the destructuring
            lines[line_no] = re.sub(
                r'(\{\s*data[^}]*),\s*error\s*(\})',
                rf'\1, {error_name} \2',
                lines[line_no]
            )

            # Find and fix the if check (should be within next 15 lines)
            for j in range(line_no + 1, min(line_no + 20, len(lines))):
                if 'if (error)' in lines[j]:
                    # Replace error with the new name
                    lines[j] = re.sub(
                        r'if\s*\(\s*error\s*\)',
                        f'if ({error_name})',
                        lines[j]
                    )
                    lines[j] = lines[j].replace('error.message', f'{error_name}.message')
                    lines[j] = lines[j].replace(', error)', f', {error_name})')
                    lines[j] = lines[j].replace('"error":', f'"{error_name}":')
                    break

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

# Files with errors
files = [
    'app/api/gym/curriculum/route.ts',
    'app/api/gym/kick/route.ts',
    'app/api/gym/regenerate-invite/route.ts',
    'app/auth/callback/route.ts',
    'app/wiki/[lang]/[slug]/page.tsx',
    'components/GymRanking.tsx',
    'components/ProfileForm.tsx',
]

import os
os.chdir('/sessions/determined-charming-bohr/mnt/bjj-app')

for fpath in files:
    p = Path(fpath)
    if p.exists():
        fix_file_comprehensive(fpath)
        print(f"✅ {fpath}")
