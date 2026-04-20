import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Deleted",
  robots: { index: false, follow: false },
};

export default function AccountDeletedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
