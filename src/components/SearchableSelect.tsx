import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { cn } from '../utils'

export interface Option {
  value: string
  label: string
}

export function SearchableSelect({
  label,
  placeholder = 'اختر من القائمة',
  options,
  value,
  onChange,
  disabled,
  hint,
  error,
  allowFreeText = false,
  freeTextLabel = 'إضافة جديد',
  onFreeText,
  className,
  name,
}: {
  label?: string
  placeholder?: string
  options: Option[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  hint?: string
  error?: string | null
  allowFreeText?: boolean
  freeTextLabel?: string
  onFreeText?: () => void
  className?: string
  name?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const term = search.trim()
    if (!term) return options
    return options.filter((o) => o.label.includes(term) || o.value.toLowerCase().includes(term.toLowerCase()))
  }, [options, search])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    setActive(0)
  }, [search, open])

  const selected = options.find((o) => o.value === value)
  const listId = `ss-${(name ?? label ?? 'select').replace(/\s+/g, '-')}`

  const pick = (opt: Option) => {
    onChange(opt.value)
    setOpen(false)
    setSearch('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        inputRef.current?.focus()
        return
      }
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered[active]) pick(filtered[active])
      else setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={cn('w-full', className)} ref={rootRef}>
      {label && (
        <label htmlFor={listId} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={listId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v)
            window.setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-right text-sm shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#428177]/20',
            disabled ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-300 text-gray-900',
            error && 'border-[#6b1f2a] ring-[#6b1f2a]/20',
            open && 'border-[#428177]'
          )}
        >
          <span className={cn('truncate', !selected && 'text-gray-400')}>{selected?.label ?? placeholder}</span>
          <span aria-hidden className="text-[10px] text-gray-400">▾</span>
        </button>

        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg" role="listbox">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="ابحث..."
                aria-label="بحث في القائمة"
                aria-controls={`${listId}-list`}
                className="w-full border-0 p-0 text-sm focus:outline-none focus:ring-0"
              />
            </div>
            <ul id={`${listId}-list`} className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-gray-400">لا توجد نتائج مطابقة</li>
              )}
              {filtered.map((opt, i) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(opt)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-right text-sm',
                      i === active ? 'bg-[#e9f1ed] text-[#054239]' : 'text-gray-700 hover:bg-gray-50',
                      opt.value === value && 'font-semibold'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && <span aria-hidden className="text-[#428177]">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
            {allowFreeText && (
              <div className="border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onFreeText?.()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#054239] hover:bg-[#f4f7f5]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {freeTextLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-[#6b1f2a]">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
      {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}