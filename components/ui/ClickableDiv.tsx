"use client";

/**
 * components/ui/ClickableDiv.tsx
 *
 * Accessible wrapper for clickable div elements.
 * Adds role="button", tabIndex, and keyboard support (Enter/Space).
 *
 * Usage:
 *   <ClickableDiv onClick={handleClick} aria-label="Open details">
 *     <Card content />
 *   </ClickableDiv>
 *
 * Replaces: <div onClick={handleClick}> (a11y violation)
 */

import { forwardRef, type HTMLAttributes, type KeyboardEvent } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  onClick: () => void;
  disabled?: boolean;
};

const ClickableDiv = forwardRef<HTMLDivElement, Props>(
  ({ onClick, disabled, children, className, ...rest }, ref) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
      // Forward to parent handler if exists
      rest.onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled || undefined}
        className={className}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

ClickableDiv.displayName = "ClickableDiv";

export default ClickableDiv;
