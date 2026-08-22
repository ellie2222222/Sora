import React from 'react'

/**
 * Shimmering placeholder. Skeletons stand in for content whose shape is already
 * known, so a page keeps its layout while loading instead of collapsing to a
 * centred spinner. Use `LoadingState` only where the shape is unknown.
 */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`}
    {...props}
  />
)

export interface SkeletonListProps {
  /** Number of placeholder rows; match the page's usual page size. */
  rows?: number
  /** Renders a trailing value column, as in balances and amounts. */
  withValue?: boolean
  id?: string
}

/** Row-per-record placeholder for the list pages (accounts, transactions, categories). */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  rows = 5,
  withValue = true,
  id = 'skeleton-list',
}) => (
  <ul id={id} role="status" aria-busy="true" className="divide-y divide-gray-100 dark:divide-gray-800">
    {Array.from({ length: rows }).map((_, index) => (
      <li key={index} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        {withValue && (
          <div className="shrink-0 space-y-2 text-right">
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        )}
      </li>
    ))}
  </ul>
)

export interface SkeletonCardsProps {
  /** Number of placeholder cards. */
  count?: number
  className?: string
  id?: string
}

/** Card-grid placeholder for metric tiles and workspace cards. */
export const SkeletonCards: React.FC<SkeletonCardsProps> = ({
  count = 3,
  className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3',
  id = 'skeleton-cards',
}) => (
  <div id={id} role="status" aria-busy="true" className={className}>
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-slate-900"
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    ))}
  </div>
)
