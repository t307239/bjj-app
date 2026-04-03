/**
 * template.tsx — Page transition wrapper
 * Unlike layout.tsx, template.tsx re-mounts on every navigation,
 * enabling CSS fade-in animation on each page change.
 * #38: ネイティブアプリ風ページ遷移アニメーション
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-in">
      {children}
    </div>
  );
}
