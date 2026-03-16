import { NextResponse } from "next/server";

export async function GET() {
  const content = `User-agent: *
Disallow: /dashboard
Disallow: /techniques
Disallow: /profile
Disallow: /auth
Allow: /

Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL || "https://bjj-app.vercel.app"}/sitemap.xml
`;
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain" },
  });
}
