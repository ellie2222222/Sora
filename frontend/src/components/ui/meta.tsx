import React from 'react'

/**
 * Secondary detail on a list row.
 *
 * A row's supporting fields — date, account, institution, note — used to be one
 * grey string joined by `·`, which made every field look alike: you could not
 * tell the account from the category from the note. Each field now carries its
 * own icon and its own `title`, so its identity is visible without a text label
 * eating the row's width.
 */
export interface MetaItemProps {
  /** Lucide icon at 12px (FE-05). */
  icon: React.ReactNode
  /** Field name, e.g. "Account" — surfaced on hover and to screen readers. */
  label: string
  children: React.ReactNode
  className?: string
}

export function MetaItem({ icon, label, children, className }: MetaItemProps) {
  return (
    <span
      title={label}
      className={`inline-flex min-w-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ${
        className || ''
      }`}
    >
      <span aria-hidden="true" className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Wrapping row of MetaItems and Badges. */
export function MetaRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${className || ''}`}>
      {children}
    </div>
  )
}
