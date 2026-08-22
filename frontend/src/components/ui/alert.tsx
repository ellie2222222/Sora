import React from 'react'
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react'

interface AlertProps {
  type: 'success' | 'error' | 'info' | 'warning'
  title?: string
  message: string
  onClose?: () => void
  className?: string
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  onClose,
  className = '',
}) => {
  const styleConfig = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-900 dark:text-green-200',
      icon: <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />,
      id: 'message-success',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-200',
      icon: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
      id: 'message-error',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-900 dark:text-yellow-200',
      icon: <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />,
      id: 'message-warning',
    },
    info: {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      border: 'border-gray-200 dark:border-gray-800',
      text: 'text-gray-900 dark:text-gray-200',
      icon: <Info className="h-5 w-5 text-gray-500 dark:text-gray-400" />,
      id: 'message-info',
    },
  }

  const config = styleConfig[type]

  return (
    <div
      id={config.id}
      className={`animate-fade-in flex gap-3 rounded-lg border ${config.bg} ${config.border} ${config.text} px-4 py-3 ${className}`}
    >
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1">
        {title && <h3 className="font-medium">{title}</h3>}
        <p className={title ? 'text-sm mt-1' : ''}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  )
}
