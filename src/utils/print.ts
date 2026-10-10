import { BRAND } from '../config/brand'

export interface PrintField {
  label: string
  value: string
}

export interface ReceiptDocData {
  documentNumber: string
  resourceName: string
  quantity: number
  unit?: string
  supplierName?: string
  documentRef?: string
  notes?: string
  fields?: PrintField[]
  performerName?: string
  date?: string
}

export interface DeliveryDocData {
  documentNumber: string
  resourceName: string
  quantity: number
  unit?: string
  recipientName?: string
  branchName?: string
  documentRef?: string
  notes?: string
  fields?: PrintField[]
  performerName?: string
  date?: string
  remainingBalance?: number
}

function header(title: string, docNumber: string): string {
  return `
    <div class="doc-head">
      <div class="org">
        <div class="org-name">${BRAND.organization}</div>
        <div class="org-sub">${BRAND.appNameShort}</div>
      </div>
      <div class="doc-title">
        <h1>${title}</h1>
        <p class="doc-no">رقم المستند: <span dir="ltr">${docNumber}</span></p>
      </div>
    </div>
  `
}

function rows(fields: PrintField[]): string {
  if (!fields.length) return ''
  return `
    <table class="grid">
      <thead><tr><th>البيان</th><th>القيمة</th></tr></thead>
      <tbody>
        ${fields.map((f) => `<tr><td>${esc(f.label)}</td><td>${esc(f.value || '—')}</td></tr>`).join('')}
      </tbody>
    </table>
  `
}

function signatures(role1: string, role2: string, role3?: string): string {
  return `
    <div class="signs">
      <div class="sign"><span class="line"></span><p>${role1}</p></div>
      <div class="sign"><span class="line"></span><p>${role2}</p></div>
      ${role3 ? `<div class="sign"><span class="line"></span><p>${role3}</p></div>` : ''}
    </div>
  `
}

function esc(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const STYLES = `
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Traditional Arabic', 'Amiri', 'Segoe UI', Tahoma, sans-serif; color: #161616; margin: 0; direction: rtl; font-size: 14px; line-height: 1.7; }
    .doc-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #054239; padding-bottom: 12px; margin-bottom: 18px; }
    .org-name { font-weight: 700; font-size: 16px; color: #002623; }
    .org-sub { font-size: 12px; color: #6b6b6b; }
    .doc-title { text-align: left; }
    .doc-title h1 { margin: 0; font-size: 20px; color: #054239; }
    .doc-no { margin: 4px 0 0; font-size: 12px; color: #6b6b6b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    table.grid th, table.grid td { border: 1px solid #cfd3cf; padding: 8px 10px; text-align: right; font-size: 13px; }
    table.grid thead th { background: #f2f4f2; color: #002623; font-weight: 700; }
    .meta { display: flex; gap: 24px; margin-bottom: 14px; font-size: 13px; }
    .notes { border: 1px solid #e3e1d4; background: #faf9f4; padding: 10px 12px; border-radius: 6px; margin-bottom: 18px; font-size: 13px; }
    .signs { display: flex; gap: 16px; margin-top: 40px; }
    .sign { flex: 1; text-align: center; }
    .sign .line { display: block; border-top: 1px dashed #9a9a9a; margin-bottom: 6px; }
    .sign p { margin: 0; font-size: 13px; color: #333; }
    .footer { position: fixed; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 10px; color: #8a8a8a; }
    @media print { .no-print { display: none !important; } }
  </style>
`

export function printElement(elementId: string, title: string): void {
  const node = document.getElementById(elementId)
  if (!node) return
  const content = node.innerHTML
  const html = `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>${esc(title)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: 'Traditional Arabic', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #161616; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cfd3cf; padding: 6px 8px; text-align: right; }
          thead th { background: #f2f4f2; }
          h1, h2, h3 { color: #002623; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `
  const printWindow = window.open('', '_blank', 'width=900,height=1000')
  if (!printWindow) {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  window.setTimeout(() => printWindow.print(), 400)
}

export function printDocument(type: 'receipt' | 'delivery', data: ReceiptDocData | DeliveryDocData): void {
  const isReceipt = type === 'receipt'
  const d = data as ReceiptDocData & DeliveryDocData
  const title = isReceipt ? 'محضر استلام موارد' : 'محضر تسليم موارد'
  const date = d.date ? new Date(d.date).toLocaleString('ar-SA') : new Date().toLocaleString('ar-SA')

  const baseFields: PrintField[] = [
    { label: 'اسم المورد', value: d.resourceName },
    { label: 'الكمية', value: `${d.quantity} ${d.unit ?? ''}`.trim() },
    { label: 'تاريخ العملية', value: date },
    { label: isReceipt ? 'الجهة الموردة' : 'الجهة / الفرع المستلم', value: isReceipt ? d.supplierName ?? '—' : d.branchName ?? '—' },
    { label: isReceipt ? 'موظف الاستلام' : 'الموظف المنفذ للتسليم', value: d.performerName ?? '—' },
    { label: 'رقم المستند المرجعي', value: d.documentRef ?? d.documentNumber },
    ...(isReceipt ? [] : [{ label: 'الرصيد المتبقي بعد العملية', value: String(d.remainingBalance ?? '—') }]),
    ...(d.fields ?? []),
  ]

  const html = `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>${title} ${d.documentNumber}</title>
        ${STYLES}
      </head>
      <body>
        ${header(title, d.documentNumber)}
        ${rows(baseFields)}
        ${d.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${esc(d.notes)}</div>` : ''}
        ${signatures(
          isReceipt ? 'أمين المستودع' : 'الموظف المنفذ',
          isReceipt ? 'الجهة الموردة' : 'الشخص المستلم',
          isReceipt ? 'مدير المستودع' : 'مدير الفرع'
        )}
        <div class="footer">مستند صادر آلياً من ${BRAND.appNameShort} — ${esc(BRAND.appName)}</div>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank', 'width=900,height=1000')
  if (!printWindow) {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}-${d.documentNumber}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  window.setTimeout(() => {
    printWindow.print()
  }, 400)
}