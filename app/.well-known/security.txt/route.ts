/**
 * /.well-known/security.txt — RFC 9116 compliant security contact endpoint.
 *
 * Provides security researchers with a standardized way to report
 * vulnerabilities. This is a best practice recommended by IETF and
 * recognized by bug bounty platforms.
 *
 * @see https://securitytxt.org/
 * @see https://www.rfc-editor.org/rfc/rfc9116
 */

import { NextResponse } from "next/server";

const CONTACT_EMAIL = "307239t777@gmail.com";
const EXPIRES = "2027-04-20T00:00:00.000Z";
const CANONICAL = "https://bjj-app.net/.well-known/security.txt";

const SECURITY_TXT = `# Security Policy for BJJ App (https://bjj-app.net)
# RFC 9116 — https://www.rfc-editor.org/rfc/rfc9116

Contact: mailto:${CONTACT_EMAIL}
Expires: ${EXPIRES}
Preferred-Languages: ja, en, pt
Canonical: ${CANONICAL}
Policy: https://bjj-app.net/privacy

# Thank you for helping keep BJJ App safe.
`;

export function GET() {
  return new NextResponse(SECURITY_TXT, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
