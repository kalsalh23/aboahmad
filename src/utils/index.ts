const AR = 'ar-u-ca-gregory-nu-latn'

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat(AR).format(num)
}

export const formatDate = (date: string | Date): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat(AR, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d)
}

export const formatDateLong = (date: string | Date): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat(AR, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat(AR, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export const formatTime = (date: string | Date): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat(AR, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat(AR, {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(amount)
}

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

export const getInitials = (name?: string): string => {
  if (!name) return ''
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export const cn = (...classes: unknown[]): string => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const getErrorMessage = (error: any): string => {
  if (error?.message) return error.message
  if (typeof error === 'string') return error
  if (error?.error?.message) return error.error.message
  return 'حدث خطأ غير معروف'
}

export const isRtl = (): boolean => true

export const formatQuantity = (quantity: number, unit?: string): string => {
  const formatted = formatNumber(quantity)
  return unit ? `${formatted} ${unit}` : formatted
}