import type { Metadata } from "next";

export const metadata: Metadata = {
  // layout.tsx の template "%s | BJJ App" が自動付与するので suffix 重複回避
  title: "Account Deleted",
  description: "Your BJJ App account has been deleted. You can restore it within 30 days.",
  robots: { index: false, follow: false },
};

export default function AccountDeletedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
