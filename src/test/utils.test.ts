import { describe, it, expect } from 'vitest'
import { cn, formatNumber, formatQuantity, getInitials, truncate, getErrorMessage } from '../utils'

describe('utils', () => {
  it('formatNumber ينسق الأرقام بالأرقام العربية', () => {
    expect(formatNumber(1250)).toMatch(/١|,/)
    expect(typeof formatNumber(1)).toBe('string')
  })

  it('formatQuantity يضيف وحدة القياس عند توفّرها', () => {
    expect(formatQuantity(5, 'لتر')).toContain('لتر')
    expect(formatQuantity(5, 'لتر').length).toBeGreaterThan(1)
    expect(formatQuantity(5)).not.toContain('لتر')
  })

  it('cn يجمع الأصناف ويتجاهل الفراغات', () => {
    expect(cn('a', undefined, null, false, '', 'b')).toBe('a b')
  })

  it('getInitials يعيد أول حرفين من الاسم', () => {
    expect(getInitials('عبد الله محمد')).toBe('عا')
    expect(getInitials()).toBe('')
  })

  it('truncate يقص النص الطويل', () => {
    expect(truncate('نص طويل جداً', 4).length).toBeGreaterThan(4)
    expect(truncate('قصير', 10)).toBe('قصير')
  })

  it('getErrorMessage يستخرج رسالة الخطأ', () => {
    expect(getErrorMessage({ message: 'خطأ اختبار' })).toBe('خطأ اختبار')
    expect(getErrorMessage('خطأ نصي')).toBe('خطأ نصي')
    expect(getErrorMessage({})).toContain('حدث خطأ')
  })
})