import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import ProfileTabs from "@/components/ProfileTabs";

export const metadata: Metadata = {
  title: "Profile | BJJ App",
  description: "Manage your BJJ profile — belt rank, gym, goals, and lifetime training stats.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "name": "BJJ App Profile",
  "description": "Manage your Brazilian Jiu-Jitsu training profile, belt rank, and goals",
  "url": "https://bjj-app.net/profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Athlete";
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  return (
    <div className="min-h-screen bg-[#0f172a] pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ユーザー情報 */}
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full border-2 border-white/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center text-white text-2xl font-bold">
              {displayName[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{displayName}</h2>
            <p className="text-gray-400 text-sm">{user.email}</p>
          </div>
        </div>
        {/* タブナビ */}
        <ProfileTabs userId={user.id} />
      </main>
    </div>
  );
}
