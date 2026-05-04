#!/usr/bin/env python3
"""
translate_legal_pages.py — z255d: privacy/terms 法的文書を Gemini で 3 言語化

【発見】MCP UI 巡回で /privacy と /terms が完全英語、JA/PT locale でも切替なし。
GDPR Art 12 (concise/clear/intelligible) や日本個人情報保護法的に問題。

【方針】
- EN を canonical とし、JA / PT は同義訳。法的に厳密でない箇所は意訳 OK
- TOC / sections / paragraphs を block 単位で翻訳
- 出力: messages/en.json, ja.json, pt.json に "privacy.*" / "terms.*" key 追加
- 既存 EN content から自動抽出 (1 source of truth)
"""
from __future__ import annotations
import os
import json
import sys
import re
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# 翻訳対象 string (EN canonical)
PRIVACY_STRINGS = {
    "title": "Privacy Policy",
    "lastUpdated": "Last updated: April 2026",
    "back": "← Back to BJJ App",
    "tocLabel": "Contents",
    "toc": {
        "collect": "1. Information We Collect",
        "use": "2. How We Use Your Information",
        "storage": "3. Data Storage",
        "thirdParty": "4. Third-Party Services",
        "cookies": "5. Cookies & Tracking",
        "sharing": "6. Data Sharing",
        "rights": "7. Your Rights",
        "portability": "8. Data Portability",
        "retention": "9. Data Retention",
        "children": "10. Children's Privacy",
        "securityIncident": "11. Security Incident Notification",
        "ccpa": "12. California Privacy Rights (CCPA)",
        "changes": "13. Changes to This Policy",
        "contact": "14. Contact",
    },
    "collect": {
        "intro": "We collect the following information when you use BJJ App:",
        "accountTitle": "Account information",
        "accountDesc": "— email address and display name provided by your OAuth provider (Google / GitHub) or directly by you",
        "trainingTitle": "Training data",
        "trainingDesc": "— session logs, technique records, streak data, goals, and notes you enter in the app",
        "profileTitle": "Profile data",
        "profileDesc": "— belt rank, gym name, BJJ start date, and any other profile fields you choose to fill in",
        "usageTitle": "Usage data",
        "usageDesc": "— anonymous page-level analytics via Vercel Analytics (no personally identifiable information)",
    },
    "use": {
        "items": [
            "To provide and improve the Service",
            "To display your training data back to you in the dashboard",
            "To process subscription payments (via Stripe)",
            "To send product updates if you opt in to email notifications",
            "To analyze aggregate usage patterns and improve features",
        ],
    },
    "storage": "Your data is stored in Supabase (PostgreSQL), hosted on AWS. Data is encrypted at rest and in transit. Row-Level Security (RLS) ensures that each user can only access their own data.",
    "thirdParty": {
        "intro": "We use the following third-party services:",
        "supabase": "Supabase — database and authentication",
        "vercel": "Vercel — hosting and deployment",
        "stripe": "Stripe — payment processing (Pro subscriptions)",
        "analytics": "Vercel Analytics — anonymized page-level analytics",
        "outro": "Each of these services has its own privacy policy. We only share the minimum data necessary with each provider.",
    },
    "cookies": {
        "intro": "BJJ App uses a minimal set of cookies, organized into three categories:",
        "essentialTitle": "Essential",
        "essentialDesc": "— authentication session cookies (Supabase). These cannot be disabled and are required for the Service to function.",
        "analyticsTitle": "Analytics",
        "analyticsDesc": "— anonymized page-level usage data via Vercel Analytics. No personally identifiable information is collected. You may opt out via the cookie preferences banner.",
        "marketingTitle": "Marketing",
        "marketingDesc": "— currently not used. If we introduce marketing cookies in the future, they will require your explicit opt-in consent.",
        "outro": "You can manage your cookie preferences at any time by clearing your browser cookies for bjj-app.net, which will re-display the consent banner on your next visit. We do not use advertising cookies, tracking pixels, or fingerprinting techniques.",
    },
    "sharing": "We do not sell your personal data. We do not share your individual training data with third parties, except as required by law or to provide the Service through the processors listed above.",
    "rights": {
        "intro": "You have the right to:",
        "items": [
            "Access all data we hold about you (available via the dashboard export feature)",
            "Correct inaccurate data (editable in your profile)",
            "Delete your account and all associated data (Profile → Settings → Delete Account)",
            "Withdraw newsletter consent at any time via the unsubscribe link in any email",
            "Export your data in machine-readable format at any time (see Data Portability below)",
        ],
    },
    "portability": {
        "intro": "You own your training data. BJJ App supports free data export for all users — regardless of subscription tier — in the following machine-readable formats:",
        "csv": "CSV — training logs, technique records, streak history (compatible with Excel, Google Sheets, Numbers)",
        "pdf": "PDF — a printable summary report with statistics and charts",
        "outro": "Export is available from the dashboard at any time. Even if you cancel a Pro subscription or delete your account, you can download your full data set beforehand. This satisfies the data portability requirement under GDPR Article 20 and similar regulations.",
    },
    "retention": {
        "intro": "We retain your data for as long as your account is active. Specific retention periods by data category:",
        "tableHeader1": "Data Category",
        "tableHeader2": "While Active",
        "tableHeader3": "After Deletion",
        "row1Cat": "Training logs & techniques",
        "row1Active": "Retained indefinitely",
        "row1After": "Purged within 30 days",
        "row2Cat": "Profile & account data",
        "row2Active": "Retained indefinitely",
        "row2After": "Purged within 30 days",
        "row3Cat": "Payment records (Stripe)",
        "row3Active": "Retained per Stripe policy",
        "row3After": "Retained for tax/legal compliance (up to 7 years)",
        "row4Cat": "Push notification tokens",
        "row4Active": "Until unsubscribed or expired",
        "row4After": "Deleted immediately on account deletion",
        "row5Cat": "Analytics (Vercel)",
        "row5Active": "Anonymized, no PII",
        "row5After": "Not linked to individual accounts",
        "outro": "Upon account deletion, your data enters a 30-day soft-delete period during which you may request restoration. After this window, data is permanently removed from our primary database. Encrypted backups may retain data for an additional 30 days before automatic purge.",
    },
    "children": {
        "p1": "BJJ App is not directed at children under 13 (United States, per COPPA) or under 16 (European Economic Area, per GDPR). We do not knowingly collect personal information from individuals below these age thresholds.",
        "p2_a": "If you are a parent or guardian and believe your child has provided personal information to BJJ App without your consent, please contact us at",
        "p2_b": ". We will promptly verify the request and delete any data associated with the child's account within 48 hours.",
        "p3": "Minors between 13 and 16 (or the applicable age of digital consent in their jurisdiction) may use BJJ App only with verifiable parental or guardian consent.",
    },
    "securityIncident": {
        "intro": "In the event of a data breach that affects your personal information, we will:",
        "items": [
            "Notify affected users via email within 72 hours of confirmed discovery, as required by GDPR Article 33",
            "Describe the nature of the breach, the categories of data affected, and the approximate number of individuals impacted",
            "Outline the measures taken to contain and remediate the breach",
            "Provide guidance on steps you can take to protect yourself",
        ],
        "outro": "We also maintain appropriate technical and organizational security measures — including encryption at rest and in transit, Row-Level Security, and regular access reviews — to minimize the risk and impact of security incidents.",
    },
    "ccpa": {
        "intro": "If you are a California resident, the California Consumer Privacy Act (CCPA) grants you additional rights regarding your personal information:",
        "knowTitle": "Right to Know",
        "knowDesc": "— you may request the categories and specific pieces of personal information we have collected about you",
        "deleteTitle": "Right to Delete",
        "deleteDesc": "— you may request deletion of your personal information (available via Profile → Settings → Delete Account)",
        "optOutTitle": "Right to Opt-Out of Sale",
        "optOutDesc": "— BJJ App does not sell, rent, or trade your personal information to third parties for monetary or other valuable consideration. Therefore, there is no need to opt out",
        "nonDiscTitle": "Right to Non-Discrimination",
        "nonDiscDesc": "— we will not discriminate against you for exercising any of your CCPA rights",
        "outro_a": "To exercise any of these rights, contact us at",
        "outro_b": ". We will verify your identity and respond within 45 days as required by the CCPA.",
    },
    "changes": "We may update this Privacy Policy from time to time. We will notify users of significant changes via an in-app notice. Continued use of the Service constitutes acceptance of the updated policy.",
    "contact_a": "For privacy-related inquiries or data deletion requests, please contact us at",
    "contact_b": ".",
    "footerTerms": "Terms of Service",
    "footerDpa": "Data Processing Agreement",
    "footerTokushoho": "Specified Commercial Transactions Act",
    "footerHome": "← Home",
}


def import_gemini():
    try:
        import google.generativeai as genai
        return genai
    except ImportError:
        print("❌ google-generativeai 未 install")
        sys.exit(1)


def load_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        return key
    for p in [REPO_ROOT.parent / "bjj-wiki" / ".env", Path.home() / ".secrets",
              Path.home() / "Claude" / "bjj-wiki" / ".env"]:
        if p.exists():
            for line in p.read_text().splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def translate_batch(genai, en_content: dict, target_lang: str) -> dict:
    """Translate the entire content dict at once."""
    api_key = load_api_key()
    if not api_key:
        print("❌ GEMINI_API_KEY not found")
        sys.exit(1)
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    lang_label = {"ja": "Japanese (formal/keigo, business/legal style)", "pt": "Brazilian Portuguese (PT-BR, formal/legal style)"}[target_lang]

    prompt = f"""You are a professional legal translator. Translate the following privacy policy content from English to {lang_label}.

CRITICAL RULES:
- Preserve EXACT JSON structure and all keys (do NOT add/remove keys)
- Keep technical terms accurately (GDPR, CCPA, COPPA, RLS, OAuth, PostgreSQL, AWS, Supabase, Stripe, Vercel, Pro)
- Email addresses (307239t777@gmail.com) MUST stay unchanged
- Currency notation, dates ("April 2026"), and numbers stay unchanged
- Maintain formal/legal tone appropriate for a privacy policy
- Em-dashes (—) and arrows (→) preserved as-is
- For Japanese: use 敬体 (です/ます) and proper legal vocabulary (個人情報、法令、開示請求 etc.)
- For Portuguese: use formal "você" and proper legal vocabulary (informações pessoais, legislação, etc.)

Input JSON:
{json.dumps(en_content, indent=2, ensure_ascii=False)}

Output ONLY the translated JSON object (no markdown code fences, no commentary). Same shape as input.
"""
    resp = model.generate_content(prompt)
    text = resp.text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error for {target_lang}: {e}")
        print(f"Raw text (first 500): {text[:500]}")
        sys.exit(1)


def update_messages_json(privacy_translations: dict[str, dict]):
    """Add privacy.* keys to en.json, ja.json, pt.json"""
    for lang, content in privacy_translations.items():
        fp = REPO_ROOT / "messages" / f"{lang}.json"
        data = json.load(open(fp, encoding="utf-8"))
        data["privacy"] = content
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  ✅ messages/{lang}.json updated (privacy.* key)")


# Terms of Service strings (EN canonical)
TERMS_STRINGS = {
    "title": "Terms of Service",
    "lastUpdated": "Last updated: April 2026",
    "back": "← Back to BJJ App",
    "tocLabel": "Contents",
    "toc": {
        "acceptance": "1. Acceptance of Terms",
        "description": "2. Description of Service",
        "accounts": "3. User Accounts",
        "content": "4. User Content",
        "subscription": "5. Paid Subscription (Pro)",
        "conduct": "6. Prohibited Conduct",
        "disclaimers": "7. Disclaimers",
        "liability": "8. Limitation of Liability",
        "deletion": "9. Account Deletion",
        "changes": "10. Changes to Terms",
        "contact": "11. Contact",
        "governing": "12. Governing Law",
    },
    "acceptance": 'By accessing or using BJJ App ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.',
    "description": "BJJ App is a Brazilian Jiu-Jitsu training tracker that allows users to log training sessions, track techniques, monitor streaks, and visualize their progress. A free tier and a paid Pro tier are available.",
    "accounts": {
        "p1": "You may sign in using a third-party provider (Google, GitHub) or a magic-link email. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.",
        "p2": "You must be at least 13 years old to use this Service. By using BJJ App you represent that you meet this requirement. If you are between 13 and 17 years old, you must have the consent of a parent or legal guardian to use this Service. Your parent or guardian agrees to be bound by these Terms on your behalf.",
    },
    "content": "You retain ownership of any training data, notes, and content you submit. By submitting content you grant BJJ App a limited license to store and display it solely to provide the Service. We will not sell your personal training data to third parties.",
    "subscription": {
        "p1": "Pro features are available for a monthly subscription fee (USD $9.99/month or $79.99/year, tax inclusive). Payments are processed securely through Stripe (Visa, Mastercard, American Express, JCB).",
        "p2": "Subscriptions renew automatically on the same date each month. To cancel, go to your account settings at least 24 hours before the next billing date. Cancellation takes effect at the end of the current billing period. No partial-month refunds are provided.",
        "p3_a": "Refund requests are accepted within 7 days of the initial charge only. To request a refund, email",
        "p3_b": " with your account email address. No refund is available for subsequent monthly renewals.",
        "p4": "We reserve the right to change pricing with 30 days' advance notice. Price changes do not apply to the current billing period.",
    },
    "conduct": {
        "intro": "You agree not to:",
        "items": [
            "Use the Service for any unlawful purpose",
            "Attempt to gain unauthorized access to any part of the Service",
            "Reverse-engineer or scrape the Service at scale",
            "Upload malicious code or interfere with the Service's integrity",
        ],
    },
    "disclaimers": 'The Service is provided "as is" without warranties of any kind. BJJ App is a training log and informational tool — it is not a substitute for qualified instruction. Brazilian Jiu-Jitsu is a contact sport that carries inherent risks of physical injury. BJJ App is not responsible for any injury, harm, or loss resulting from training activities, whether or not such activities were logged or referenced in the Service. Certain techniques (including but not limited to heel hooks, kneebars, and neck cranks) carry a particularly high risk of serious injury. Always train under qualified supervision and consult a medical professional before beginning any physical training program.',
    "liability": "To the maximum extent permitted by law, BJJ App shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.",
    "deletion": "You may delete your account at any time from the Profile page. Upon deletion, your training data will be permanently removed from our servers within 30 days.",
    "changes": "We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the new terms. Significant changes will be announced in the app.",
    "contact_a": "For any questions about these Terms, please contact us at",
    "contact_b": ".",
    "governing": "These Terms are governed by the laws of Japan. Any disputes arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the Tokyo District Court.",
    "footerPrivacy": "Privacy Policy",
    "footerTokushoho": "Specified Commercial Transactions Act",
    "footerHome": "← Home",
}


# DPA strings (EN canonical)
DPA_STRINGS = {
    "title": "Data Processing Agreement (DPA)",
    "subtitle": "Summary pursuant to GDPR Article 28 — Last updated: April 2026",
    "back": "← Back to BJJ App",
    "section1": {
        "title": "1. Parties",
        "controllerLabel": "Controller:",
        "controllerDesc": "You, the user of BJJ App, who determines the purposes and means of processing personal data.",
        "processorLabel": "Processor:",
        "processorDesc": "Toshiki Terasawa (sole proprietor), operating BJJ App at bjj-app.net.",
    },
    "section2": {
        "title": "2. Scope of Processing",
        "intro": "We process personal data solely to provide the BJJ App training tracker service. Categories of data processed include:",
        "item1": "Account data (email, display name, avatar URL)",
        "item2": "Training data (session logs, technique notes, competition records)",
        "item3": "Body data (weight entries, injury records)",
        "item4": "Usage data (push notification tokens, cookie preferences)",
    },
    "section3": {
        "title": "3. Sub-processors",
        "intro": "We use the following sub-processors:",
        "headerService": "Service",
        "headerPurpose": "Purpose",
        "headerLocation": "Location",
        "supabasePurpose": "Database, Auth, Storage",
        "supabaseLocation": "US (ap-northeast-1)",
        "vercelPurpose": "Hosting, Edge Functions",
        "vercelLocation": "Global CDN",
        "stripePurpose": "Payment processing",
        "stripeLocation": "US/EU",
        "sentryPurpose": "Error tracking",
        "sentryLocation": "US",
        "resendPurpose": "Transactional email",
        "resendLocation": "US",
        "openaiPurpose": "AI Coach (Pro only)",
        "openaiLocation": "US",
    },
    "section4": {
        "title": "4. Data Security Measures",
        "item1": "All data encrypted in transit (TLS 1.3) and at rest (AES-256)",
        "item2": "Row-Level Security (RLS) on all database tables",
        "item3": "Rate limiting on all API endpoints",
        "item4": "CSRF protection via SameSite cookies",
        "item5": "Security headers: CSP, HSTS, X-Frame-Options, Permissions-Policy",
        "item6": "Automated vulnerability scanning (npm audit, Dependabot)",
    },
    "section5": {
        "title": "5. Data Subject Rights",
        "intro": "We support your exercise of data subject rights under GDPR Articles 15–22:",
        "accessLabel": "Access & Portability:",
        "accessDesc": "Export all your data via CSV or PDF at any time (free)",
        "erasureLabel": "Erasure:",
        "erasureDesc": "Delete your account from Profile → Account. 30-day recovery period, then permanent deletion.",
        "rectifyLabel": "Rectification:",
        "rectifyDesc": "Edit any personal data directly in the app",
        "restrictLabel": "Restriction:",
        "restrictDesc": "Contact us to restrict processing",
    },
    "section6": {
        "title": "6. Data Retention",
        "intro_a": "See our",
        "linkLabel": "Privacy Policy §9",
        "intro_b": "for detailed retention periods by data category.",
    },
    "section7": {
        "title": "7. Breach Notification",
        "intro_a": "In the event of a personal data breach, we will notify the relevant supervisory authority within 72 hours (GDPR Art. 33) and affected data subjects without undue delay. See",
        "linkLabel": "Privacy Policy §11",
        "intro_b": "for our full incident response policy.",
    },
    "section8": {
        "title": "8. Contact",
        "intro": "For DPA inquiries, data subject requests, or to request a signed copy of our full DPA:",
    },
    "footerPrivacy": "Privacy Policy",
    "footerTerms": "Terms of Service",
    "footerTokushoho": "Specified Commercial Transactions Act",
}


# Tokushoho strings (EN canonical) — bilingual labels (JA in parens) preserved
TOKUSHOHO_STRINGS = {
    "title": "Specified Commercial Transactions Act",
    "subtitle": "(Disclosure pursuant to Article 11 of the Act on Specified Commercial Transactions)",
    "lastUpdated": "Last updated: March 2026",
    "labels": {
        "seller": "Seller (販売業者)",
        "personInCharge": "Person in Charge (販売責任者)",
        "address": "Address (所在地)",
        "phone": "Phone (電話番号)",
        "email": "Email (メールアドレス)",
        "product": "Product / Service (商品・サービス)",
        "price": "Price (販売価格)",
        "feesOther": "Fees Other Than Price (商品代金以外の必要料金)",
        "paymentMethod": "Payment Method (お支払い方法)",
        "paymentTiming": "Payment Timing (お支払い時期)",
        "serviceDelivery": "Service Delivery (サービス提供時期)",
        "cancellation": "Cancellation / Refund Policy (解約・返金について)",
        "autoRenewal": "Auto-Renewal (自動更新について)",
        "howSubscribe": "How to Subscribe (申込方法)",
        "contractDate": "Contract Effective Date (契約成立時期)",
        "systemReq": "System Requirements (動作環境)",
    },
    "values": {
        "sellerVal": "Toshiki Terasawa (寺澤としき) — Sole Proprietor",
        "personInChargeVal": "Toshiki Terasawa (寺澤としき)",
        "addressVal": "Disclosed without delay upon request. Please contact 307239t777@gmail.com",
        "addressNote": "個人事業主のため、請求があった場合に遅滞なく開示いたします。",
        "phoneVal": "Disclosed without delay upon request. Please contact 307239t777@gmail.com",
        "phoneNote": "個人事業主のため、請求があった場合に遅滞なく開示いたします。",
        "product1": "BJJ App Pro — Monthly subscription for advanced training analytics",
        "product2": "BJJ App Gym Starter — Monthly subscription for academy management (up to 50 students)",
        "product3": "BJJ App Gym Pro — Monthly subscription for academy management (unlimited students)",
        "price1": "Pro: USD $9.99/month or $79.99/year (tax inclusive)",
        "price2": "Gym Pro: USD $99/month (tax inclusive)",
        "priceNote": "Prices are in US Dollars. Foreign exchange rates may apply for JPY charges.",
        "feesOtherVal": "Internet connection fee and device costs are borne by the user. No additional fees are charged by BJJ App.",
        "paymentMethodVal": "Credit card via Stripe (Visa, Mastercard, American Express, JCB, Diners Club)",
        "paymentTimingVal": "First charge upon subscription signup. Subsequent charges on the same date each month (auto-renewal).",
        "serviceDeliveryVal": "Immediately upon completion of payment. Pro features become accessible within your account.",
        "cancellation1": "Cancellation: You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period.",
        "cancellation2": "Refund: Refund requests are accepted within 7 days of the initial charge only. Contact 307239t777@gmail.com with your account email.",
        "cancellation3": "No refund is available for subsequent monthly charges after the initial 7-day window.",
        "cancellation4": "No partial-month refunds are provided upon cancellation.",
        "autoRenewalVal": "Subscriptions are automatically renewed each month. To avoid the next charge, cancel at least 24 hours before your next billing date.",
        "howSubscribeVal": "Create an account at https://bjj-app.net/login, then upgrade to Pro from the dashboard.",
        "contractDateVal": "The contract is established when payment is confirmed by the payment processor (Stripe).",
        "systemReqVal": "Modern web browser (Chrome, Safari, Firefox, Edge). Internet connection required.",
    },
    "footerTerms": "Terms of Service",
    "footerPrivacy": "Privacy Policy",
    "footerHome": "Home",
}


def update_messages_json_for_section(section_key: str, translations: dict[str, dict]):
    """Add <section_key>.* keys to en.json, ja.json, pt.json"""
    for lang, content in translations.items():
        fp = REPO_ROOT / "messages" / f"{lang}.json"
        data = json.load(open(fp, encoding="utf-8"))
        data[section_key] = content
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  ✅ messages/{lang}.json updated ({section_key}.* key)")


def main() -> int:
    genai = import_gemini()

    sections = {
        "privacy": PRIVACY_STRINGS,
        "terms": TERMS_STRINGS,
        "dpa": DPA_STRINGS,
        "tokushoho": TOKUSHOHO_STRINGS,
    }

    for section_key, en_content in sections.items():
        print(f"📋 翻訳開始: {section_key} (EN canonical → JA / PT)")
        print()
        translations = {"en": en_content}

        print(f"→ JA 翻訳中... (~30 sec)")
        translations["ja"] = translate_batch(genai, en_content, "ja")
        print(f"  ✅ JA 完了 ({len(json.dumps(translations['ja']))} chars)")
        time.sleep(1)

        print(f"→ PT 翻訳中... (~30 sec)")
        translations["pt"] = translate_batch(genai, en_content, "pt")
        print(f"  ✅ PT 完了 ({len(json.dumps(translations['pt']))} chars)")

        print()
        print(f"📝 messages/*.json 更新 ({section_key})...")
        update_messages_json_for_section(section_key, translations)
        print()

    print("✅ 全翻訳完了 (privacy + terms)。page.tsx を t() 化すれば反映される。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
