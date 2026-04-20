#!/usr/bin/env python3
"""Add i18n keys for InviteQRCode and MilestoneShareCard features."""
import json
import sys

KEYS_EN = {
    "gym": {
        "qrTitle": "QR Code",
        "qrScanToJoin": "Scan to join our gym",
        "qrPrint": "Print QR Code",
        "qrPrintTitle": "Gym Invite QR Code",
        "qrAltText": "QR code for gym invite link"
    },
    "milestoneShare": {
        "shareTitle": "BJJ Milestone",
        "shareText": "{value} — {label} on BJJ App!",
        "buttonTitle": "Share milestone"
    }
}

KEYS_JA = {
    "gym": {
        "qrTitle": "QRコード",
        "qrScanToJoin": "スキャンしてジムに参加",
        "qrPrint": "QRコードを印刷",
        "qrPrintTitle": "ジム招待QRコード",
        "qrAltText": "ジム招待リンクのQRコード"
    },
    "milestoneShare": {
        "shareTitle": "BJJマイルストーン",
        "shareText": "{value} — {label} BJJ Appで達成!",
        "buttonTitle": "マイルストーンをシェア"
    }
}

KEYS_PT = {
    "gym": {
        "qrTitle": "QR Code",
        "qrScanToJoin": "Escaneie para entrar na academia",
        "qrPrint": "Imprimir QR Code",
        "qrPrintTitle": "QR Code de Convite da Academia",
        "qrAltText": "QR code do link de convite da academia"
    },
    "milestoneShare": {
        "shareTitle": "Marco do BJJ",
        "shareText": "{value} — {label} no BJJ App!",
        "buttonTitle": "Compartilhar marco"
    }
}

def add_keys(filepath, new_keys):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    for section, keys in new_keys.items():
        if section not in data:
            data[section] = {}
        for k, v in keys.items():
            data[section][k] = v

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"  Updated {filepath}")

def verify(filepath, new_keys):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    for section, keys in new_keys.items():
        for k, v in keys.items():
            actual = data.get(section, {}).get(k)
            if actual != v:
                print(f"  ERROR: {section}.{k} mismatch: {actual!r} != {v!r}", file=sys.stderr)
                return False
            # Check for mojibake (all chars should be > 0xFF for Japanese)
            if max(ord(c) for c in actual) <= 0xFF and any(ord(c) > 127 for c in v):
                print(f"  WARNING: possible mojibake in {section}.{k}: {actual!r}", file=sys.stderr)
    print(f"  Verified {filepath}")
    return True

if __name__ == "__main__":
    base = "messages"
    import os
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "messages")

    print("Adding i18n keys...")
    add_keys(os.path.join(base, "en.json"), KEYS_EN)
    add_keys(os.path.join(base, "ja.json"), KEYS_JA)
    add_keys(os.path.join(base, "pt.json"), KEYS_PT)

    print("\nVerifying...")
    ok = True
    ok = verify(os.path.join(base, "en.json"), KEYS_EN) and ok
    ok = verify(os.path.join(base, "ja.json"), KEYS_JA) and ok
    ok = verify(os.path.join(base, "pt.json"), KEYS_PT) and ok

    if ok:
        print("\nAll keys added and verified successfully.")
    else:
        print("\nSome keys failed verification!", file=sys.stderr)
        sys.exit(1)
