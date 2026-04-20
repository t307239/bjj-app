import { type ReactNode } from "react";

/**
 * Smooth expand/collapse wrapper using CSS Grid `grid-template-rows: 0fr → 1fr`.
 * Content slides open/closed with a 300ms ease-out transition.
 *
 * Usage:
 *   <AnimatedAccordion open={showDetails}>
 *     <div className="space-y-3">...</div>
 *   </AnimatedAccordion>
 */
export default function AnimatedAccordion({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${className}`}
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
