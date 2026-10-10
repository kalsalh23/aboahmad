import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '../utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const variants: Record<Variant, string> = {
  primary: 'bg-[#428177] text-white hover:bg-[#054239] active:bg-[#002623] border border-[#3a756c]',
  secondary: 'bg-[#edebe0] text-[#002623] hover:bg-[#d8d4c4] active:bg-[#b9a779] border border-[#ded9c7]',
  danger: 'bg-[#6b1f2a] text-white hover:bg-[#4a151e] border border-[#5a1a23]',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 border border-transparent',
}

const inputSizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-3.5 text-base',
  lg: 'h-14 px-4 text-lg',
  xl: 'h-16 px-4 text-xl',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  xl: 'h-14 px-7 text-lg gap-3',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, block = false, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[#428177] focus:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          sizes[size],
          block && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
  icon?: ReactNode
  inputSize?: Size
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, className, id, inputSize = 'md', ...props }, ref) => {
    const inputId = id ?? props.name ?? label
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-gray-800">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400" aria-hidden>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors',
              'placeholder:text-gray-400 focus:outline-none focus:ring-2',
              icon && 'pr-10',
              error
                ? 'border-[#6b1f2a] focus:border-[#6b1f2a] focus:ring-[#6b1f2a]/20'
                : 'border-gray-300 focus:border-[#428177] focus:ring-[#428177]/20',
              inputSizes[inputSize],
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 flex items-center gap-1 text-sm font-medium text-[#6b1f2a]">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-gray-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string | null
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const inputId = id ?? props.name ?? label
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2',
            error
              ? 'border-[#6b1f2a] focus:border-[#6b1f2a] focus:ring-[#6b1f2a]/20'
              : 'border-gray-300 focus:border-[#428177] focus:ring-[#428177]/20',
            className
          )}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-[#6b1f2a]">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
        {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string | null
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? props.name ?? label
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-lg border bg-white px-3 py-2 pl-8 text-sm text-gray-900 shadow-sm transition-colors',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-[#6b1f2a] focus:border-[#6b1f2a] focus:ring-[#6b1f2a]/20'
              : 'border-gray-300 focus:border-[#428177] focus:ring-[#428177]/20',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
          ▾
        </span>
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-[#6b1f2a]">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
        {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

export function Checkbox({ label, description, className, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const boxId = id ?? label
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <input
        id={boxId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#428177] focus:ring-[#428177]"
        {...props}
      />
      <div className="leading-none">
        <label htmlFor={boxId} className="text-sm font-medium text-gray-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-[#e6f0ec] text-[#054239] border-[#bcd9d1]',
    warning: 'bg-[#f4efe1] text-[#6d5836] border-[#e0d3b2]',
    danger: 'bg-[#f7e7e9] text-[#6b1f2a] border-[#e8c3c8]',
    info: 'bg-[#e9f1ed] text-[#054239] border-[#c9dcd5]',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]', className)}>{children}</div>
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400" aria-hidden>
        ∅
      </div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {description && <p className="max-w-sm text-xs text-gray-500">{description}</p>}
      {action}
    </div>
  )
}

export function Spinner({ label = 'جارٍ التحميل...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-gray-500', className)} role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-[#428177]" aria-hidden />
      <p className="text-xs">{label}</p>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onDismiss?: () => void
}) {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className={cn('relative z-10 w-full rounded-xl border border-gray-200 bg-white shadow-xl', widths[size])}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex justify-start gap-2 border-t border-gray-200 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string; children?: ReactNode }) {
  const styles = {
    info: 'bg-[#eef3f1] border-[#bcd3cb] text-[#054239]',
    success: 'bg-[#eaf4ef] border-[#b7d6c6] text-[#054239]',
    warning: 'bg-[#faf5e8] border-[#e4d8b4] text-[#6d5836]',
    danger: 'bg-[#faebec] border-[#e6bfc4] text-[#6b1f2a]',
  }
  return (
    <div className={cn('rounded-lg border px-3 py-2.5 text-sm', styles[tone])} role="status">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  )
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyTitle,
  emptyDescription,
  onRowClick,
  keyOf,
}: {
  columns: { key: string; label: string; render?: (row: T) => ReactNode; className?: string; sortable?: boolean; onSort?: () => void; sortDir?: 'asc' | 'desc' }[]
  rows: T[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  keyOf: (row: T) => string
}) {
  if (loading) return <Spinner />
  if (!rows.length) return <EmptyState title={emptyTitle ?? 'لا توجد بيانات'} description={emptyDescription} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-right text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-[#f7f6f1]">
            {columns.map((col) => (
              <th key={col.key} scope="col" className={cn('whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600', col.className)}>
                {col.sortable ? (
                  <button type="button" onClick={col.onSort} className="inline-flex items-center gap-1 hover:text-gray-900">
                    {col.label}
                    <span aria-hidden className="text-[10px]">{col.sortDir === 'asc' ? '▲' : col.sortDir === 'desc' ? '▼' : '↕'}</span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-b border-gray-100 last:border-0', onRowClick && 'cursor-pointer hover:bg-gray-50')}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-3 py-2.5 align-middle text-gray-800', col.className)}>
                  {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Toast({ message, tone = 'success', onDone }: { message: string; tone?: 'success' | 'error'; onDone?: () => void }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'fixed bottom-5 left-5 z-[60] flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
        tone === 'success' ? 'border-[#b9a779] bg-[#054239] text-white' : 'border-[#6b1f2a] bg-[#4a151e] text-white'
      )}
    >
      <span aria-hidden>{tone === 'success' ? '✓' : '⚠'}</span>
      <span>{message}</span>
      {onDone && (
        <button onClick={onDone} className="ms-2 rounded p-0.5 text-white/70 hover:text-white" aria-label="إغلاق">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#002623]">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}