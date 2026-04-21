import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Deleted | BJJ App",
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
