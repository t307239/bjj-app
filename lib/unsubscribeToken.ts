/**
 * unsubscribeToken — z187: HMAC-signed token for 1-click email unsubscribe.
 *
 * 【設計】
 *   - GET /api/unsubscribe?token=<base64url> で no-auth 解除可能 (email クライアント
 *     からの 1-click を実現するため)
 *   - URL guess / brute-force を防ぐため HMAC-SHA256 署名
 *   - Token 構造: base64url(payload) + "." + base64url(hmac)
 *   - payload: JSON {uid, exp} where exp = unix seconds (1 year TTL)
 *
 * 【Security】
 *   - secret は process.env.UNSUBSCRIBE_SECRET (なければ CRON_SECRET fallback)
 *   - 両方 unset なら fail-closed (z169 cronAuth と同型)
 *   - HMAC compare は constant-time (timingSafeEqual)
 *   - exp 過ぎたら invalid (1 年)
 *
 * 【Use case】
 *   z177 (gym-outreach), z186 (onboarding-email) の email footer に
 *   `https://bjj-app.net/api/unsubscribe?token=...` を埋める。
 */
import crypto from "node:crypto";

const TOKEN_TTL_SEC = 365 * 24 * 60 * 60; // 1 year

interface TokenPayload {
  uid: string;
  exp: number; // unix seconds
}

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!s) {
    throw new Error("UNSUBSCRIBE_SECRET (or CRON_SECRET) env var not set");
  }
  return s;
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function signUnsubscribeToken(userId: string): string {
  const secret = getSecret();
  const payload: TokenPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export interface VerifyResult {
  ok: boolean;
  userId?: string;
  reason?: string;
}

export function verifyUnsubscribeToken(token: string | null | undefined): VerifyResult {
  if (!token) return { ok: false, reason: "missing_token" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "server_misconfigured" };
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  let actualSig: Buffer;
  try {
    actualSig = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "malformed_sig" };
  }
  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return { ok: false, reason: "invalid_sig" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf-8")) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed_payload" };
  }
  if (typeof payload.uid !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid_payload_shape" };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, userId: payload.uid };
}
