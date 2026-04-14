/**
 * IAB (In-App Browser) detection utility.
 * Instagram, Facebook, LINE, X/Twitter, TikTok, Snapchat, WeChat IABs
 * block cookie-based OAuth redirects. Detect early and prompt user to
 * open in system browser.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Named SNS apps with known IAB patterns
  if (/Instagram|FBAN|FBAV|Twitter|Line\/|TikTok|Snapchat|MicroMessenger|WeChat/i.test(ua)) return true;
  // iOS Reddit, Pinterest, etc.: WebKit process without Safari in UA
  if (/iPhone|iPad|iPod/i.test(ua) && /WebKit/i.test(ua) && !/Safari/i.test(ua)) return true;
  return false;
}
