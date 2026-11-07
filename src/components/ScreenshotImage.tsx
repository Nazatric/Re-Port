import { useState } from 'react';
import { proxied } from '../lib/images';

/** Use the original for the full-screen viewer; thumbnails fall back to it if the CDN fails. */
export function ScreenshotImage({ src, alt, full = false, className, onFailure }: { src: string; alt: string; full?: boolean; className?: string; onFailure?: () => void }) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const proxy = proxied(src, full ? 1920 : 800, 90);
  const current = full ? (fallback ? proxy : src) : (fallback ? src : proxy);
  if (failed) return <span className="text-sm text-white/75">Image unavailable</span>;
  return (
    <img
      src={current}
      alt={alt}
      loading={full ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (!fallback) setFallback(true);
        else { setFailed(true); onFailure?.(); }
      }}
    />
  );
}
