// Shared loading skeletons. All variants use the `.skeleton` shimmer utility
// (globals.css) so the whole app speaks one "loading" language, and each
// variant reserves space close to its loaded layout to avoid shift.

/** Generic shimmer block — size it with className (h-*, w-*, rounded-*). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton h-3 rounded ${className}`} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden className="rounded-card glass-1 p-4 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={`${i === 0 ? "w-1/3" : i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}
