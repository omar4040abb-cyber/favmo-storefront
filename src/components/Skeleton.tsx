export function SkeletonBox({
  className = '',
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${dark ? 'favmo-skeleton-dark' : 'favmo-skeleton'} ${className}`.trim()}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBox className="aspect-[4/5] w-full" />
      <div className="space-y-2">
        <SkeletonBox className="h-4 w-3/4" />
        <SkeletonBox className="h-4 w-1/3" />
      </div>
    </div>
  );
}
