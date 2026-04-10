#!/usr/bin/env python3
"""Rename duplicate error variables"""

import re
from pathlib import Path

def rename_errors_in_file(filepath):
    """Rename error to error1, error2, etc when there are multiple in one scope"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')

    # Find all lines with "const { ... error"
    error_matches = []
    for i, line in enumerate(lines):
        if re.search(r'{\s*[^}]*,\s*error\s*}', line) and 'await supabase' in line:
            error_matches.append(i)

    # If there are multiple error declarations, rename them
    if len(error_matches) > 1:
        for idx, line_no in enumerate(error_matches):
            error_name = f"error{idx + 1}" if idx > 0 else "error"

            # Rename in destructuring
            lines[line_no] = re.sub(
                r',\s*error\s*}',
                f', {error_name} }}',
                lines[line_no]
            )

            # Find and rename the if check on the following line(s)
            for j in range(line_no + 1, min(line_no + 15, len(lines))):
                if f'if (error)' in lines[j]:
                    lines[j] = lines[j].replace('if (error)', f'if ({error_name})')
                    lines[j] = lines[j].replace(f'error.message', f'{error_name}.message')
                    lines[j] = lines[j].replace('error:', f'{error_name}:')
                    break
                if re.search(r'const\s+{', lines[j]):  # Another const
                    break

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

# Files to fix
files = [
    'app/api/gym/curriculum/route.ts',
    'app/api/gym/kick/route.ts',
    'app/api/gym/regenerate-invite/route.ts',
    'app/api/stripe/portal/route.ts',
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
        rename_errors_in_file(fpath)
        print(f"✅ {fpath}")

print("\nDone!")
