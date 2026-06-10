// robust/drive.ts — Google Drive フォルダの閲覧権限を自動付与/削除する。
//
// Why: 会員限定動画を Drive フォルダで配信し、動画ONの会員に自動共有、
//      動画OFF/退会/休会で自動剥奪する（手動運用の「剥奪忘れ」事故を撲滅）。
//      googleapis 依存を増やさず、サービスアカウントの JWT を自前署名して
//      OAuth トークンを取得し、Drive REST API を fetch で叩く（依存ゼロ）。
//
// 必要な環境変数（サーバー専用・client から参照禁止）:
//   GOOGLE_SERVICE_ACCOUNT_KEY … サービスアカウント JSON キー全文（1行 or 整形済）
//   ROBUST_DRIVE_FOLDER_ID      … 共有対象の Drive フォルダ ID
// 事前にそのサービスアカウント（client_email）をフォルダに「編集者」で共有しておくこと。
import crypto from "crypto";
import { robustLogger } from "./logger";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
// アクセストークンの安全マージン（実効 1h より早めに失効扱い）
const TOKEN_TTL_MS = 55 * 60 * 1000;

type ServiceAccount = { client_email: string; private_key: string };

let _cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    // env 経由だと改行が \\n にエスケープされることがあるため復元
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    // silent: ok — 不正な JSON は「未設定」として扱い、呼び出し側で skip
    return null;
  }
}

/** Drive 自動同期が設定済みか（env 2 種が揃っているか）。 */
export function isDriveConfigured(): boolean {
  return !!getServiceAccount() && !!process.env.ROBUST_DRIVE_FOLDER_ID;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now) return _cachedToken.token;

  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = base64url(
    crypto.createSign("RSA-SHA256").update(signingInput).sign(sa.private_key)
  );
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Drive token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  _cachedToken = { token: json.access_token, expiresAt: now + TOKEN_TTL_MS };
  return json.access_token;
}

/** フォルダ上で email が持つ permission ID を返す（無ければ null）。 */
async function findPermissionId(
  token: string,
  folderId: string,
  email: string
): Promise<string | null> {
  const url =
    `${DRIVE_API}/files/${folderId}/permissions` +
    `?fields=permissions(id,emailAddress)&supportsAllDrives=true&pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Drive permissions list failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    permissions?: { id: string; emailAddress?: string }[];
  };
  const target = email.trim().toLowerCase();
  const found = (json.permissions ?? []).find(
    (p) => (p.emailAddress ?? "").toLowerCase() === target
  );
  return found?.id ?? null;
}

/**
 * email に Drive フォルダの閲覧権限を付与/削除する。
 * grant=true で reader 付与（既にあれば skip）、false で削除（無ければ skip）。
 * env 未設定や email 不正は no-op（呼び出し側の DB 更新を止めない設計）。
 * @returns 同期を実行できたか（設定不足で skip した場合は false）
 */
export async function syncDriveAccess(email: string | null | undefined, grant: boolean): Promise<boolean> {
  const sa = getServiceAccount();
  const folderId = process.env.ROBUST_DRIVE_FOLDER_ID;
  if (!sa || !folderId) return false;
  const target = (email ?? "").trim();
  // 簡易メール検証（不正値で Drive API を無駄に叩かない）
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return false;

  try {
    const token = await getAccessToken(sa);
    const existingId = await findPermissionId(token, folderId, target);

    if (grant) {
      if (existingId) return true; // 冪等: 既に共有済み
      const res = await fetch(
        `${DRIVE_API}/files/${folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "reader", type: "user", emailAddress: target }),
        }
      );
      if (!res.ok) throw new Error(`Drive grant failed: ${res.status} ${await res.text()}`);
      robustLogger.info("robust.drive.granted", { email: target });
      return true;
    } else {
      if (!existingId) return true; // 冪等: 既に権限なし
      const res = await fetch(
        `${DRIVE_API}/files/${folderId}/permissions/${existingId}?supportsAllDrives=true`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok && res.status !== 404) {
        throw new Error(`Drive revoke failed: ${res.status} ${await res.text()}`);
      }
      robustLogger.info("robust.drive.revoked", { email: target });
      return true;
    }
  } catch (err) {
    // Drive 失敗は呼び出し側の DB 更新を止めない（管理画面のリストで手動フォロー可能）
    robustLogger.error("robust.drive.sync_failed", { email: target, grant }, err);
    return false;
  }
}
