/**
 * A pulsing placeholder block, used to sketch the shape of content that's
 * still loading (cards, list rows, text lines) instead of showing a bare
 * "Loading…" string. Respects prefers-reduced-motion via index.css.
 */
export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-sand/80 ${className}`} />;
}

/** A Card-shaped skeleton, matching common/Card's padding/border. */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-lg border border-sand bg-white p-5 shadow-sm ${className}`}>
      <Skeleton className="h-3.5 w-1/3" />
      <Skeleton className="mt-3 h-6 w-2/3" />
    </div>
  );
}

/** A row-shaped skeleton for list items (activity feed, group list, etc). */
export function SkeletonRow({ className = '' }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-sand bg-white px-5 py-4 shadow-sm ${className}`}
    >
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-14" />
    </div>
  );
}
