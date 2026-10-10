import ExcelJS from 'exceljs'

export async function exportToExcel(fileName: string, headers: string[], rows: (string | number)[][]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(fileName)

  const headerRow = sheet.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF428177' } }
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFDED9C7' } } }
  })

  rows.forEach((row) => {
    const dataRow = sheet.addRow(row)
    dataRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    })
  })

  sheet.columns.forEach((col) => {
    if (col) col.width = 18
  })
  sheet.views = [{ rightToLeft: true }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportTableToPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 32

  doc.setFontSize(15)
  doc.setTextColor(0, 38, 35)
  doc.text(title, margin, 48)

  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(subtitle, margin, 64)

  const colWidth = (pageW - margin * 2) / headers.length
  let y = 90

  doc.setFillColor(66, 129, 119)
  doc.rect(margin, y - 11, pageW - margin * 2, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  headers.forEach((h, i) => {
    doc.text(h, margin + i * colWidth + 4, y + 1)
  })
  y += 20

  doc.setTextColor(22, 22, 22)
  rows.forEach((row, ri) => {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage()
      y = 60
    }
    if (ri % 2 === 1) {
      doc.setFillColor(245, 244, 240)
      doc.rect(margin, y - 10, pageW - margin * 2, 16, 'F')
    }
    doc.setFontSize(8.5)
    row.forEach((v, i) => {
      doc.text(String(v ?? ''), margin + i * colWidth + 4, y + 1)
    })
    y += 16
  })

  doc.setFontSize(8)
  doc.setTextColor(140, 140, 140)
  doc.text(
    `تم الاستخراج بتاريخ ${new Date().toLocaleDateString('ar-SA')} — مستند رسمي`,
    margin,
    doc.internal.pageSize.getHeight() - 24
  )

  doc.save(`${title}-${new Date().toISOString().slice(0, 10)}.pdf`)
}