"use client";

interface AvatarImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * AvatarImage — client component wrapper for avatar <img> with onError fallback.
 * Hides the image if it fails to load (broken avatar URL).
 * Must be a client component because onError is an event handler.
 */
export default function AvatarImage({ src, alt, className }: AvatarImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
