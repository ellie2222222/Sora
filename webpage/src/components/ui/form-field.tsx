import React from 'react'

interface FormFieldProps {
  label: string
  id: string
  error?: string
  children: React.ReactNode
}

export const FormField: React.FC<FormFieldProps> = ({ label, id, error, children }) => {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    const baseStyles = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-800'
    const errorStyles = error ? 'border-red-500' : 'border-gray-300'

    return (
      <input
        ref={ref}
        className={`${baseStyles} ${errorStyles} ${className || ''}`}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
