"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";

type Video = {
  id: string;
  title: string;
  description: string | null;
  drive_file_id: string;
  thumbnail_url: string | null;
  class_type: string | null;
  is_active: boolean;
  created_at: string;
};

const CLASS_LABEL: Record<string, string> = {
  beginner: "白帯クラス", basic: "基礎", regular: "通常",
  nogi: "ノーギ", private: "個別", other: "その他",
};

export default function AdminVideosPage() {
  const supabase = createRobustClient();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  // 追加フォーム
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addDriveId, setAddDriveId] = useState("");
  const [addClassType, setAddClassType] = useState("");
  const [addThumb, setAddThumb] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  // Drive フォルダ URL（会員へ一括共有するフォルダリンク）
  const [folderUrl, setFolderUrl] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderMsg, setFolderMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function fetchVideos() {
    const res = await fetch("/api/gym/robust/videos");
    if (!res.ok) {
      // Why: admin ページなので 401（未ログイン）も 403（権限なし）も
      //      ログインフォームを表示して管理者として再認証を促す
      if (res.status === 401 || res.status === 403) { setShowLogin(true); setLoading(false); return; }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "エラーが発生しました");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setVideos(json.videos);
    setLoading(false);
  }

  async function fetchSettings() {
    const res = await fetch("/api/gym/robust/settings");
    if (!res.ok) return; // 設定取得失敗は致命的でないため握りつぶす（動画一覧は表示する）
    const json = await res.json();
    setFolderUrl(json.drive_folder_url ?? "");
  }

  async function handleSaveFolder(e: React.FormEvent) {
    e.preventDefault();
    setFolderSaving(true);
    setFolderMsg(null);
    try {
      // 空入力は null として送信し、フォルダ未設定状態にできるようにする
      const trimmed = folderUrl.trim();
      const res = await fetch("/api/gym/robust/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drive_folder_url: trimmed === "" ? null : trimmed }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "保存に失敗しました");
      setFolderMsg({ text: "フォルダ URL を保存しました", ok: true });
    } catch (err) {
      setFolderMsg({ text: (err as Error).message, ok: false });
    } finally {
      setFolderSaving(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setShowLogin(true); setLoading(false); return; }
      await Promise.all([fetchVideos(), fetchSettings()]);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/gym/robust/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle,
          description: addDesc || undefined,
          drive_file_id: addDriveId,
          class_type: addClassType || null,
          thumbnail_url: addThumb || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "追加に失敗しました");
      setShowAdd(false);
      setAddTitle(""); setAddDesc(""); setAddDriveId(""); setAddClassType(""); setAddThumb("");
      setLoading(true);
      await fetchVideos();
    } catch (err) { setAddError((err as Error).message); }
    finally { setAddSubmitting(false); }
  }

  async function handleToggle(videoId: string, is_active: boolean) {
    const prev = videos;
    setVideos(v => v.map(x => x.id === videoId ? { ...x, is_active } : x));
    const res = await fetch("/api/gym/robust/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, is_active }),
    });
    if (!res.ok) setVideos(prev); // rollback
  }

  if (showLogin) {
    return <RobustAdminLoginForm onSuccess={() => { setShowLogin(false); setLoading(true); fetchVideos(); }} />;
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" /></div>;

  if (error) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"><p className="text-red-400 text-sm">{error}</p></div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">動画管理</h1>
            <p className="text-zinc-500 text-xs mt-0.5">ROBUST 柔術</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/gym/robust/admin" className="text-zinc-400 text-xs hover:text-white">← ダッシュボード</a>
            <button onClick={() => setShowAdd(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-4 py-2">
              + 動画を追加
            </button>
          </div>
        </div>

        {/* Drive フォルダ URL 設定（権限ある会員に一括共有するリンク） */}
        <form onSubmit={handleSaveFolder} className="bg-zinc-900 border border-white/10 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-white mb-1">共有 Drive フォルダ</h2>
          <p className="text-zinc-500 text-xs mb-3">
            動画閲覧オプションが有効な会員にこのフォルダリンクを表示します。Drive 側で「リンクを知っている全員（閲覧者）」に共有設定してください。
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="url" value={folderUrl} onChange={e => setFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            <button type="submit" disabled={folderSaving}
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 whitespace-nowrap">
              {folderSaving ? "保存中..." : "保存"}
            </button>
          </div>
          {folderMsg && (
            <p className={`text-xs mt-2 ${folderMsg.ok ? "text-emerald-400" : "text-red-400"}`} role="status">{folderMsg.text}</p>
          )}
        </form>

        {/* 追加フォーム */}
        {showAdd && (
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-bold text-white mb-4">動画を追加</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">タイトル <span className="text-red-400">*</span></label>
                <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} required
                  placeholder="例: ダブルレッグテイクダウン基礎"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Google Drive ファイル ID <span className="text-red-400">*</span>
                </label>
                <input type="text" value={addDriveId} onChange={e => setAddDriveId(e.target.value)} required
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                <p className="text-zinc-600 text-xs mt-1">Drive の共有 URL から取得: …/d/<strong>ここ</strong>/view</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">クラス種別</label>
                  <select value={addClassType} onChange={e => setAddClassType(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">未設定</option>
                    {Object.entries(CLASS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">サムネイル URL</label>
                  <input type="url" value={addThumb} onChange={e => setAddThumb(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">説明</label>
                <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} rows={2}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" />
              </div>
              {addError && <p className="text-red-400 text-xs">{addError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={addSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg py-2.5">
                  {addSubmitting ? "追加中..." : "追加する"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg py-2.5">
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 動画一覧 */}
        {videos.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">動画がありません</p>
            <p className="text-zinc-600 text-xs mt-1">上の「動画を追加」ボタンから Google Drive の動画を登録してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map(v => (
              <div key={v.id} className={`bg-zinc-900 border rounded-xl p-4 transition-opacity ${v.is_active ? "border-white/10" : "border-white/5 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium">{v.title}</p>
                      {v.class_type && (
                        <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                          {CLASS_LABEL[v.class_type] ?? v.class_type}
                        </span>
                      )}
                      {!v.is_active && <span className="text-xs bg-zinc-700 text-zinc-500 px-2 py-0.5 rounded">非公開</span>}
                    </div>
                    {v.description && <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{v.description}</p>}
                    <p className="text-zinc-600 text-xs mt-1 font-mono truncate">ID: {v.drive_file_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`https://drive.google.com/file/d/${v.drive_file_id}/view`} target="_blank" rel="noopener"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3"
                      aria-label={`${v.title}を開く`}>
                      開く
                    </a>
                    <button type="button" onClick={() => handleToggle(v.id, !v.is_active)}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center text-xs rounded-lg px-3 ${v.is_active ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                      aria-label={v.is_active ? `${v.title}を非公開にする` : `${v.title}を公開する`}>
                      {v.is_active ? "非公開" : "公開"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
