import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div
    className={`rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-slate-900 ${className}`}
    {...props}
  >
    {children}
  </div>
)

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  action?: React.ReactNode
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  action,
  className = '',
  ...props
}) => (
  <div
    className={`flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 ${className}`}
    {...props}
  >
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
    {action}
  </div>
)

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`px-5 py-4 ${className}`} {...props}>
    {children}
  </div>
)
